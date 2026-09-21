import React, { useState, useRef, useEffect } from "react";

// ── Wave bars — animated when speaking ───────────────────────────────────────
function WaveBars({ active, color = "#7c6ff7", count = 5 }) {
  return (
    <div className="flex items-center gap-1 h-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-300"
          style={{
            background: color,
            height: active ? `${20 + Math.sin(i * 1.2) * 12}px` : "6px",
            animation: active
              ? `waveBar ${0.6 + i * 0.1}s ease infinite`
              : "none",
            animationDelay: `${i * 0.08}s`,
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ── Ripple button ─────────────────────────────────────────────────────────────
function MicButton({ status, onPress, onRelease, onClick }) {
  const isListening = status === "listening";
  const isSpeaking = status === "speaking";
  const isProcessing = status === "processing";
  const isReady = status === "ready";

  const color = isListening
    ? "#00e5a0"
    : isSpeaking
      ? "#7c6ff7"
      : isProcessing
        ? "#f5a623"
        : "#7c6ff7";

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      {/* Ripple rings */}
      {(isListening || isSpeaking) && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-ripple"
            style={{ border: `2px solid ${color}`, opacity: 0.6 }}
          />
          <div
            className="absolute inset-0 rounded-full animate-ripple"
            style={{
              border: `2px solid ${color}`,
              opacity: 0.4,
              animationDelay: "0.5s",
            }}
          />
        </>
      )}

      {/* Main button */}
      <button
        onClick={onClick}
        className="w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1.5 transition-all duration-200 select-none relative z-10"
        style={{
          background: isListening
            ? `radial-gradient(circle, rgba(0,229,160,0.3), rgba(0,229,160,0.1))`
            : isSpeaking
              ? `radial-gradient(circle, rgba(124,111,247,0.3), rgba(124,111,247,0.1))`
              : `radial-gradient(circle, rgba(124,111,247,0.2), rgba(124,111,247,0.05))`,
          border: `2px solid ${color}`,
          boxShadow: `0 0 30px ${color}40`,
          transform: isListening ? "scale(1.05)" : "scale(1)",
        }}
      >
        {isProcessing ? (
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isSpeaking ? (
          <WaveBars active={true} color={color} count={5} />
        ) : isListening ? (
          <>
            <span className="text-3xl">🎙️</span>
            <span className="text-xs font-mono text-green-400">listening</span>
          </>
        ) : (
          <>
            <span className="text-3xl">🎙️</span>
            <span className="text-xs font-mono text-accent">tap to speak</span>
          </>
        )}
      </button>
    </div>
  );
}

// ── Transcript bubble ─────────────────────────────────────────────────────────
function TranscriptBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} animate-fadeUp`}
    >
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
          style={{ background: "linear-gradient(135deg, #7c6ff7, #5a50d4)" }}
        >
          R
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "rounded-br-sm bg-accent/20 border border-accent/30 text-white"
            : "rounded-bl-sm text-[#e0e0f0]"
        }`}
        style={
          !isUser
            ? {
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }
            : {}
        }
      >
        {!isUser && (
          <div className="text-xs font-mono text-accent mb-1 uppercase tracking-wide">
            David
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}

// ── Main voice page ───────────────────────────────────────────────────────────
export default function VoicePage({ voice, onBack }) {
  const [textInput, setTextInput] = useState("");
  const [showText, setShowText] = useState(false);
  const messagesEndRef = useRef(null);

  const {
    status,
    messages,
    interimText,
    liveAiText,
    connectionStatus,
    vadActive,
    sttSupported,
    startListening,
    stopListening,
    sendText,
    endSession,
  } = voice;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveAiText, interimText]);

  // Show text fallback if STT not supported
  useEffect(() => {
    if (!sttSupported) setShowText(true);
  }, [sttSupported]);

  const handleMicClick = () => {
    if (status === "listening") stopListening();
    else if (status === "ready") startListening();
  };

  const handleTextSend = () => {
    if (!textInput.trim()) return;
    sendText(textInput);
    setTextInput("");
  };

  const statusLabel =
    {
      idle: "Starting...",
      connecting: "Connecting...",
      ready: "Ready — tap mic or speak",
      listening: "Listening...",
      processing: "David is thinking...",
      speaking: "David is speaking...",
      ended: "Session ended",
      error: "Connection error",
    }[status] || status;

  const statusColor =
    {
      ready: "#00e5a0",
      listening: "#00e5a0",
      processing: "#f5a623",
      speaking: "#7c6ff7",
      error: "#ff4d6d",
    }[status] || "#8888aa";

  const isConnecting = ["idle", "connecting"].includes(status);

  return (
    <div className="flex flex-col h-screen bg-bg-1 relative overflow-hidden">
      {/* Ambient bg */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(124,111,247,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 relative z-10"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-sm text-[#8888aa] hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            ← Back
          </button>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white relative"
              style={{
                background: "linear-gradient(135deg, #7c6ff7, #5a50d4)",
              }}
            >
              R
              {status === "speaking" && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent"
                  style={{ border: "2px solid #080810" }}
                />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">David</div>
              <div
                className="flex items-center gap-1.5 text-xs"
                style={{ color: statusColor }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse2"
                  style={{ background: statusColor }}
                />
                {statusLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="hidden sm:block text-xs font-mono px-2 py-1 rounded-lg text-[#8888aa]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            2BHK · ₹80L · Andheri
          </div>
          <button
            onClick={endSession}
            disabled={
              ["idle", "connecting", "ended", "processing"].includes(status) ||
              messages.filter((m) => m.role === "user").length === 0
            }
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, #7b1a2e, #c0304a)",
              boxShadow: "0 4px 14px rgba(255,77,109,0.3)",
            }}
          >
            End & Score
          </button>
        </div>
      </div>

      {/* ── Connecting overlay ─────────────────────────────────────────────── */}
      {isConnecting && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
          style={{
            background: "rgba(8,8,16,0.9)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-[#8888aa]">
            {connectionStatus === "error"
              ? "⚠ Cannot connect to server on port 3001"
              : "Connecting to David..."}
          </p>
        </div>
      )}

      {/* ── Transcript area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 relative z-10">
        {messages.length === 0 && !isConnecting && (
          <div className="text-center text-[#444466] text-sm mt-8 animate-pulse2">
            David will introduce himself shortly...
          </div>
        )}

        {messages.map((msg) => (
          <TranscriptBubble key={msg.id} message={msg} />
        ))}

        {/* Live AI streaming text */}
        {liveAiText && (
          <div className="flex items-end gap-2 animate-fadeUp">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, #7c6ff7, #5a50d4)",
              }}
            >
              R
            </div>
            <div
              className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm text-[#e0e0f0]"
              style={{
                background: "rgba(124,111,247,0.08)",
                border: "1px solid rgba(124,111,247,0.2)",
              }}
            >
              <div className="text-xs font-mono text-accent mb-1 uppercase tracking-wide">
                David
              </div>
              {liveAiText}
              <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-pulse2 rounded-sm" />
            </div>
          </div>
        )}

        {/* Live user interim text */}
        {interimText && (
          <div className="flex flex-row-reverse items-end gap-2 animate-fadeUp">
            <div
              className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm text-[#8888aa] italic"
              style={{
                background: "rgba(0,229,160,0.06)",
                border: "1px dashed rgba(0,229,160,0.2)",
              }}
            >
              {interimText}...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Voice Control Area ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 relative z-10 pb-safe"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* AI speaking wave */}
        {status === "speaking" && (
          <div className="flex items-center justify-center gap-1 py-2">
            <WaveBars active={true} color="#7c6ff7" count={8} />
            <span className="text-xs text-accent font-mono ml-2">
              David speaking...
            </span>
          </div>
        )}

        {/* Main mic area */}
        <div className="flex flex-col items-center py-4 gap-3">
          {sttSupported && !showText && (
            <>
              <MicButton status={status} onClick={handleMicClick} />
              <p className="text-xs text-[#444466] font-mono">
                {status === "listening"
                  ? "🔴 Recording — tap to stop"
                  : status === "processing"
                    ? "⏳ Processing..."
                    : status === "speaking"
                      ? "🔊 Tap mic to interrupt"
                      : "👆 Tap to speak"}
              </p>
            </>
          )}

          {/* Text fallback toggle */}
          <button
            onClick={() => setShowText((p) => !p)}
            className="text-xs text-[#555577] hover:text-accent transition-colors font-mono"
          >
            {showText ? "🎙️ Switch to voice" : "⌨️  Type instead"}
          </button>

          {showText && (
            <div className="flex gap-2 w-full max-w-md px-4 pb-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSend()}
                placeholder="Type your message..."
                disabled={["idle", "connecting", "ended"].includes(status)}
                className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-[#444466] focus:outline-none transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <button
                onClick={handleTextSend}
                disabled={
                  !textInput.trim() ||
                  ["idle", "connecting", "ended"].includes(status)
                }
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #7c6ff7, #5a50d4)",
                }}
              >
                Send
              </button>
            </div>
          )}

          {/* Message count */}
          <p className="text-xs text-[#333355] font-mono">
            {messages.filter((m) => m.role === "user").length} exchanges ·{" "}
            {status === "ready"
              ? "Your turn"
              : status === "listening"
                ? "Speak now"
                : status === "speaking"
                  ? "Listening after..."
                  : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
