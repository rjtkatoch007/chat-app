const { GoogleGenAI } = require("@google/genai");

let client;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini AI is not configured. Add GEMINI_API_KEY to backend/.env");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

async function generateSuggestions({ mode, text, recentMessages = [], style = "casual" }) {
  const ai = getClient();
  const context = recentMessages
    .filter((m) => m && typeof m.message === "string")
    .slice(-8)
    .map((m) => `${m.mine ? "Me" : "Other person"}: ${m.message.slice(0, 500)}`)
    .join("\n");
  const prompt = mode === "predict"
    ? `You power predictive typing in a private chat app. Suggest 3 short, natural continuations of the user's unfinished draft. Do not repeat the draft; each suggestion should be only the next word or a short phrase that can be appended to it. Use conversation context when relevant. Style: ${style}. Return ONLY valid JSON: {"suggestions":["...","...","..."]}.\nRecent conversation:\n${context || "(none)"}\nCurrent draft: ${text}`
    : `You suggest quick replies to an incoming chat message. Give exactly 3 short, distinct, context-aware responses the logged-in user could choose to send. Never assume facts or commit the user to plans; include a neutral option when context is uncertain. Match the user's requested style (${style}), use emojis only if natural, and keep each reply under 90 characters. Return ONLY valid JSON: {"replies":["...","...","..."]}.\nRecent conversation:\n${context || "(none)"}\nIncoming message: ${text}`;
  // Use Google's Interactions API with the current Gemini Flash model.
  // Keep output short and use low thinking effort to reduce chat suggestion latency.
  const response = await ai.interactions.create({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    input: prompt,
    generation_config: { thinking_level: "low" }
  });
  const outputText = response.output_text;
  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new Error("Gemini returned an empty response");
  }
  const parsed = extractJson(outputText);
  const key = mode === "predict" ? "suggestions" : "replies";
  if (!Array.isArray(parsed[key])) throw new Error("Unexpected Gemini response");
  const values = parsed[key]
    .filter((v) => typeof v === "string")
    .map((v) => v.trim().replace(/\s+/g, " "))
    .filter((v) => v && v.length <= 120)
    .slice(0, 3);
  if (!values.length) throw new Error("Gemini returned no suggestions");
  return values;
}

module.exports = { generateSuggestions };
