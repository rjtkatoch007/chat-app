const { generateSuggestions } = require("../services/aiSuggestions");

const aiSuggestions = async (req, res) => {
  try {
    const mode = req.body.mode === "replies" ? "replies" : "predict";
    const text = typeof req.body.text === "string" ? req.body.text.trim().slice(0, 1200) : "";
    if (!text || text.length < (mode === "predict" ? 3 : 1)) {
      return res.status(400).json({ message: "Enter a little more text first" });
    }
    const style = ["casual", "friendly", "professional", "emoji"].includes(req.body.style)
      ? req.body.style : "casual";
    const recentMessages = Array.isArray(req.body.recentMessages)
      ? req.body.recentMessages.slice(-8).map((m) => ({
          mine: Boolean(m?.mine),
          message: typeof m?.message === "string" ? m.message.slice(0, 500) : ""
        }))
      : [];
    const suggestions = await generateSuggestions({ mode, text, recentMessages, style });
    return res.json(mode === "predict" ? { suggestions } : { replies: suggestions });
  } catch (error) {
    console.error("Gemini suggestions error:", error.message);
    const status = error.message.includes("not configured") ? 503 : 502;
    return res.status(status).json({
      message: status === 503 ? "AI suggestions are not configured on the server" : "Gemini could not generate suggestions right now"
    });
  }
};

module.exports = { aiSuggestions };
