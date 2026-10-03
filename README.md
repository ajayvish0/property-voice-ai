# Property Voice AI

### Real-time voice negotiation trainer

Practice closing a real-estate deal against **David** — an emotionally adaptive seller persona that listens, interrupts, and pushes back like a human. Built as a full-stack voice AI product: speech in, streaming intelligence out, scored performance at the end.

**Live demo:** [propvoice.netlify.app](https://propvoice.netlify.app/)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Groq](https://img.shields.io/badge/Groq-LLM-F55036)](https://groq.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)



 https://github.com/user-attachments/assets/594ead92-fd48-4086-a5df-8ab51f862aa6


 
---

## Why this project matters

Most chatbots wait for typed input. **Property Voice AI** models the harder problem: a live negotiation where latency, tone, interruption, and persuasion all matter.

| Capability | What it demonstrates |
|---|---|
| **Voice-first UX** | Browser Speech Recognition + TTS with sentence-level playback |
| **Streaming LLM** | Token streaming over Socket.IO for low perceived latency |
| **Barge-in** | User speech cancels the active AI stream mid-sentence |
| **Emotional state machine** | Seller mood shifts (neutral → interested → annoyed → defensive → warm) |
| **Performance scoring** | Post-session rubric: persuasion, clarity, objections, closing, engagement |
| **Production guards** | Per-IP rate limits, session turn caps, mock AI fallback when the provider is unavailable |

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
│  • SpeechSynthesis / audio │  ai_chunk / ai_sentence          │  • Streaming LLM replies   │
│  • Barge-in VAD            │  barge_in / score_result         │  • AbortController cancel  │
│  • Transcript + score UI   │                                  │  • Scoring + rate limits   │
└────────────────────────────┘                                  └─────────────┬──────────────┘
                                                                              │
                                                                              ▼
                                                                    Groq / OpenAI-compatible API
```

### Request lifecycle

1. Mic captures speech → final transcript emitted as `voice_input`
2. Server stores message, updates **emotion**, streams the LLM reply
3. Client receives `ai_chunk` / `ai_sentence` and speaks sentence-by-sentence
4. If the user starts talking again → `barge_in` aborts the stream + cancels TTS
5. `end_session` runs the scoring rubric and returns a breakdown

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Intelligence | Groq (OpenAI-compatible) streaming + emotion-aware system prompts |
| Speech | Web Speech API (STT/TTS) |
| State | In-memory session manager with UUID sessions |
| Deploy | Netlify (client) · Render (API) |

---

## Project structure

```
property-voice-ai/
├── backend/
│   ├── index.js             # Express + Socket.IO gateway
│   ├── aiEngine.js          # Streaming LLM, emotion prompts, mock fallback
│   ├── sessionManager.js    # Sessions + emotion transitions
│   ├── scoring.js           # Negotiation performance rubric
│   ├── rateLimit.js         # Per-IP / session demo guards
│   ├── ttsEngine.js         # Optional ElevenLabs synthesis
│   └── .env.example
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── hooks/useVoice.js
│   │   └── pages/
│   └── .env.example
├── netlify.toml
├── package.json
└── README.md
```

---

## Quick start

### Prerequisites

- **Node.js 18+**
- Chromium-based browser (best SpeechRecognition support)
- Free [Groq API key](https://console.groq.com/keys) *(or set `USE_MOCK_AI=true`)*

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/property-voice-ai.git
cd property-voice-ai
npm run install:all
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env → set GROQ_API_KEY

cp client/.env.example client/.env   # optional
```

Minimal `backend/.env`:

```env
PORT=3001
GROQ_API_KEY=gsk_...
USE_MOCK_AI=false
TTS_ENGINE=browser
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Run (two terminals)

```bash
npm run dev:server   # API + Socket.IO
npm run dev:client   # React app
```

- Client → [http://localhost:5173](http://localhost:5173)
- Health → [http://localhost:3001/health](http://localhost:3001/health)

Allow **microphone** permission when prompted.

---

## Deploy (Netlify + Render)

**Live API:** https://property-voice-ai.onrender.com/health

### A. Backend → [Render](https://render.com) (already live)

Root Directory = `backend`. Required env vars:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | from [console.groq.com/keys](https://console.groq.com/keys) |
| `CLIENT_ORIGIN` | `https://propvoice.netlify.app` |
| `TTS_ENGINE` | `browser` |
| `USE_MOCK_AI` | `false` |

### B. Frontend → [Netlify](https://netlify.com)

1. Import this GitHub repo
2. Leave **Base directory blank** (`netlify.toml` builds `client/` and sets `VITE_SERVER_URL`)
3. Deploy → allow microphone → talk to David
4. On Render set `CLIENT_ORIGIN=https://propvoice.netlify.app`, then redeploy the API if needed

If Groq quota is hit, the app falls back to the mock seller (`USE_MOCK_AI=true` kill switch on Render).

---

## Key features

### Emotionally adaptive seller
User language updates session emotion (`neutral` | `interested` | `annoyed` | `defensive` | `warm`). That state is injected into the system prompt so David’s tone and willingness to negotiate change turn-by-turn.

### Streaming + barge-in
An `AbortController` is attached to each AI generation. When the client detects speech during playback, it emits `barge_in`, the server aborts the stream, and the TTS queue is cancelled.

### Incomplete utterance handling
Trailing conjunctions and ultra-short fragments trigger continuation prompts (“Yeah, go on.”) instead of a full reply.

### Negotiation scoring

| Dimension | Max |
|---|---|
| Persuasion | 25 |
| Clarity | 20 |
| Objection handling | 25 |
| Closing | 30 |
| Engagement | 10 |

### Graceful degradation
Provider errors and rate limits fall back to an intent-matched mock seller so the demo stays usable.

---

## API surface

| Channel | Event / Route | Purpose |
|---|---|---|
| REST | `GET /health` | Liveness + AI/TTS mode |
| REST | `POST /api/tts` | Optional server-side TTS |
| Socket | `voice_input` / `text_input` | User turn |
| Socket | `ai_thinking` / `ai_chunk` / `ai_sentence` / `ai_response_done` | Streaming reply |
| Socket | `barge_in` | Cancel generation |
| Socket | `rate_limited` | Demo guard notice |
| Socket | `emotion_update` | UI emotion badge |
| Socket | `end_session` → `score_result` | Performance report |

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `GROQ_API_KEY` | backend | Groq API key |
| `OPENAI_API_KEY` | backend | Optional alt key if not using Groq |
| `OPENAI_BASE_URL` | backend | Defaults to Groq when `GROQ_API_KEY` is set |
| `OPENAI_MODEL` | backend | Default `qwen/qwen3.8-27b` on Groq |
| `USE_MOCK_AI` | backend | `true` = keyword mock (no API cost) |
| `CLIENT_ORIGIN` | backend | Comma-separated allowed frontend origins |
| `RATE_LIMIT_PER_IP` | backend | Turns per IP per window (default 30) |
| `MAX_TURNS_PER_SESSION` | backend | Max user turns per call (default 20) |
| `TTS_ENGINE` | backend | `browser` \| `elevenlabs` |
| `PORT` | backend | Default `3001` |
| `VITE_SERVER_URL` | client | Backend origin (production set in `netlify.toml`) |

> Never commit real `.env` files. Only `.env.example` is tracked.

---

## Design decisions

- **Socket.IO over REST** — negotiation needs bidirectional push (chunks, emotion, barge-in).
- **Sentence-level TTS** — speak as soon as a sentence completes instead of waiting for the full reply.
- **In-memory sessions** — fits a training simulator on a single server instance.
- **Mock fallback + rate limits** — keeps a public portfolio demo alive without unbounded provider spend.

---

## License

MIT — see [LICENSE](./LICENSE).
