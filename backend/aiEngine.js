// aiEngine.js — GPT-4o streaming with emotion injection + incomplete input detection

import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

export const USE_MOCK =
  process.env.USE_MOCK_AI === "true" ||
  !process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY === "your_openai_api_key_here";

let openai;
if (!USE_MOCK) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── INCOMPLETE INPUT DETECTION ───────────────────────────────────────────────
// Conservative check — only flag truly incomplete inputs
// We'd rather respond to a partial question than leave user hanging
export function isIncomplete(text) {
  const t = text.trim().toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);

  // Only 1-2 words with no real content
  if (words.length <= 2 && !/\?/.test(t)) return true;

  // Ends with ellipsis (explicit trailing off)
  if (t.endsWith("...")) return true;

  // Ends with a dangling conjunction — clearly mid-sentence
  if (/(,|and|but|or|because|so if|so that|which|who)$/.test(t)) return true;

  return false;
}

// Natural continuation prompts David uses when user seems incomplete
const CONTINUATION_PROMPTS = [
  "Yeah, go on.",
  "I'm listening.",
  "Mm-hmm?",
  "Sure, and?",
  "Right, okay...",
  "Yeah?",
];

export function getContinuationPrompt() {
  return CONTINUATION_PROMPTS[
    Math.floor(Math.random() * CONTINUATION_PROMPTS.length)
  ];
}

// ─── EMOTION → PROMPT INJECTION ───────────────────────────────────────────────
// Dynamically adds an emotional context line to the system prompt.
// This changes GPT's tone and response style without changing the character.
function getEmotionContext(emotion) {
  switch (emotion) {
    case "annoyed":
      return `\nCURRENT EMOTIONAL STATE: You are noticeably annoyed. The buyer is offering too low and it feels disrespectful. Keep responses SHORT and SHARP — 1 sentence max. No pleasantries.`;
    case "warm":
      return `\nCURRENT EMOTIONAL STATE: You are feeling warm and positive toward this buyer. They seem serious and respectful. You can be a little more open and friendly. Still brief, but less guarded.`;
    case "interested":
      return `\nCURRENT EMOTIONAL STATE: You are genuinely curious about this buyer. They are asking thoughtful questions and you want to understand them better. Ask a follow-up question back.`;
    case "defensive":
      return `\nCURRENT EMOTIONAL STATE: You are getting a bit defensive — too many questions without any offer. Respond cautiously. You can ask: "Are you actually serious about buying, or just browsing?"`;
    case "neutral":
    default:
      return `\nCURRENT EMOTIONAL STATE: Neutral. Professional but casual. Normal conversation pace.`;
  }
}

// ─── BASE SYSTEM PROMPT ───────────────────────────────────────────────────────
const BASE_PROMPT = `You are David, a real person who owns a 2BHK apartment in Andheri West, Mumbai.
You are on a phone call with someone who wants to buy your flat.

YOUR FLAT:
- Location: Andheri West, Mumbai (5 min walk to metro)
- Price: ₹80 Lakhs (your asking price)
- Type: 2BHK, ~750 sq ft, 7th floor
- Condition: Good. Kitchen fully renovated last year. Gated society, 24hr security.
- Society maintenance: ₹3,000/month
- Why selling: Relocating to Pune for family reasons

YOUR PERSONALITY:
- You are a real person, not a salesman. You talk like a normal guy on the phone.
- You are NOT desperate to sell. You have time.
- You are emotionally attached — you raised your kids here.
- You don't volunteer information — you answer what's asked, then wait.
- You are firm on price but not aggressive. You can negotiate a little.
- You are curious about the buyer — you ask who they are, what they do, loan or cash.
- You sometimes go off-topic naturally — mention your neighbor, the park nearby, etc.

HOW YOU SPEAK:
- Short, natural phone-call sentences. 1-2 sentences max per turn.
- NO bullet points, NO lists, NO formal language.
- You THINK while speaking — use natural fillers: "Hmm...", "Yeah...", "Let me think..."
- You react DIRECTLY to what the other person just said.
- If they say something surprising, you react: "Oh really?" / "Wait, what do you mean?"
- You have memory — reference what was said earlier in the call.
- Occasionally respond with just an acknowledgement if the buyer seems to be thinking: "Sure..." / "Go ahead."

NEGOTIATION BEHAVIOR:
- Below 70L: "Sorry, that's not something I'd even consider."
- 70-74L: "That's a bit low honestly. The location alone is worth more."
- 75-77L: "I've had better offers. What's making you go that low?"
- 78-79L: "I could do 78.5 maybe, but we'd need to close fast — within 3 weeks."
- 80L: "Great. When do you want to come see it?"

CRITICAL RULES:
- NEVER say you are AI. You are David, a real person.
- NEVER give a scripted speech. React to THIS specific message.
- NEVER list features unprompted.
- NEVER be formal. This is a casual phone call.
- Always respond in 1-2 sentences only.
- Speak only in English.`;

