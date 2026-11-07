import { readFile } from "node:fs/promises";
import path from "node:path";
import { ingestMarkdown } from "@/lib/ingest";

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error:
          "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  try {
    const markdown = await readFile(
      path.join(process.cwd(), "samples", "shift-handoff-policy.md"),
      "utf8",
    );
    const saved = await ingestMarkdown(
      "shift-handoff-policy.md",
      markdown,
      req.signal,
    );
    return Response.json(saved);
  } catch (error) {
    console.error(
      "Ops Desk sample index failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      {
        error:
          "Could not index the sample policy. Check GOOGLE_GENERATIVE_AI_API_KEY and try again.",
      },
      { status: 500 },
    );
  }
}
