const { GoogleGenerativeAI } = require("@google/generative-ai");

async function call(prompt, systemInstruction, config) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: config.models.gemini,
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction,
  });

  const result = await model.generateContent(prompt);

  const usage = result.response.usageMetadata;
  if (usage) {
    console.log(
      `Token usage — prompt: ${usage.promptTokenCount}, ` +
      `response: ${usage.candidatesTokenCount}, ` +
      `total: ${usage.totalTokenCount}`
    );
  }

  return result.response.text().trim();
}

module.exports = { call };
