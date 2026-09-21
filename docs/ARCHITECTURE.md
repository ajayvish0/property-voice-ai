# Architecture

This document expands on the system design for contributors and technical interviewers.

## Components

| Module | Responsibility |
|---|---|
| `backend/index.js` | HTTP + Socket.IO gateway, session lifecycle, stream orchestration |
| `backend/aiEngine.js` | Prompt construction, GPT-4o streaming, incomplete-input detection, mock fallback |
| `backend/sessionManager.js` | In-memory sessions; emotion transitions from user utterances |
| `backend/scoring.js` | Rubric-based evaluation after `end_session` |
| `backend/ttsEngine.js` | Optional ElevenLabs MP3 synthesis |
| `client/src/hooks/useVoice.js` | STT, TTS queue, barge-in, Socket.IO client state |
| `client/src/pages/*` | Home brief → live call → score report |

## Emotion model

```
                 low offer
    ┌──────────────────────────► annoyed
    │
neutral ──personal interest───► interested
    │
    ├── many questions, no offer ► defensive
    │
    └── strong offer / close ───► warm
```

Emotion is appended to the system prompt each turn so the model’s tone tracks negotiation pressure.

## Concurrency & cancellation

- One `AbortController` per active generation per socket
- `barge_in` or a new user turn aborts the previous controller
- Client cancels `speechSynthesis` and clears the TTS queue in parallel

## Failure modes

| Failure | Behavior |
|---|---|
| Missing / placeholder OpenAI key | `USE_MOCK` path |
| OpenAI 4xx/5xx mid-stream | Catch → `getMockResponse` |
| ElevenLabs unavailable | Return `null` audio; client uses browser TTS |
| Incomplete user fragment | Continuation prompt; no LLM call |

## Scaling notes

Current store is process-local `Map`. For horizontal scale:

1. Move sessions to Redis
2. Sticky Socket.IO sessions or Redis adapter
3. Rate-limit `voice_input` per IP / session
