// ttsEngine.js — ElevenLabs streaming TTS for ultra-low latency

import dotenv from 'dotenv';
dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const USE_ELEVENLABS = ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== 'your_elevenlabs_api_key_here';

// A good male Indian English voice on ElevenLabs (or use any voice ID you prefer)
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // "Adam" - works well

export const TTS_ENGINE = process.env.TTS_ENGINE || 'browser'; // 'elevenlabs' | 'browser'

/**
 * Stream TTS audio from ElevenLabs
 * Returns Buffer of MP3 audio data
 * @param {string} text
 * @returns {Promise<Buffer|null>}
 */
export async function synthesizeSpeech(text) {
  if (!USE_ELEVENLABS || TTS_ENGINE !== 'elevenlabs') return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2', // Lowest latency model
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
          // Optimize for streaming
          optimize_streaming_latency: 3,
        }),
      }
    );

    if (!response.ok) {
      console.error('[TTS] ElevenLabs error:', response.status, await response.text());
      return null;
    }

    const chunks = [];
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c)));
  } catch (err) {
    console.error('[TTS] ElevenLabs failed:', err.message);
    return null;
  }
}

export { USE_ELEVENLABS };
