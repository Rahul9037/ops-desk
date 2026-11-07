"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

function textFromParts(
  parts: Array<{ type: string; text?: string }>,
): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, stop, status, error, clearError } = useChat();
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status, error]);

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
    <section className="flex min-h-0 flex-1 flex-col">
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
              One thread, streaming replies, and a stop control. Documents and
              tools are not wired up yet.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const text = textFromParts(message.parts);
          const isUser = message.role === "user";
          return (
            <article
              key={message.id}
              className={`mx-auto flex max-w-2xl ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                  isUser
                    ? "bg-user text-foreground"
                    : "border border-line bg-panel shadow-[var(--shadow)]"
                }`}
              >
                <p className="mb-1 font-mono text-[11px] tracking-wide text-muted uppercase">
                  {isUser ? "You" : "Ops Desk"}
                </p>
                {text || (busy && !isUser ? "…" : "")}
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
        <p className="mx-auto mt-2 max-w-2xl text-xs text-muted" aria-live="polite">
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
  );
}
