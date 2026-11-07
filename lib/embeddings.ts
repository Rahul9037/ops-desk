import {
  google,
  type GoogleEmbeddingModelOptions,
} from "@ai-sdk/google";
import { embed, embedMany } from "ai";

export const EMBEDDING_MODEL_ID = "gemini-embedding-2";
const DIMENSIONS = 768;

const model = google.embedding(EMBEDDING_MODEL_ID);

function googleOptions(
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): { google: GoogleEmbeddingModelOptions } {
  return {
    google: {
      taskType,
      outputDimensionality: DIMENSIONS,
    },
  };
}

export async function embedDocuments(
  values: string[],
  abortSignal?: AbortSignal,
): Promise<number[][]> {
  if (values.length === 0) return [];
  const result = await embedMany({
    model,
    values,
    dimensions: DIMENSIONS,
    abortSignal,
    providerOptions: googleOptions("RETRIEVAL_DOCUMENT"),
  });
  return result.embeddings;
}

export async function embedQuery(
  value: string,
  abortSignal?: AbortSignal,
): Promise<number[]> {
  const result = await embed({
    model,
    value,
    dimensions: DIMENSIONS,
    abortSignal,
    providerOptions: googleOptions("RETRIEVAL_QUERY"),
  });
  return result.embedding;
}
