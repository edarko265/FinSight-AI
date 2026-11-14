import { loadEnv } from "./load-env";

loadEnv();

/**
 * Creates the ElevenLabs voice agent used for realtime calls with the coach.
 *
 *   pnpm voice:setup                 creates the client tool and the agent
 *   pnpm voice:setup --tool <id>     reuses an existing client tool
 *
 * The agent does no financial reasoning of its own. It has one tool,
 * `ask_finsight`, which runs in the customer's browser and calls our own
 * coach, so every figure it speaks comes from the same calculations as the
 * chat. Put the printed agent id in ELEVENLABS_AGENT_ID.
 */
const API = "https://api.elevenlabs.io/v1/convai";

const PROMPT = [
  "You are FinSight, a warm and concise personal finance coach speaking with a bank customer on a voice call.",
  "You cannot see the customer's data yourself. For anything about their money, spending, balance, bills, savings, goals, comparisons or advice, call the ask_finsight tool with their question, then say its answer naturally in the customer's language.",
  "Never invent or estimate amounts. Only say figures that ask_finsight returned, exactly as given.",
  "Keep spoken replies short: one to three sentences. Do not read lists or symbols aloud.",
  "If the tool fails, say you could not reach their data and ask them to try again.",
  "Do not give investment, credit or tax advice; offer to connect them with a human adviser instead.",
  "Speak the language the customer speaks: English, Finnish or Swedish.",
].join(" ");

const FIRST_MESSAGE = {
  en: "Hi, I'm your FinSight coach. What would you like to know about your money?",
  fi: "Hei, olen FinSight-valmentajasi. Mitä haluaisit tietää raha-asioistasi?",
  sv: "Hej, jag är din FinSight-coach. Vad vill du veta om din ekonomi?",
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

async function main(): Promise<void> {
  const toolId =
    arg("tool") ??
    String(
      (
        await post("/tools", {
          tool_config: {
            type: "client",
            name: "ask_finsight",
            description:
              "Answers any question about the customer's own money: spending, balance, safe to spend, savings goals, comparisons and advice. Always call this before answering a money question.",
            parameters: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "The customer's question, in their own words and language",
                },
              },
              required: ["question"],
            },
            expects_response: true,
            response_timeout_secs: 25,
          },
        })
      ).id,
    );

  const preset = (language: "fi" | "sv") => ({
    overrides: { agent: { first_message: FIRST_MESSAGE[language], language } },
  });
  const agent = await post("/agents/create", {
    name: "FinSight coach",
    conversation_config: {
      agent: {
        first_message: FIRST_MESSAGE.en,
        language: "en",
        prompt: { prompt: PROMPT, llm: arg("llm") ?? "gemini-2.5-flash", tool_ids: [toolId] },
      },
      // No model is forced: the platform default speaks all three languages. Pass --tts to override.
      tts: { model_id: arg("tts"), voice_id: process.env.ELEVENLABS_VOICE_ID || undefined },
      language_presets: { fi: preset("fi"), sv: preset("sv") },
    },
    platform_settings: {
      // Calls need a signed address from our server; the agent cannot be used with its id alone.
      auth: { enable_auth: true },
      overrides: {
        conversation_config_override: { agent: { language: true, first_message: true } },
      },
    },
  });
  console.log(`Tool:  ${toolId}`);
  console.log(`Agent: ${String(agent.agent_id)}`);
  console.log("Add to .env.local:  ELEVENLABS_AGENT_ID=" + String(agent.agent_id));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
