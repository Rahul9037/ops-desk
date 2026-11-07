import { randomUUID } from "node:crypto";
import { chunkMarkdown } from "./chunk";
import { embedDocuments } from "./embeddings";
import { updateLibrary, type StoredChunk } from "./store";

const MAX_CHARS = 200_000;

export function safeDocumentName(name: string): string {
  const base = name.split(/[/\\]/).pop()?.trim() || "notes.md";
  const cleaned = base.replace(/[^\w.\- ]+/g, "").trim();
  return cleaned.toLowerCase().endsWith(".md") ? cleaned : `${cleaned}.md`;
}

export async function ingestMarkdown(
  name: string,
  markdown: string,
  abortSignal?: AbortSignal,
): Promise<{ name: string; chunkCount: number }> {
  const documentName = safeDocumentName(name);
  const text = markdown.replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new Error("That file is empty.");
  }
  if (text.length > MAX_CHARS) {
    throw new Error("Markdown files must be under 200,000 characters.");
  }

  const pieces = chunkMarkdown(text);
  if (pieces.length === 0) {
    throw new Error("That file has no text to index.");
  }

  const embeddings = await embedDocuments(
    pieces.map((piece) => `${documentName}\n${piece.heading}\n\n${piece.text}`),
    abortSignal,
  );
  const documentId = randomUUID();
  const createdAt = new Date().toISOString();
  const chunks: StoredChunk[] = pieces.map((piece, index) => ({
    id: randomUUID(),
    documentId,
    documentName,
    heading: piece.heading,
    text: piece.text,
    embedding: embeddings[index] ?? [],
  }));

  await updateLibrary((library) => {
    const removedIds = new Set(
      library.documents
        .filter((document) => document.name === documentName)
        .map((document) => document.id),
    );
    return {
      documents: [
        ...library.documents.filter((document) => !removedIds.has(document.id)),
        { id: documentId, name: documentName, createdAt },
      ],
      chunks: [
        ...library.chunks.filter((chunk) => !removedIds.has(chunk.documentId)),
        ...chunks,
      ],
    };
  });

  return { name: documentName, chunkCount: chunks.length };
}
