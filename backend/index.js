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
  getAIResponse,
  isIncomplete,
  getContinuationPrompt,
  USE_MOCK,
} from "./aiEngine.js";
import { synthesizeSpeech, TTS_ENGINE, USE_ELEVENLABS } from "./ttsEngine.js";
import { evaluateSession } from "./scoring.js";

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ai: USE_MOCK ? "mock" : "openai",
    tts:
      USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" ? "elevenlabs" : "browser",
  });
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  const audio = await synthesizeSpeech(text);
  if (!audio) return res.status(204).end();
  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", audio.length);
  res.send(audio);
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
});

console.log(`\n🎙️  Property Voice AI Simulator`);
console.log(
  `   AI  : ${USE_MOCK ? "🎭 Mock" : "🤖 GPT-4o streaming + emotion"}`,
);
console.log(
  `   TTS : ${USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" ? "🔊 ElevenLabs" : "🗣️  Browser Speech"}`,
);

io.on("connection", (socket) => {
  const sessionId = uuidv4();
  createSession(sessionId);
  console.log(`[IO] +session=${sessionId}`);

  // AbortController per-socket — cancels active AI stream on interruption
  let activeAbort = null;

  socket.emit("session_started", {
    sessionId,
    ttsEngine:
      USE_ELEVENLABS && TTS_ENGINE === "elevenlabs" ? "elevenlabs" : "browser",
    aiMode: USE_MOCK ? "mock" : "openai",
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
    // This is what makes it feel human — real people don't respond instantaneously
    const thinkDelay = 100 + Math.floor(Math.random() * 200);
    await sleep(thinkDelay);

    socket.emit("ai_thinking");

    // Create fresh AbortController for this response
    activeAbort = new AbortController();
    const { signal } = activeAbort;

    let fullResponse = "";
    let sentenceBuffer = "";

    const onChunk = (chunk) => {
      if (signal.aborted) return;
      fullResponse += chunk;
      sentenceBuffer += chunk;
      socket.emit("ai_chunk", { chunk });

      // Fire TTS as soon as a sentence is complete
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

      if (full) {
        addMessage(sessionId, "assistant", full);
        socket.emit("ai_response_done", { text: full });
        console.log(`[IO] AI (${session.emotion}): "${full.substring(0, 70)}"`);
      }

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

  // ─── voice_input ──────────────────────────────────────────────────────────
  socket.on("voice_input", async ({ transcript }) => {
    await handleUserInput(transcript);
  });

  // ─── text_input (fallback) ────────────────────────────────────────────────
  socket.on("text_input", async ({ text }) => {
    await handleUserInput(text);
  });

  // ─── barge_in: client signals user started speaking mid-AI-response ───────
  // This is a fast cancel path — doesn't wait for voice_input
  socket.on("barge_in", () => {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
      console.log(`[IO] Barge-in — stream cancelled`);
    }
  });

  // ─── end_session ──────────────────────────────────────────────────────────
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

  // ─── disconnect ───────────────────────────────────────────────────────────
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
