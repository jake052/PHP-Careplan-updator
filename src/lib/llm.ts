import OpenAI from "openai";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.local.example.`,
    );
  }
  return value;
}

/**
 * Returns the configured LLM client and model name.
 *
 * Provider selection via LLM_PROVIDER env var:
 *   - "azure" (default, demo-ready): Azure OpenAI in UK South region.
 *   - "openai" (local testing only): standard OpenAI API.
 *
 * IMPORTANT: only use LLM_PROVIDER=openai with the fictional Sam dataset.
 * Real provider data MUST stay on Azure UK South.
 */
export function getLlmClient(): { client: OpenAI; model: string; provider: "azure" | "openai" } {
  const provider = (process.env.LLM_PROVIDER ?? "azure").toLowerCase();

  if (provider === "openai") {
    const apiKey = requireEnv("OPENAI_API_KEY");
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    const client = new OpenAI({ apiKey });
    return { client, model, provider: "openai" };
  }

  if (provider === "azure") {
    const endpoint = requireEnv("AZURE_OPENAI_ENDPOINT").replace(/\/$/, "");
    const apiKey = requireEnv("AZURE_OPENAI_API_KEY");
    const deployment = requireEnv("AZURE_OPENAI_DEPLOYMENT_NAME");
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
    });

    return { client, model: deployment, provider: "azure" };
  }

  throw new Error(
    `Unknown LLM_PROVIDER: "${provider}". Set LLM_PROVIDER=azure (production, recommended) or LLM_PROVIDER=openai (local testing only).`,
  );
}
