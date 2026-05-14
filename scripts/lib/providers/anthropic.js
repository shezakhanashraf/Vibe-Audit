// Anthropic provider — requires ANTHROPIC_API_KEY env var and '@anthropic-ai/sdk' npm package.
// Install: npm install @anthropic-ai/sdk

async function call(prompt, systemInstruction, config) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

  let Anthropic;
  try {
    Anthropic = require("@anthropic-ai/sdk");
  } catch (_) {
    throw new Error(
      "The '@anthropic-ai/sdk' package is not installed. Run: npm install @anthropic-ai/sdk"
    );
  }

  const client = new Anthropic({ apiKey });

  const result = await client.messages.create({
    model: config.models.anthropic,
    max_tokens: 4096,
    system: systemInstruction,
    messages: [{ role: "user", content: prompt }],
  });

  const usage = result.usage;
  if (usage) {
    console.log(
      `Token usage — prompt: ${usage.input_tokens}, ` +
      `response: ${usage.output_tokens}`
    );
  }

  // Extract text from content blocks
  const text = result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip markdown fences if present (Anthropic doesn't have JSON mode)
  return text.replace(/```json\s*|```\s*/g, "").trim();
}

module.exports = { call };
