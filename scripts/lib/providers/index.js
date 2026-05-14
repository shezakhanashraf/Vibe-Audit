const gemini = require("./gemini");
const openai = require("./openai");
const anthropic = require("./anthropic");

const providers = { gemini, openai, anthropic };

async function callWithRetry(provider, prompt, systemInstruction, config, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await provider.call(prompt, systemInstruction, config);
    } catch (err) {
      lastErr = err;
      const msg = err.message || "";
      // Don't retry on auth or client errors
      if (
        msg.includes("API_KEY_INVALID") ||
        msg.includes("invalid_api_key") ||
        msg.includes("authentication_error") ||
        msg.includes("400") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        throw err;
      }
      const wait = 1000 * Math.pow(2, i);
      console.log(`Attempt ${i + 1}/${attempts} failed: ${err.message}. Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function analyze(prompt, systemInstruction, config) {
  const providerName = config.provider;
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown provider "${providerName}". Supported: ${Object.keys(providers).join(", ")}`
    );
  }

  console.log(`Using provider: ${providerName} (${config.models[providerName]})`);
  return callWithRetry(provider, prompt, systemInstruction, config);
}

module.exports = { analyze };
