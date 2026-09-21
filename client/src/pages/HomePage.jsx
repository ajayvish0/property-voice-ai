import React from "react";

export default function HomePage({ onStart }) {
  return (
    <div className="min-h-screen bg-bg-1 flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Ambient orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-20 animate-orbFloat"
        style={{
          background: "radial-gradient(circle, #7c6ff7 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none opacity-10 animate-orbFloat"
        style={{
          background: "radial-gradient(circle, #00e5a0 0%, transparent 70%)",
          filter: "blur(80px)",
          animationDelay: "3s",
        }}
      />

      <div className="flex flex-col items-center text-center max-w-lg relative z-10 animate-fadeUp gap-6">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-2"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,111,247,0.3), rgba(124,111,247,0.1))",
            border: "1px solid rgba(124,111,247,0.4)",
            boxShadow: "0 0 40px rgba(124,111,247,0.2)",
          }}
        >
          🎙️
        </div>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest"
          style={{
            background: "rgba(124,111,247,0.1)",
            border: "1px solid rgba(124,111,247,0.3)",
            color: "#7c6ff7",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse2" />
          Live Voice AI Training
        </div>

        <h1
          className="font-display text-5xl font-bold leading-tight"
          style={{
            background: "linear-gradient(135deg, #fff 30%, #7c6ff7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          PropVoice
        </h1>

        <p className="text-[#8888aa] text-base leading-relaxed max-w-sm">
          Have a real voice conversation with an AI property seller. Negotiate,
          handle objections, and close the deal — just like a real call.
        </p>

        {/* Property card */}
        <div
          className="w-full rounded-2xl p-5 text-left"
          style={{
            background: "rgba(124,111,247,0.06)",
            border: "1px solid rgba(124,111,247,0.2)",
          }}
        >
          <div className="text-xs font-mono text-accent uppercase tracking-widest mb-3">
            Today's Scenario
          </div>
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-display text-xl font-bold text-white">
                David (Seller)
              </div>
              <div className="text-sm text-[#8888aa] mt-0.5">
                📍 Andheri West, Mumbai
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-accent">
                ₹80L
              </div>
              <div className="text-xs text-[#555577] uppercase">Asking</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Defensive",
              "Hinglish speaker",
              "Won't budge easily",
              "Emotional attachment",
            ].map((t) => (
              <span
                key={t}
                className="px-2 py-1 rounded-full text-xs text-[#8888aa]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            { icon: "🎙️", label: "You speak", desc: "Natural voice" },
            { icon: "🤖", label: "AI responds", desc: "Voice reply" },
            { icon: "📊", label: "Get scored", desc: "5 metrics" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-semibold text-white">{s.label}</div>
              <div className="text-xs text-[#555577] mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all hover:scale-105 active:scale-100"
          style={{
            background: "linear-gradient(135deg, #7c6ff7, #5a50d4)",
            boxShadow: "0 8px 32px rgba(124,111,247,0.4)",
          }}
        >
          Start Voice Session
        </button>

        <p className="text-xs text-[#444466]">
          Microphone access required · No real property involved
        </p>
      </div>
    </div>
  );
}
