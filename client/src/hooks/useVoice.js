// useVoice.js — Smart VAD + barge-in + emotional conversation flow

import { useState, useRef, useCallback, useEffect } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

// ─── Voice preload ─────────────────────────────────────────────────────────
let _cachedVoice = null;

function getVoice() {
  if (_cachedVoice) return _cachedVoice;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  _cachedVoice =
    voices.find((v) => v.name === "Google UK English Male") ||
    voices.find(
      (v) => v.name === "Microsoft David - English (United States)",
    ) ||
    voices.find((v) => v.name === "Alex") ||
    voices.find((v) => v.name === "Google US English") ||
    voices.find(
      (v) => v.lang === "en-US" && !v.name.toLowerCase().includes("female"),
    ) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0];
  return _cachedVoice;
}

if (typeof window !== "undefined") {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => {
    _cachedVoice = null;
    getVoice();
  });
}

// ─── TTSQueue ─────────────────────────────────────────────────────────────
// Plays sentences in order. Supports hard cancel for barge-in.
class TTSQueue {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.onEnd = null;
    this._currentUtterance = null;
  }

  enqueue(text, onStart, onEnd) {
    if (!text?.trim()) return;
    this.queue.push({ text: text.trim(), onStart, onEnd });
    if (!this.speaking) this._next();
  }

  _next() {
    if (!this.queue.length) {
      this.speaking = false;
      this._currentUtterance = null;
      this.onEnd?.();
      return;
    }
    this.speaking = true;
    const { text, onStart, onEnd } = this.queue.shift();

    const u = new SpeechSynthesisUtterance(text);
    this._currentUtterance = u;
    u.voice = getVoice();
    u.rate = 1.0;
    u.pitch = 0.95;
    u.volume = 1.0;

    u.onstart = () => onStart?.();
    u.onend = () => {
      this._currentUtterance = null;
      onEnd?.();
      this._next();
    };
    u.onerror = () => {
      this._currentUtterance = null;
      this._next();
    };

    speechSynthesis.speak(u);
  }

  // Hard stop — cancels current speech AND clears queue
  // Called on barge-in so user can immediately interrupt AI
  stop() {
    speechSynthesis.cancel();
    this.queue = [];
    this.speaking = false;
    this._currentUtterance = null;
  }

  isSpeaking() {
    return speechSynthesis.speaking || this.speaking;
  }
}

