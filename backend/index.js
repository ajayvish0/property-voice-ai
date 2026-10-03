// index.js — Express + Socket.IO server with stream cancellation + emotion

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

import {
  createSession,
  addMessage,
  getSession,
  endSession,
  deleteSession,
} from "./sessionManager.js";
import {
  getAIResponseStream,
  isIncomplete,
  getContinuationPrompt,
  USE_MOCK,
  AI_PROVIDER,
  AI_MODEL,
} from "./aiEngine.js";
import { synthesizeSpeech, TTS_ENGINE, USE_ELEVENLABS } from "./ttsEngine.js";
import { evaluateSession } from "./scoring.js";
import { checkRateLimit, clientIpFromSocket } from "./rateLimit.js";

dotenv.config();

const PORT = process.env.PORT || 3001;

// Comma-separated allowlist. Defaults keep local + common Netlify preview safe for DIY setup.
const CLIENT_ORIGINS = (
  process.env.CLIENT_ORIGIN ||
  process.env.CLIENT_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOW_ALL_ORIGINS = CLIENT_ORIGINS.includes("*");

const RATE_LIMIT_PER_IP = Number(process.env.RATE_LIMIT_PER_IP || 30);
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000,
);
const MAX_TURNS_PER_SESSION = Number(process.env.MAX_TURNS_PER_SESSION || 20);

function originAllowed(origin) {
  if (ALLOW_ALL_ORIGINS) return true;
  if (!origin) return true; // same-origin / non-browser tools
  return CLIENT_ORIGINS.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (originAllowed(origin)) callback(null, true);
    else callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST"],
};

const app = express();
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ai: USE_MOCK ? "mock" : AI_PROVIDER,
    model: USE_MOCK ? null : AI_MODEL,
    tts:
      USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" ? "elevenlabs" : "browser",
    rateLimit: {
      perIp: RATE_LIMIT_PER_IP,
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxTurnsPerSession: MAX_TURNS_PER_SESSION,
    },
  });
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  if (String(text).length > 500) {
    return res.status(400).json({ error: "text too long" });
  }
  const audio = await synthesizeSpeech(text);
  if (!audio) return res.status(204).end();
  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", audio.length);
  res.send(audio);
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOW_ALL_ORIGINS ? "*" : CLIENT_ORIGINS,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
});

console.log(`\n🎙️  Property Voice AI Simulator`);
console.log(
  `   AI  : ${
    USE_MOCK
      ? "🎭 Mock"
      : `🤖 ${AI_PROVIDER} (${AI_MODEL}) streaming + emotion`
  }`,
);
console.log(
  `   TTS : ${
    USE_ELEVENLABS && TTS_ENGINE === "elevenlabs"
      ? "🔊 ElevenLabs"
      : "🗣️  Browser Speech"
  }`,
);
console.log(
  `   CORS: ${ALLOW_ALL_ORIGINS ? "*" : CLIENT_ORIGINS.join(", ")}`,
);
console.log(
  `   Limit: ${RATE_LIMIT_PER_IP}/IP/window · ${MAX_TURNS_PER_SESSION}/session`,
);

