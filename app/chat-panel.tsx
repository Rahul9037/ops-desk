"use client";

import { useChat } from "@ai-sdk/react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { SourceRef } from "@/lib/sources";

type LibraryDocument = {
  id: string;
  name: string;
  chunkCount: number;
};

function textFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function citationsFrom(metadata: unknown): SourceRef[] {
  if (!metadata || typeof metadata !== "object" || !("citations" in metadata)) {
    return [];
  }
  const citations = metadata.citations;
  if (!Array.isArray(citations)) return [];
  return citations.filter(
    (item): item is SourceRef =>
      !!item &&
      typeof item === "object" &&
      "label" in item &&
      typeof item.label === "string" &&
      "text" in item &&
      typeof item.text === "string",
  );
}

function CitedText({
  text,
  citations,
  onOpen,
}: {
  text: string;
  citations: SourceRef[];
  onOpen: (source: SourceRef) => void;
}) {
  const byLabel = new Map(citations.map((source) => [source.label, source]));
  const pieces = text.split(/(\[C\d+\])/g);
  return pieces.map((piece, index) => {
    const match = /^\[(C\d+)\]$/.exec(piece);
    const source = match ? byLabel.get(match[1]) : undefined;
    if (!match || !source) return <span key={index}>{piece}</span>;
    return (
      <button
        key={index}
        type="button"
        className="mx-0.5 inline rounded bg-user px-1 font-mono text-[11px] text-accent"
        onClick={() => onOpen(source)}
      >
        {source.label}
      </button>
    );
  });
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, stop, status, error, clearError } = useChat();
  const busy = status === "submitted" || status === "streaming";

  async function refreshDocuments() {
    const response = await fetch("/api/documents");
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "documents" in body &&
      Array.isArray(body.documents)
    ) {
      setDocuments(body.documents as LibraryDocument[]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const body: unknown = await response.json();
        if (
          cancelled ||
          !body ||
          typeof body !== "object" ||
          !("documents" in body) ||
          !Array.isArray(body.documents)
        ) {
          return;
        }
        setDocuments(body.documents as LibraryDocument[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, error, activeSource]);

  async function indexRequest(path: string, init?: RequestInit) {
    setIndexing(true);
    setLibraryError(null);
    try {
      const response = await fetch(path, { method: "POST", ...init });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "Could not index that document.";
        setLibraryError(message);
        return;
      }
      await refreshDocuments();
    } finally {
      setIndexing(false);
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    await indexRequest("/api/documents", { body: form });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    setInput("");
    await sendMessage({ text });
  }

  function onRetry() {
    clearError();
    void sendMessage();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={indexing}
                onClick={() => void indexRequest("/api/documents/sample")}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
              >
                {indexing ? "Indexing…" : "Load sample policy"}
              </button>
              <button
                type="button"
                disabled={indexing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Upload markdown
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown"
                className="sr-only"
                onChange={(event) => void onUpload(event)}
              />
            </div>
            {documents.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-xs text-muted">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="rounded-full border border-line bg-panel px-2 py-1"
                  >
                    {document.name} · {document.chunkCount} chunks
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">
                No documents yet. Load the sample policy or upload a .md file.
              </p>
            )}
            {libraryError ? (
              <p className="text-xs text-danger" role="alert">
                {libraryError}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Conversation"
        >
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-panel px-5 py-8 text-center">
              <p className="text-lg font-medium">Ask Ops Desk</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Load the sample shift-handoff policy, then ask about severity
                or handoff. Answers cite the passage they used.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const text = textFromParts(message.parts);
            const isUser = message.role === "user";
            const citations = citationsFrom(message.metadata);
            return (
              <article
                key={message.id}
                className={`mx-auto flex max-w-2xl ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    isUser
                      ? "bg-user whitespace-pre-wrap text-foreground"
                      : "border border-line bg-panel shadow-[var(--shadow)]"
                  }`}
                >
                  <p className="mb-1 font-mono text-[11px] tracking-wide text-muted uppercase">
                    {isUser ? "You" : "Ops Desk"}
                  </p>
                  {isUser ? (
                    text
                  ) : (
                    <CitedText
                      text={text || (busy ? "…" : "")}
                      citations={citations}
                      onOpen={setActiveSource}
                    />
                  )}
                  {citations.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {citations.map((source) => (
                        <button
                          key={source.label}
                          type="button"
                          className="rounded-full border border-line px-2 py-1 text-xs"
                          onClick={() => setActiveSource(source)}
                        >
                          {source.label} · {source.heading}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div
            className="mx-auto mb-3 w-full max-w-2xl rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger"
            role="alert"
          >
            <p>{error.message}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-full bg-danger px-3 py-1 text-xs font-medium text-white"
                onClick={onRetry}
              >
                Try again
              </button>
              <button
                type="button"
                className="rounded-full border border-danger/30 px-3 py-1 text-xs font-medium"
                onClick={() => clearError()}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="border-t border-line bg-panel px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <label className="sr-only" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              value={input}
              rows={2}
              placeholder="Ask about a handoff, incident, or shift note"
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-h-14 flex-1 resize-none rounded-2xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-accent disabled:opacity-60"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => stop()}
                className="h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={input.trim().length === 0}
                className="h-11 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
          <p
            className="mx-auto mt-2 max-w-2xl text-xs text-muted"
            aria-live="polite"
          >
            {status === "streaming"
              ? "Streaming"
              : status === "submitted"
                ? "Sending"
                : status === "error"
                  ? "Request failed"
                  : "Ready"}
          </p>
        </form>
      </section>

      {activeSource ? (
        <aside className="max-h-72 shrink-0 overflow-y-auto border-t border-line bg-panel px-4 py-4 md:max-h-none md:w-80 md:border-t-0 md:border-l">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-wide text-muted uppercase">
                {activeSource.label} · {activeSource.documentName}
              </p>
              <h2 className="mt-1 text-base font-semibold">
                {activeSource.heading}
              </h2>
            </div>
            <button
              type="button"
              className="text-xs text-muted"
              onClick={() => setActiveSource(null)}
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-sm leading-6">
            <mark className="rounded bg-[#f3e2a7] px-1 text-foreground">
              {activeSource.text}
            </mark>
          </p>
          <p className="mt-3 text-xs leading-5 text-muted">
            This is the stored passage the answer cited. It is not a guess
            from outside the uploaded notes.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
