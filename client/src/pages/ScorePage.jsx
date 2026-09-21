import React, { useEffect, useRef } from 'react';

const CATEGORIES = [
  { key: 'persuasion',        label: 'Persuasion',         max: 25, icon: '🎯', desc: 'Market logic, urgency, price offers' },
  { key: 'clarity',           label: 'Clarity',            max: 20, icon: '💬', desc: 'Clear, confident communication' },
  { key: 'objectionHandling', label: 'Objection Handling', max: 25, icon: '🛡️', desc: 'Responding to seller pushback' },
  { key: 'closing',           label: 'Closing Ability',    max: 30, icon: '🤝', desc: 'Attempts to seal the deal' },
  { key: 'engagement',        label: 'Engagement',         max: 10, icon: '⚡', desc: 'Session depth & participation' },
];

function barColor(val, max) {
  const p = val / max;
  if (p >= 0.75) return { bar: '#00e5a0', glow: 'rgba(0,229,160,0.3)' };
  if (p >= 0.45) return { bar: '#f5a623', glow: 'rgba(245,166,35,0.3)' };
  return { bar: '#ff4d6d', glow: 'rgba(255,77,109,0.3)' };
}

function ScoreCircle({ totalScore, maxScore }) {
  const canvasRef = useRef(null);
  const pct = Math.min(totalScore / maxScore, 1);
  const color = pct >= 0.72 ? '#00e5a0' : pct >= 0.48 ? '#f5a623' : '#ff4d6d';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 80, cy = 80, r = 64;
    let current = 0;
    const step = pct / 70;

    function draw() {
      ctx.clearRect(0, 0, 160, 160);
      // Track
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 10;
      ctx.stroke();
      // Arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * current);
      ctx.strokeStyle = color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.stroke();
      if (current < pct) { current = Math.min(current + step, pct); requestAnimationFrame(draw); }
    }
    draw();
  }, [pct, color]);

  return (
    <div className="relative w-40 h-40 flex-shrink-0">
      <canvas ref={canvasRef} width={160} height={160} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold" style={{ color }}>{totalScore}</span>
        <span className="text-xs text-[#555577] font-mono">/ {maxScore}</span>
      </div>
    </div>
  );
}

export default function ScorePage({ score, onRestart }) {
  if (!score) return null;
  const { totalScore, maxScore, rating, breakdown, feedback, messageCount } = score;
  const pct = Math.round((totalScore / maxScore) * 100);

  return (
    <div className="min-h-screen bg-bg-1 flex flex-col items-center px-4 py-10 relative overflow-x-hidden">

      {/* Ambient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,111,247,0.07) 0%, transparent 70%)' }} />

      <div className="w-full max-w-xl flex flex-col gap-6 relative z-10 animate-scoreReveal">

        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <span className="inline-block mx-auto px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest text-accent"
            style={{ background: 'rgba(124,111,247,0.1)', border: '1px solid rgba(124,111,247,0.2)' }}>
            Session Complete
          </span>
          <h1 className="font-display text-4xl font-bold text-white">Your Deal Score</h1>
          <p className="text-[#8888aa] text-sm">Here's how you performed in this negotiation</p>
        </div>

        {/* Score hero */}
        <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden"
          style={{ background: 'rgba(124,111,247,0.06)', border: '1px solid rgba(124,111,247,0.2)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,#7c6ff7,transparent)' }} />
          <ScoreCircle totalScore={totalScore} maxScore={maxScore} />
          <div className="flex flex-col items-center sm:items-start gap-3">
            <div className="px-4 py-2 rounded-xl font-semibold text-base text-accent"
              style={{ background: 'rgba(124,111,247,0.1)', border: '1px solid rgba(124,111,247,0.25)' }}>
              {rating}
            </div>
            <div className="flex items-center gap-5">
              {[
                { val: messageCount, label: 'Exchanges' },
                { val: `${pct}%`, label: 'Score Rate' },
                { val: totalScore, label: 'Total Pts' },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div className="text-center">
                    <div className="font-display text-2xl font-bold text-white">{s.val}</div>
                    <div className="text-xs text-[#555577] uppercase tracking-wide">{s.label}</div>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.07)' }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-display text-lg font-bold text-white">Score Breakdown</h2>
          {CATEGORIES.map(({ key, label, max, icon, desc }) => {
            const val = breakdown[key] ?? 0;
            const p = (val / max) * 100;
            const { bar, glow } = barColor(val, max);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs text-[#555577]">{desc}</div>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold" style={{ color: bar }}>
                    {val}<span className="text-[#444466]">/{max}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${p}%`, background: bar, boxShadow: `0 0 8px ${glow}` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        <div className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-display text-lg font-bold text-white">Coaching Feedback</h2>
          {feedback.map((f, i) => {
            const styles = {
              success: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', text: 'text-emerald-400' },
              warn: { border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', text: 'text-yellow-400' },
              error: { border: 'border-red-500/20', bg: 'bg-red-500/5', text: 'text-red-400' },
              info: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', text: 'text-blue-400' },
            }[f.type] || {};
            return (
              <div key={i} className={`px-4 py-3 rounded-xl border ${styles.border} ${styles.bg}`}>
                <p className={`text-sm ${styles.text}`}>{f.text}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <button onClick={onRestart}
            className="flex-1 py-4 rounded-xl font-semibold text-base text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #7c6ff7, #5a50d4)', boxShadow: '0 6px 24px rgba(124,111,247,0.35)' }}>
            🎙️ Practice Again
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(`PropVoice Score: ${totalScore}/${maxScore} — ${rating}`).then(() => alert('Copied!'))}
            className="flex-1 py-4 rounded-xl font-semibold text-sm text-[#8888aa] transition-all hover:text-white"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            📋 Copy Score
          </button>
        </div>

      </div>
    </div>
  );
}
