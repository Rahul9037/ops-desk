import { cosineSimilarity } from "./similarity";
import { readLibrary, type StoredChunk } from "./store";
import type { SourceRef } from "./sources";

const TOP_K = 3;
const MIN_SCORE = 0.5;

export async function retrieveSources(
  queryEmbedding: number[],
): Promise<SourceRef[]> {
  const library = await readLibrary();
  const ranked = library.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((item) => item.score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, TOP_K);

  return ranked.map((item, index) => toSource(item.chunk, index));
}

export async function libraryIsEmpty(): Promise<boolean> {
  const library = await readLibrary();
  return library.chunks.length === 0;
}

function toSource(chunk: StoredChunk, index: number): SourceRef {
  return {
    label: `C${index + 1}`,
    documentName: chunk.documentName,
    heading: chunk.heading,
    text: chunk.text,
  };
}