// ─── SpeechRecognizer ─────────────────────────────────────────────────────
// Smart VAD with:
// 1. Silence threshold: 1000ms (was 500ms) — prevents cutting mid-sentence
// 2. Grace buffer: 300ms after silence — if user resumes, cancel the send
// 3. Sentence completeness check: require either punctuation OR 10+ words
// 4. Barge-in detection: fires onSpeechStart as soon as voice is detected
class SpeechRecognizer {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.supported = false;
      return;
    }
    this.supported = true;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.isListening = false;
    this._silenceTimer = null;
    this._graceTimer = null;
    this._lastInterim = "";
    this._hasFired = false;
    this._speechStarted = false; // tracks whether voice has been detected this session
  }

  start(onInterim, onFinal, onEnd, onSpeechStart) {
    if (!this.supported || this.isListening) return;
    this.isListening = true;
    this._hasFired = false;
    this._speechStarted = false;
    this._lastInterim = "";

    this.recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          clearTimeout(this._silenceTimer);
          clearTimeout(this._graceTimer);
          if (!this._hasFired) {
            this._hasFired = true;
            const text = e.results[i][0].transcript.trim();
            if (text.length > 1) {
              onFinal(text);
              this.stop();
              onEnd?.();
            }
          }
          return;
        }
        interim += e.results[i][0].transcript;
      }

      if (!interim || interim === this._lastInterim) return;

      // Barge-in detection: first new interim = user has started speaking
      if (!this._speechStarted) {
        this._speechStarted = true;
        onSpeechStart?.(); // → fires barge_in to server, stops TTS
      }

      this._lastInterim = interim;
      onInterim(interim);

      // Reset both timers on every new interim result
      clearTimeout(this._silenceTimer);
      clearTimeout(this._graceTimer);

      // Step 1: Wait 1000ms of silence before even considering sending
      this._silenceTimer = setTimeout(() => {
        const text = this._lastInterim.trim();
        const words = text.split(/\s+/).filter(Boolean);

        // ── Sentence completeness check ────────────────────────────────────
        // Only send if the utterance seems complete:
        // - ends with sentence-ending punctuation, OR
        // - is at least 10 words long (a complete thought)
        // This prevents sending half-sentences when user naturally pauses
        const endsWithPunct = /[.!?]$/.test(text);
        const isLongEnough = words.length >= 10;
        const isComplete = endsWithPunct || isLongEnough;

        if (!isComplete && words.length >= 3) {
          // Incomplete but has content — wait longer (user may be thinking)
          // Give another 500ms grace period
          this._graceTimer = setTimeout(() => {
            this._fireFinal(onFinal, onEnd);
          }, 500);
          return;
        }

        if (!isComplete && words.length < 3) {
          // Too short AND no punct — keep waiting, user may not be done
          // Restart timer with extra 500ms
          this._silenceTimer = setTimeout(() => {
            this._fireFinal(onFinal, onEnd);
          }, 500);
          return;
        }

        // ── Grace buffer: 300ms to detect if user resumes ─────────────────
        // If user resumes speaking in 300ms, this timer gets cancelled above
        this._graceTimer = setTimeout(() => {
          this._fireFinal(onFinal, onEnd);
        }, 300);
      }, 1000); // Primary silence threshold: 1000ms
    };

    // Auto-restart to handle browser's 60s timeout
    this.recognition.onend = () => {
      if (this.isListening && !this._hasFired) {
        try {
          this.recognition.start();
        } catch (_) {}
      }
    };

    this.recognition.onerror = (e) => {
      clearTimeout(this._silenceTimer);
      clearTimeout(this._graceTimer);
      if (e.error === "no-speech") {
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (_) {}
        }
        return;
      }
      this.isListening = false;
      this._lastInterim = "";
      if (e.error !== "aborted") console.warn("[STT]", e.error);
      onEnd?.();
    };

    this.recognition.start();
  }

  _fireFinal(onFinal, onEnd) {
    const text = this._lastInterim.trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (!this._hasFired && words.length >= 1 && text.length > 2) {
      this._hasFired = true;
      onFinal(text);
      this.stop();
      onEnd?.();
    }
  }

  stop() {
    clearTimeout(this._silenceTimer);
    clearTimeout(this._graceTimer);
    this._lastInterim = "";
    this._hasFired = false;
    this._speechStarted = false;
    if (this.isListening) {
      this.isListening = false;
      try {
        this.recognition.abort();
      } catch (_) {}
    }
  }

  abort() {
    this.stop();
  }
}

