import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { embedQuery } from "@/lib/embeddings";
import { libraryIsEmpty, retrieveSources } from "@/lib/retrieve";
import { NO_SOURCE_REPLY, type OpsMetadata } from "@/lib/sources";

export const maxDuration = 30;

const MODEL_ID = "gemini-3.5-flash-lite";

type OpsMessage = UIMessage<OpsMetadata>;

function textError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function noSourceResponse() {
  const stream = createUIMessageStream({
    execute({ writer }) {
      const id = "no-source";
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: NO_SOURCE_REPLY });
      writer.write({ type: "text-end", id });
      writer.write({ type: "finish", finishReason: "stop" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  let messages: OpsMessage[];
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
    messages = body.messages as OpsMessage[];
  } catch {
    return textError("Invalid JSON body.", 400);
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return textError(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      500,
    );
  }

  const question = textOf(
    [...messages].reverse().find((message) => message.role === "user") ?? {
      id: "",
      role: "user",
      parts: [],
    },
  ).trim();
  if (!question) {
    return textError("Enter a question.", 400);
  }

  let citations: OpsMetadata["citations"] = [];
  try {
    if (!(await libraryIsEmpty())) {
      const queryEmbedding = await embedQuery(question, req.signal);
      citations = await retrieveSources(queryEmbedding);
    }
  } catch (error) {
    console.error(
      "Ops Desk retrieval failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return textError(
      "Could not search your documents. Check GOOGLE_GENERATIVE_AI_API_KEY and try again.",
      500,
    );
  }

  if (!citations || citations.length === 0) {
    return noSourceResponse();
  }

  const sourceBlock = citations
    .map(
      (source) =>
        `[${source.label}] ${source.documentName} — ${source.heading}\n${source.text}`,
    )
    .join("\n\n");

  const result = streamText({
    model: google(MODEL_ID),
    system: `You are Ops Desk, an internal operations copilot. Answer only from the sources below. After each claim, cite the source label in square brackets, such as [C1]. Use only the labels provided. If the sources do not contain the answer, say exactly: ${NO_SOURCE_REPLY} Do not guess or use outside knowledge.

Sources:
${sourceBlock}`,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: "minimal",
        },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      messageMetadata: ({ part }) =>
        part.type === "start" ? { citations } : undefined,
      onError: (error) => {
        console.error(
          "Ops Desk model request failed:",
          error instanceof Error ? error.message : "unknown error",
        );
        return "The model request failed. Check GOOGLE_GENERATIVE_AI_API_KEY and try again.";
      },
    }),
  });
}