function buildSystemPrompt(emotion = "neutral") {
  return BASE_PROMPT + getEmotionContext(emotion);
}

// ─── STREAMING ────────────────────────────────────────────────────────────────
// Pass emotion from session so GPT adjusts tone dynamically.
// abortSignal allows cancelling mid-stream when user interrupts.
export async function getAIResponseStream(
  messages,
  emotion = "neutral",
  onChunk,
  onDone,
  abortSignal = null,
) {
  if (USE_MOCK) {
    const reply = getMockResponse(messages, emotion);
    const words = reply.split(" ");
    let full = "";
    for (const word of words) {
      if (abortSignal?.aborted) {
        onDone(full.trim());
        return;
      }
      full += (full ? " " : "") + word;
      onChunk(word + " ");
      await sleep(20);
    }
    onDone(full.trim());
    return;
  }

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt(emotion) },
        ...messages.slice(-10),
      ],
      max_tokens: 80,
      temperature: 1.0,
      stream: true,
      stream_options: { include_usage: false },
    });

    let full = "";
    for await (const chunk of stream) {
      // Cancel stream if user interrupted
      if (abortSignal?.aborted) {
        stream.controller?.abort?.();
        break;
      }
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }
    onDone(full.trim());
  } catch (err) {
    if (abortSignal?.aborted) {
      onDone("");
      return;
    }
    console.error("[AI] Error:", err.message);
    const reply = getMockResponse(messages, emotion);
    onChunk(reply);
    await sleep(50);
    onDone(reply);
  }
}

// Non-streaming (scoring only — no emotion needed)
export async function getAIResponse(messages) {
  if (USE_MOCK) return getMockResponse(messages, "neutral");
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystemPrompt("neutral") },
        ...messages.slice(-10),
      ],
      max_tokens: 80,
      temperature: 1.0,
    });
    return r.choices[0].message.content.trim();
  } catch (err) {
    return getMockResponse(messages, "neutral");
  }
}