// ─── Main Hook ────────────────────────────────────────────────────────────
export function useVoice() {
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [interimText, setInterimText] = useState("");
  const [liveAiText, setLiveAiText] = useState("");
  const [score, setScore] = useState(null);
  const [ttsEngine, setTtsEngine] = useState("browser");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [vadActive, setVadActive] = useState(false);
  const [emotion, setEmotion] = useState("neutral"); // reflects AI's current emotion

  const socketRef = useRef(null);
  const ttsQueueRef = useRef(new TTSQueue());
  const sttRef = useRef(new SpeechRecognizer());
  const isListeningRef = useRef(false);
  const autoListenTimerRef = useRef(null);
  const statusRef = useRef("idle"); // Ref to avoid stale closures in callbacks

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const addMsg = useCallback((role, content) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // ── Auto-listen after AI finishes ───────────────────────────────────────
  const scheduleAutoListen = useCallback(() => {
    clearTimeout(autoListenTimerRef.current);
    autoListenTimerRef.current = setTimeout(() => {
      if (statusRef.current !== "ended") startListening();
    }, 150);
  }, []);

  // ── Start listening ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isListeningRef.current || !sttRef.current.supported) return;

    isListeningRef.current = true;
    setStatus("listening");
    setInterimText("");
    setVadActive(false);

    sttRef.current.start(
      // onInterim
      (interim) => {
        setInterimText(interim);
        setVadActive(true);
      },
      // onFinal — VAD fired, send to server
      (final) => {
        setInterimText("");
        setVadActive(false);
        if (final.length > 1) {
          setStatus("processing");
          socketRef.current?.emit("voice_input", { transcript: final });
        }
      },
      // onEnd
      () => {
        isListeningRef.current = false;
        setVadActive(false);
        if (statusRef.current === "listening") setStatus("ready");
      },
      // onSpeechStart — BARGE-IN: user started speaking while AI is talking
      () => {
        // Stop TTS immediately
        ttsQueueRef.current.stop();
        setLiveAiText("");
        setStatus("listening");
        // Tell server to cancel active AI stream
        socketRef.current?.emit("barge_in");
      },
    );
  }, []);

  const stopListening = useCallback(() => {
    sttRef.current.stop();
    isListeningRef.current = false;
    setVadActive(false);
    setInterimText("");
    if (statusRef.current === "listening") setStatus("ready");
  }, []);

  // ── Text fallback ──────────────────────────────────────────────────────
  const sendText = useCallback((text) => {
    if (!text.trim()) return;
    ttsQueueRef.current.stop();
    setLiveAiText("");
    setStatus("processing");
    socketRef.current?.emit("text_input", { text });
  }, []);

  // ── ElevenLabs audio ───────────────────────────────────────────────────
  const playBase64Audio = useCallback(
    (base64) => {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = 1.0;
        setStatus("speaking");
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setStatus("ready");
          scheduleAutoListen();
        };
        audio.play();
      } catch (err) {
        console.error("[Audio]", err);
      }
    },
    [scheduleAutoListen],
  );

  // ── Connect ────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    setStatus("connecting");
    setConnectionStatus("connecting");

    const speak = (text, onStart, onEnd) => {
      ttsQueueRef.current.enqueue(text, onStart, onEnd);
      ttsQueueRef.current.onEnd = () => {
        setStatus("ready");
        scheduleAutoListen();
      };
    };

    const socket = io(SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
      setStatus("idle");
    });
    socket.on("connect_error", () => {
      setConnectionStatus("error");
      setStatus("error");
    });

    socket.on("session_started", ({ ttsEngine: engine }) => {
      setTtsEngine(engine);
      setStatus("ready");
      // Opener is sent from server as first ai_sentence/ai_response_done event
      // DO NOT hardcode opener here — server controls it to avoid duplication
      scheduleAutoListen();
    });

    socket.on("user_transcript", ({ text }) => addMsg("user", text));

    // Emotion update from server (reflected in UI)
    socket.on("emotion_update", ({ emotion: e }) => setEmotion(e));

    socket.on("ai_thinking", () => {
      setStatus("processing");
      setLiveAiText("");
    });

    socket.on("ai_chunk", ({ chunk }) => setLiveAiText((prev) => prev + chunk));

    socket.on("ai_sentence", ({ sentence }) => {
      setStatus("speaking");
      speak(
        sentence,
        () => setStatus("speaking"),
        () => {},
      );
    });

    socket.on("ai_response_done", ({ text }) => {
      setLiveAiText("");
      if (text) addMsg("assistant", text);
      // If TTS queue already has sentences queued and playing, don't re-add full text
      // Only speak if nothing was queued (edge case — very short response with no punctuation)
      if (!ttsQueueRef.current.isSpeaking() && text) {
        setStatus("speaking");
        speak(
          text,
          () => setStatus("speaking"),
          () => {},
        );
      }
    });

    socket.on("ai_audio", ({ audio }) => playBase64Audio(audio));
    socket.on("score_result", (s) => {
      setScore(s);
      setStatus("ended");
    });
    socket.on("error_msg", () => setStatus("ready"));
    socket.on("ai_error", () => setStatus("ready"));
  }, [addMsg, scheduleAutoListen, playBase64Audio]);

  // ── End session ────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    stopListening();
    ttsQueueRef.current.stop();
    socketRef.current?.emit("end_session");
    setStatus("processing");
  }, [stopListening]);

  // ── Reset ──────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    clearTimeout(autoListenTimerRef.current);
    stopListening();
    ttsQueueRef.current.stop();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus("idle");
    setMessages([]);
    setInterimText("");
    setLiveAiText("");
    setScore(null);
    setEmotion("neutral");
    setConnectionStatus("disconnected");
    isListeningRef.current = false;
  }, [stopListening]);

  useEffect(() => {
    return () => clearTimeout(autoListenTimerRef.current);
  }, []);

  return {
    status,
    messages,
    interimText,
    liveAiText,
    score,
    ttsEngine,
    connectionStatus,
    vadActive,
    emotion,
    sttSupported: sttRef.current.supported,
    connect,
    startListening,
    stopListening,
    sendText,
    endSession,
    reset,
  };
}
