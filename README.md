# Property Voice AI

### Real-time voice negotiation trainer powered by GPT-4o

Practice closing a real-estate deal against **David** — an emotionally adaptive seller persona that listens, interrupts, and pushes back like a human. Built as a full-stack voice AI product: speech in, streaming intelligence out, scored performance at the end.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white)](https://openai.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Why this project matters

Most chatbots wait for typed input. **Property Voice AI** models the harder problem: a live negotiation where latency, tone, interruption, and persuasion all matter.

| Capability | What it demonstrates |
|---|---|
| **Voice-first UX** | Browser Speech Recognition + TTS with sentence-level playback |
| **Streaming LLM** | GPT-4o token streaming over Socket.IO for low perceived latency |
| **Barge-in** | User speech cancels the active AI stream mid-sentence |
| **Emotional state machine** | Seller mood shifts (neutral → interested → annoyed → defensive → warm) |
| **Performance scoring** | Post-session rubric: persuasion, clarity, objections, closing, engagement |
| **Production fallbacks** | Mock AI mode when OpenAI is unavailable; browser TTS when ElevenLabs is off |

Recruiters: this is not a CRUD app. It is a **real-time systems + LLM product** with UX constraints that show up in production voice agents.

---

## Demo flow

1. Land on the property brief (2BHK · Andheri West · ₹80L asking)
2. Start a live call with David
3. Speak or type — negotiate price, amenities, visit, closing
4. Interrupt him mid-reply (barge-in)
5. End the session → get a scored negotiation report

---

## Architecture

```
┌────────────────────────────┐         WebSocket / REST         ┌────────────────────────────┐
│  Client (React + Vite)     │◄────────────────────────────────►│  Backend (Express)          │
│                            │                                  │                            │
│  • SpeechRecognition (STT) │  voice_input / text_input        │  • Session + emotion store │
│  • SpeechSynthesis / audio │  ai_chunk / ai_sentence          │  • GPT-4o streaming        │
│  • Barge-in VAD            │  barge_in / score_result         │  • AbortController cancel  │
│  • Transcript + score UI   │                                  │  • Scoring engine          │
└────────────────────────────┘                                  │  • Optional ElevenLabs TTS │
                                                                └─────────────┬──────────────┘
                                                                              │
                                                                              ▼
                                                                    OpenAI GPT-4o API
```

### Request lifecycle

1. Mic captures speech → final transcript emitted as `voice_input`
2. Server stores message, updates **emotion**, streams GPT-4o reply
3. Client receives `ai_chunk` / `ai_sentence` and speaks sentence-by-sentence
4. If the user starts talking again → `barge_in` aborts the stream + cancels TTS
5. `end_session` runs the scoring rubric and returns a breakdown

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Intelligence | OpenAI GPT-4o (streaming) + emotion-aware system prompts |
| Speech | Web Speech API (STT/TTS) · optional ElevenLabs Turbo TTS |
| State | In-memory session manager with UUID sessions |
| DX | Nodemon, dotenv, mock-AI fallback for offline demos |

---

## Project structure

```
property-voice-ai/
├── backend/                 # Real-time API + AI orchestration
│   ├── index.js             # Express + Socket.IO gateway
│   ├── aiEngine.js          # GPT-4o streaming, emotion prompts, mock fallback
│   ├── sessionManager.js    # Sessions + emotion transitions
│   ├── scoring.js           # Negotiation performance rubric
│   ├── ttsEngine.js         # Optional ElevenLabs synthesis
│   └── .env.example
├── client/                  # Voice negotiation UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── hooks/useVoice.js    # STT, TTS queue, barge-in, sockets
│   │   └── pages/               # Home · Voice · Score
│   └── .env.example
├── package.json             # Root scripts for install / run
├── LICENSE
└── README.md
```

---

## Quick start

### Prerequisites

- **Node.js 18+**
- Modern Chromium-based browser (best SpeechRecognition support)
- OpenAI API key with available credits *(or set `USE_MOCK_AI=true`)*

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/property-voice-ai.git
cd property-voice-ai
npm run install:all
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env → set OPENAI_API_KEY (and optional ElevenLabs)

# Client (optional override)
cp client/.env.example client/.env
```

Minimal `backend/.env`:

```env
PORT=3001
OPENAI_API_KEY=sk-...
USE_MOCK_AI=false
TTS_ENGINE=browser
```

### 3. Run (two terminals)

```bash
# Terminal 1 — API + Socket.IO
npm run dev:server

# Terminal 2 — React app
npm run dev:client
```

- Client → [http://localhost:5173](http://localhost:5173)
- Health → [http://localhost:3001/health](http://localhost:3001/health)

Allow **microphone** permission when prompted.

---

## Key features (technical depth)

### Emotionally adaptive seller
User language updates a session emotion (`neutral` | `interested` | `annoyed` | `defensive` | `warm`). That state is injected into the system prompt so David’s tone and willingness to negotiate change turn-by-turn.

### Streaming + barge-in
An `AbortController` is attached to each AI generation. When the client detects speech start during playback, it emits `barge_in`, the server aborts the stream, and the TTS queue is hard-cancelled — the hallmark of real voice agents.

### Incomplete utterance handling
Trailing conjunctions / ultra-short fragments trigger natural continuation prompts (“Yeah, go on.”) instead of hallucinating a full reply.

### Negotiation scoring
Ending a session evaluates:

| Dimension | Max |
|---|---|
| Persuasion | 25 |
| Clarity | 20 |
| Objection handling | 25 |
| Closing | 30 |
| Engagement | 10 |

Feedback is actionable (what worked, what to practice next).

### Graceful degradation
If OpenAI returns an error (e.g. billing), the engine falls back to an intent-matched mock seller so demos never hard-crash.

---

## API surface (high level)

| Channel | Event / Route | Purpose |
|---|---|---|
| REST | `GET /health` | Liveness + AI/TTS mode |
| REST | `POST /api/tts` | Optional server-side TTS |
| Socket | `voice_input` / `text_input` | User turn |
| Socket | `ai_thinking` / `ai_chunk` / `ai_sentence` / `ai_response_done` | Streaming reply |
| Socket | `barge_in` | Cancel generation |
| Socket | `emotion_update` | UI emotion badge |
| Socket | `end_session` → `score_result` | Performance report |

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `OPENAI_API_KEY` | backend | GPT-4o access |
| `USE_MOCK_AI` | backend | `true` = keyword mock (no OpenAI cost) |
| `TTS_ENGINE` | backend | `browser` \| `elevenlabs` |
| `ELEVENLABS_API_KEY` | backend | Optional premium voice |
| `PORT` | backend | Default `3001` |
| `VITE_SERVER_URL` | client | Backend origin (default `http://localhost:3001`) |

> Never commit real `.env` files. Only `.env.example` is tracked.

---

## Design decisions

- **Socket.IO over plain REST** — negotiation needs bidirectional push (chunks, emotion, barge-in).
- **Sentence-level TTS** — speak as soon as a sentence completes instead of waiting for the full reply.
- **In-memory sessions** — ideal for a training simulator; swap for Redis if you need multi-instance scale.
- **Mock fallback** — keeps portfolio demos alive when API quotas run out.

---

## Roadmap ideas

- [ ] Persist sessions + scores (Postgres / Redis)
- [ ] Multi-persona sellers (investor, NRI, first-time seller)
- [ ] Hindi–English code-mixed STT path
- [ ] Coach mode: live tip overlays during the call
- [ ] Deploy (Railway / Render + Vercel)

---

## License

MIT — see [LICENSE](./LICENSE).

---

<p align="center">
  <b>Built to show real-time AI product thinking — not just another chat wrapper.</b>
</p>
