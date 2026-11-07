export type MarkdownChunk = {
  heading: string;
  text: string;
};

const MAX_CHARS = 800;

export function chunkMarkdown(markdown: string): MarkdownChunk[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections: MarkdownChunk[] = [];
  let heading = "Document";
  let body: string[] = [];

  const flush = () => {
    const text = body.join("\n").trim();
    body = [];
    if (!text) return;
    sections.push(...splitLong(heading, text));
  };

  for (const line of normalized.split("\n")) {
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      heading = match[2];
      continue;
    }
    body.push(line);
  }
  flush();
  return sections;
}

function splitLong(heading: string, text: string): MarkdownChunk[] {
  if (text.length <= MAX_CHARS) return [{ heading, text }];

  const chunks: MarkdownChunk[] = [];
  let current = "";
  for (const paragraph of text.split(/\n\n+/)) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > MAX_CHARS && current) {
      chunks.push({ heading, text: current.trim() });
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push({ heading, text: current.trim() });

  return chunks.flatMap((chunk) =>
    chunk.text.length <= MAX_CHARS * 1.5
      ? [chunk]
      : hardSplit(chunk.heading, chunk.text),
  );
}

function hardSplit(heading: string, text: string): MarkdownChunk[] {
  const chunks: MarkdownChunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + MAX_CHARS, text.length);
    chunks.push({ heading, text: text.slice(start, end).trim() });
    if (end === text.length) break;
    start = end - 80;
  }
  return chunks.filter((chunk) => chunk.text.length > 0);
}