io.on("connection", (socket) => {
  const sessionId = uuidv4();
  const clientIp = clientIpFromSocket(socket);
  createSession(sessionId);
  let sessionTurns = 0;
  console.log(`[IO] +session=${sessionId} ip=${clientIp}`);

  // AbortController per-socket — cancels active AI stream on interruption
  let activeAbort = null;

  socket.emit("session_started", {
    sessionId,
    ttsEngine:
      USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" ? "elevenlabs" : "browser",
    aiMode: USE_MOCK ? "mock" : AI_PROVIDER,
  });

  // Send opener as a real AI message so it appears in transcript correctly
  const opener =
    "Yeah hi — you called about the Andheri flat? It's a 2BHK, 80 lakhs. What did you want to know?";
  addMessage(sessionId, "assistant", opener);
  socket.emit("user_transcript", { text: "" }); // no user text yet
  socket.emit("ai_sentence", { sentence: opener });
  socket.emit("ai_response_done", { text: opener });

  // ─── Shared stream handler ────────────────────────────────────────────────
  async function handleUserInput(text) {
    const session = getSession(sessionId);
    if (!session || session.isEnded) return;

    // ── BARGE-IN: Cancel any active AI stream immediately ──────────────────
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      socket.emit("error_msg", {
        message: "Please keep messages under 500 characters.",
      });
      return;
    }

    if (sessionTurns >= MAX_TURNS_PER_SESSION) {
      socket.emit("rate_limited", {
        message:
          "Session turn limit reached. End the call to see your score, or start a new session.",
        retryAfterSec: 0,
      });
      return;
    }

    const ipLimit = checkRateLimit(
      `ip:${clientIp}`,
      RATE_LIMIT_PER_IP,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!ipLimit.allowed) {
      socket.emit("rate_limited", {
        message:
          "Demo rate limit reached for this network. Try again later — or end the session for a score.",
        retryAfterSec: ipLimit.retryAfterSec,
      });
      return;
    }

    sessionTurns += 1;
    console.log(`[IO] User: "${trimmed}" (emotion: ${session.emotion})`);

    // Store message (this also auto-updates emotion in sessionManager)
    addMessage(sessionId, "user", trimmed);
    socket.emit("user_transcript", { text: trimmed });

    // ── INCOMPLETE INPUT: reply with continuation prompt, don't generate ───
    if (isIncomplete(trimmed)) {
      const prompt = getContinuationPrompt();
      socket.emit("ai_sentence", { sentence: prompt });
      socket.emit("ai_response_done", { text: prompt });
      addMessage(sessionId, "assistant", prompt);
      console.log(`[IO] Incomplete input → continuation: "${prompt}"`);
      return;
    }

    // ── MICRO-DELAY: 100–300ms random thinking pause before responding ──────
    const thinkDelay = 100 + Math.floor(Math.random() * 200);
    await sleep(thinkDelay);

    socket.emit("ai_thinking");

    activeAbort = new AbortController();
    const { signal } = activeAbort;

    let fullResponse = "";
    let sentenceBuffer = "";

    const onChunk = (chunk) => {
      if (signal.aborted) return;
      fullResponse += chunk;
      sentenceBuffer += chunk;
      socket.emit("ai_chunk", { chunk });

      const sentenceEnd = /[.!?]\s*$/.test(sentenceBuffer.trim());
      if (sentenceEnd && sentenceBuffer.trim().length > 6) {
        socket.emit("ai_sentence", { sentence: sentenceBuffer.trim() });
        sentenceBuffer = "";
      }
    };

    const onDone = async (full) => {
      if (sentenceBuffer.trim().length > 2) {
        socket.emit("ai_sentence", { sentence: sentenceBuffer.trim() });
      }

      // Always emit completion so clients never hang on empty/aborted streams
      const text = (full || "").trim();
      if (text) {
        addMessage(sessionId, "assistant", text);
        console.log(`[IO] AI (${session.emotion}): "${text.substring(0, 70)}"`);
      }
      socket.emit("ai_response_done", { text });

      activeAbort = null;

      if (USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" && full) {
        try {
          const audio = await synthesizeSpeech(full);
          if (audio)
            socket.emit("ai_audio", { audio: audio.toString("base64") });
        } catch (err) {
          console.error("[TTS]", err.message);
        }
      }
    };

    try {
      await getAIResponseStream(
        session.messages,
        session.emotion,
        onChunk,
        onDone,
        signal,
      );
    } catch (err) {
      if (!signal.aborted) {
        console.error("[IO] AI stream error:", err.message);
        socket.emit("ai_error", { message: "AI failed. Please try again." });
      }
      activeAbort = null;
    }
  }

  socket.on("voice_input", async ({ transcript }) => {
    await handleUserInput(transcript);
  });

  socket.on("text_input", async ({ text }) => {
    await handleUserInput(text);
  });

  socket.on("barge_in", () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
      console.log(`[IO] Barge-in — stream cancelled`);
    }
  });

  socket.on("end_session", () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }

    const session = getSession(sessionId);
    if (!session) return;
    if (session.messages.filter((m) => m.role === "user").length === 0) {
      socket.emit("error_msg", {
        message: "Have at least one conversation before ending.",
      });
      return;
    }
    const score = evaluateSession(session.messages);
    endSession(sessionId, score);
    console.log(`[IO] Session ended score=${score.totalScore}`);
    socket.emit("score_result", score);
  });

  socket.on("disconnect", () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    deleteSession(sessionId);
    console.log(`[IO] -session=${sessionId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n✅ Server → http://localhost:${PORT}\n`);
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
