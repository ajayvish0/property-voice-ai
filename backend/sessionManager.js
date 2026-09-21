// sessionManager.js — session store with emotion state tracking

const sessions = new Map();

// ─── Emotion transitions ───────────────────────────────────────────────────
// Analyzes the last user message and updates emotion accordingly.
// Called every time a new user message arrives.
export function updateEmotion(session, userText) {
  const text = userText.toLowerCase();

  // Very low price offer → annoyed
  if (/\b[456]\d\b/.test(text) || /\b7[0-3]\b/.test(text)) {
    session.emotion = "annoyed";
    return;
  }

  // Reasonable offer or closing signals → warm
  if (
    /\b7[8-9]\b|\b80\b|deal|agree|finalize|advance|token|serious/.test(text)
  ) {
    session.emotion = "warm";
    return;
  }

  // Trust / personal questions → interested
  if (/why|reason|tell me|about you|how long|family|story/.test(text)) {
    session.emotion = "interested";
    return;
  }

  // Too many back-to-back questions without offer → defensive
  const recentUserMsgs = session.messages
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content);
  const questionCount = recentUserMsgs.filter((m) => m.includes("?")).length;
  if (questionCount >= 3) {
    session.emotion = "defensive";
    return;
  }

  // Mid-range offer → neutral
  if (/\b7[4-7]\b/.test(text)) {
    session.emotion = "neutral";
    return;
  }

  // Don't change emotion if nothing matches — keep current state
}

// ─── CRUD ────────────────────────────────────────────────────────────────────
export function createSession(id) {
  sessions.set(id, {
    id,
    messages: [],
    emotion: "neutral", // neutral | interested | annoyed | defensive | warm
    startedAt: Date.now(),
    score: null,
    isEnded: false,
  });
  return sessions.get(id);
}

export function addMessage(id, role, content) {
  const s = sessions.get(id);
  if (!s) throw new Error(`Session ${id} not found`);
  s.messages.push({ role, content });

  // Update emotion whenever a user message arrives
  if (role === "user") updateEmotion(s, content);
}

export function getSession(id) {
  return sessions.get(id);
}

export function endSession(id, score) {
  const s = sessions.get(id);
  if (!s) throw new Error(`Session ${id} not found`);
  s.endedAt = Date.now();
  s.score = score;
  s.isEnded = true;
  return s;
}

export function deleteSession(id) {
  sessions.delete(id);
}