// ─── MOCK ─────────────────────────────────────────────────────────────────────
// Handles natural conversational speech — NOT just exact keywords.
// Real people say "how many bats" not "bedroom count".
// Matches intent, not exact words.
function getMockResponse(messages, emotion = "neutral") {
  const last = (messages.at(-1)?.content || "").toLowerCase().trim();
  const count = messages.filter((m) => m.role === "user").length;

  // ── Opening (count 0 = no user messages yet, handled by server opener) ──
  if (count === 0)
    return "Yeah hi — you called about the Andheri flat? It's a 2BHK, 80 lakhs. What did you want to know?";

  // ── Emotion-overridden responses ────────────────────────────────────────
  if (emotion === "annoyed" && /\b[456]\d\b|\b7[0-2]\b/.test(last))
    return "Look, that's nowhere close to what I'm asking. I'd rather take it off the market.";
  if (emotion === "warm" && /deal|agree|token|advance|serious/.test(last))
    return "Yeah, I like your approach. Let's get this done — I'll call my lawyer today.";
  if (emotion === "defensive")
    return "Look, are you actually serious about buying or just checking things out?";

  // ── Greetings ────────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(last))
    return "Hey! Yeah so you saw the listing — what did you want to know about it?";

  // ── Bedroom / bathroom / rooms (handles typos like "bats") ──────────────
  // "how many bats" "how many bedrooms" "bats and bathroom" "rooms" "bhk"
  if (
    /\b(bed|bath|bats|bat|room|rooms|bhk|rk|toilet|washroom|bedroom|bathroom)\b/.test(
      last,
    ) ||
    /how many.*(have|got|there|floor|it)/.test(last)
  )
    return "It's a 2BHK — two bedrooms and two bathrooms. Good-sized rooms, especially the master.";

  // ── How many offers / interest level ─────────────────────────────────────
  if (
    /how many.*(offer|interest|inquir|people|buyer|call|bid)/.test(last) ||
    /offer.*(get|got|receiv|have)/.test(last)
  )
    return "I've had a few serious inquiries. One was at 78 which I turned down. Right now I'm talking to two people including you.";

  // ── General "tell me about it" / describe it ─────────────────────────────
  if (
    /tell me|about it|describe|overview|details|all about|everything/.test(
      last,
    ) ||
    /what.*(have|got|include)/.test(last)
  )
    return "It's a 2BHK on the 7th floor — 750 square feet, west-facing, renovated kitchen. Gated society, metro is 5 minutes away. Pretty much move-in ready.";

  // ── Price / asking / expected / what do you want ─────────────────────────
  if (
    /what.*(price|cost|ask|want|expect|rate|value|much)/.test(last) ||
    /price|asking|expected|how much/.test(last)
  )
    return "80 lakhs is what I'm asking. It's fair for the location — metro access alone adds value.";

  // ── Price offers ──────────────────────────────────────────────────────────
  if (/\b4\d\b|\b5\d\b|\b6\d\b/.test(last))
    return "That's way too low honestly. Not even in the ballpark.";
  if (/\b7[0-2]\b/.test(last))
    return "70 won't work. The location alone justifies more than that.";
  if (/\b7[3-4]\b/.test(last))
    return "73 or 74... that's still on the lower side. I've had better offers.";
  if (/\b7[5-6]\b/.test(last))
    return "75 is a stretch. What's making you go that low — is it the loan amount?";
  if (/\b7[7-8]\b/.test(last))
    return "78 I could consider, but only if we close within 3 weeks. Is that workable?";
  if (/\b79\b/.test(last)) return "79.5 and we wrap this up this week — deal.";
  if (/\b80\b/.test(last))
    return "Perfect, that works. When can you come for a visit?";

  // ── Budget question ───────────────────────────────────────────────────────
  if (/budget|afford|max|limit|range|how much.*(spend|pay|budget)/.test(last))
    return "Well what's your budget? That'll help me understand if we're even in the same range.";

  // ── Location / where is it ────────────────────────────────────────────────
  if (
    /where|locat|address|area|place|which part|andheri|mumbai|suburb/.test(last)
  )
    return "Andheri West — very central. The metro station is 5 minutes on foot and you've got D-Mart, hospitals, schools all nearby.";

  // ── Size / square feet ────────────────────────────────────────────────────
  if (/size|sq\s*ft|square|area|how big|carpet|built.up|sqft/.test(last))
    return "About 750 square feet. Feels bigger though — good ceiling height, west-facing so nice ventilation.";

  // ── Floor ─────────────────────────────────────────────────────────────────
  if (/floor|level|storey|story|high|lift|elevator/.test(last))
    return "Seventh floor. Lift works reliably — rarely breaks down. Good views from up there.";

  // ── View / facing direction ───────────────────────────────────────────────
  if (
    /view|facing|direction|east|west|north|south|window|balcon|light/.test(last)
  )
    return "West-facing, so you get really nice evening light. You can see the society garden from the balcony.";

  // ── Kitchen ───────────────────────────────────────────────────────────────
  if (/kitchen|cook|modular|fitting|applianc/.test(last))
    return "Fully redone last year — modular kitchen, new fittings, good counter space. My wife made sure of that.";

  // ── Parking ───────────────────────────────────────────────────────────────
  if (/park|car|vehicle|garage|spot|bike|two.wheel/.test(last))
    return "One covered parking spot comes with it. There's also visitor parking in the society.";

  // ── Society / building ────────────────────────────────────────────────────
  if (/societ|building|complex|compound|gat|secur|guard|watch/.test(last))
    return "Gated society with 24-hour security. Well-maintained, mostly families. Very peaceful vibe.";

  // ── Maintenance ───────────────────────────────────────────────────────────
  if (/maintenanc|charges|fees|monthly|cost|expense/.test(last))
    return "About 3,000 a month for maintenance. That covers everything — security, lift, common areas.";

  // ── Age of building ───────────────────────────────────────────────────────
  if (/old|age|year|built|construct|new|how long/.test(last))
    return "Building is about 15 years old but very well-maintained. No structural issues. We've kept it in great shape.";

  // ── Possession / ready to move ────────────────────────────────────────────
  if (/possess|ready|move|when|vacant|empty|availab|handover/.test(last))
    return "It's vacant right now, so possession is immediate the moment we close the deal.";

  // ── Loan / bank ───────────────────────────────────────────────────────────
  if (/loan|bank|emi|home loan|financ|mortgage|hdfc|sbi|icici/.test(last))
    return "Loan is fine, no problem. But I'd need registration done within 45 days — can't wait longer than that.";

  // ── Cash buyer ────────────────────────────────────────────────────────────
  if (/cash|full payment|direct|no loan|own fund/.test(last))
    return "Cash buyer? That actually helps a lot on timeline. What kind of price are you thinking?";

  // ── Investment / rental ───────────────────────────────────────────────────
  if (/invest|rental|rent|yield|return|tenant|income/.test(last))
    return "Good investment honestly — rental in this area runs 22 to 25k a month. Lots of working professionals looking here.";

  // ── Visit / come see ─────────────────────────────────────────────────────
  if (/visit|come|see|view|look|inspect|site|show/.test(last))
    return "Sure, weekends work best for me. Saturday or Sunday around 11 AM — does that work?";

  // ── Closing / deal ────────────────────────────────────────────────────────
  if (/deal|done|agree|finaliz|book|advance|token|confirm|proceed/.test(last))
    return "Alright, let's do it. Bring a lakh as token and we'll get the agreement signed. My lawyer is ready.";

  // ── Why selling ───────────────────────────────────────────────────────────
  if (/why.*(sell|selling)|reason|moving|relocat|leaving|shift/.test(last))
    return "We're moving to Pune — my parents need us there. It's not easy to leave this place but that's life.";

  // ── Neighbors / environment ───────────────────────────────────────────────
  if (
    /neighbor|neighbour|people|who live|community|noise|quiet|environment/.test(
      last,
    )
  )
    return "Really good neighbors — retired couple on one side, young family on the other. Very peaceful, no issues.";

  // ── Schools / education ───────────────────────────────────────────────────
  if (/school|college|kid|child|education|learn/.test(last))
    return "Two good schools within walking distance. That was actually important for us when we moved in.";

  // ── Hospital / medical ────────────────────────────────────────────────────
  if (/hospital|clinic|doctor|medical|health|emergenc/.test(last))
    return "Kokilaben is about 15 minutes by auto. Lilavati is not far either. Good medical access.";

  // ── Transport / connectivity ──────────────────────────────────────────────
  if (/transport|bus|train|auto|metro|connect|commut|travel|highway/.test(last))
    return "Metro is 5 minutes on foot, that's the biggest advantage. Also good bus connectivity and close to the highway.";

  // ── Urgency ───────────────────────────────────────────────────────────────
  if (/urgent|hurry|rush|desperate|quick|fast|time|deadline/.test(last))
    return "No rush on my side. I'll wait for the right person at the right price.";

  // ── Negotiation / discount ────────────────────────────────────────────────
  if (/negotiat|discoun|reduce|lower|come down|flex|budge/.test(last))
    return "I can move a little if the buyer is serious and can close fast. What are you thinking?";

  // ── Small talk ────────────────────────────────────────────────────────────
  if (/how are you|how's it|what do you do|yourself/.test(last))
    return "I'm good, thanks for asking. I work in pharma, been in Mumbai 15 years. But tell me — are you looking to live here or invest?";

  // ── Natural follow-up questions that don't fit above ─────────────────────
  // "I'll go through it again" type unclear inputs
  if (
    /go (through|over|back)|again|repeat|clarif|say that|mean|understand/.test(
      last,
    )
  )
    return "Sure, happy to clarify. What specifically did you want to know?";

  if (/okay|ok|alright|fine|sure|go ahead|yes|yeah/.test(last))
    return "Great. So what else would you like to know about the place?";

  if (/no|not interested|don't think|pass|skip/.test(last))
    return "Fair enough. Is there something specific that's putting you off, or is it mainly the price?";

  // ── True fallbacks — context-aware, never repeat ─────────────────────────
  const recentAI = messages
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => m.content);
  const fallbacks = [
    "What specifically would you like to know?",
    "Is there something particular you're concerned about?",
    "What's your main priority — location, size, or price?",
    "Are you planning to live here yourself or is it for investment?",
    "What's your timeline for making a decision?",
    "Have you seen other properties in this range?",
    "Is it just you or are you buying with family?",
  ].filter(
    (f) =>
      !recentAI.some((a) => a.includes(f.split(" ").slice(0, 3).join(" "))),
  );

  return (
    fallbacks[Math.floor(Math.random() * fallbacks.length)] ||
    "What else would you like to know about the flat?"
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
export { USE_MOCK as isMock };
