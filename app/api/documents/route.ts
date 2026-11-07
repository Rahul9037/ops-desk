import { ingestMarkdown } from "@/lib/ingest";
import { readLibrary } from "@/lib/store";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const library = await readLibrary();
  const counts = new Map<string, number>();
  for (const chunk of library.chunks) {
    counts.set(chunk.documentId, (counts.get(chunk.documentId) ?? 0) + 1);
  }
  return Response.json({
    documents: library.documents.map((document) => ({
      id: document.id,
      name: document.name,
      chunkCount: counts.get(document.id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return jsonError(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      500,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected a Markdown file upload.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("Choose a Markdown file.", 400);
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) {
    return jsonError("Upload a Markdown file (.md).", 400);
  }

  try {
    const markdown = await file.text();
    const saved = await ingestMarkdown(file.name, markdown, req.signal);
    return Response.json(saved);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not index that file.";
    const status = /empty|Markdown|no text/i.test(message) ? 400 : 500;
    return jsonError(
      status === 400
        ? message
        : "Could not index that file. Check GOOGLE_GENERATIVE_AI_API_KEY and try again.",
      status,
    );
  }
}
