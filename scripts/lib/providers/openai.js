// OpenAI provider — requires OPENAI_API_KEY env var and 'openai' npm package.
// Install: npm install openai

async function call(prompt, systemInstruction, config) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  let OpenAI;
  try {
    OpenAI = require("openai");
  } catch (_) {
    throw new Error(
      "The 'openai' package is not installed. Run: npm install openai"
    );
  }

  const client = new OpenAI({ apiKey });

  const result = await client.chat.completions.create({
    model: config.models.openai,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ],
  });

  const usage = result.usage;
  if (usage) {
    console.log(
      `Token usage — prompt: ${usage.prompt_tokens}, ` +
      `response: ${usage.completion_tokens}, ` +
      `total: ${usage.total_tokens}`
    );
  }

  return result.choices[0].message.content.trim();
}

module.exports = { call };
