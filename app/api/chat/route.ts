import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

const MODEL_ID = "gpt-6-luna";

function textError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  let messages: UIMessage[];
  try {
    const body: unknown = await req.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("messages" in body) ||
      !Array.isArray(body.messages)
    ) {
      return textError("Expected a messages array.", 400);
    }
    messages = body.messages as UIMessage[];
  } catch {
    return textError("Invalid JSON body.", 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return textError(
      "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      500,
    );
  }

  const result = streamText({
    model: openai(MODEL_ID),
    system:
      "You are Ops Desk, an internal operations copilot. Answer clearly and briefly. This milestone has no company documents, tools, or live systems. If the user asks you to look something up, say you cannot yet.",
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
    providerOptions: {
      openai: {
        reasoningEffort: "none",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        console.error(
          "Ops Desk model request failed:",
          error instanceof Error ? error.message : "unknown error",
        );
        return "The model request failed. Check OPENAI_API_KEY and try again.";
      },
    }),
  });
}
