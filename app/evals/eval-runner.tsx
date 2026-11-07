"use client";

import { useState } from "react";
import cases from "@/evals/cases.json";
import {
  gradeCase,
  isKeyError,
  parseChatStream,
  type EvalExpect,
  type Grade,
} from "@/lib/eval-grade";

type CaseStatus = "waiting" | "running" | "done";

type Row = {
  id: string;
  prompt: string;
  expect: EvalExpect;
  status: CaseStatus;
  grade?: Grade;
};

const EXPECT_LABEL: Record<EvalExpect, string> = {
  citation: "Expect a citation",
  "no-source": "Expect the no-source refusal",
  handoff: "Expect a handoff card",
};

function waitingRows(): Row[] {
  return cases.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    expect: expectOf(item.expect),
    status: "waiting",
  }));
}

function expectOf(value: string): EvalExpect {
  if (value === "citation" || value === "no-source" || value === "handoff") {
    return value;
  }
  throw new Error(`Unknown eval expectation: ${value}`);
}

export function EvalRunner() {
  const [rows, setRows] = useState<Row[]>(waitingRows);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  async function onRun() {
    if (running) return;
    setRunning(true);
    setBlocked(null);
    setFinished(false);
    setRows(waitingRows());

    const sample = await fetch("/api/documents/sample", { method: "POST" });
    if (!sample.ok) {
      setBlocked(await errorMessage(sample));
      setRunning(false);
      return;
    }

    const next = waitingRows();
    for (let index = 0; index < next.length; index += 1) {
      next[index] = { ...next[index], status: "running" };
      setRows([...next]);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: next[index].id,
              role: "user",
              parts: [{ type: "text", text: next[index].prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const message = await errorMessage(response);
        if (isKeyError(message)) {
          setRows(waitingRows());
          setBlocked(message);
          setRunning(false);
          return;
        }
        next[index] = {
          ...next[index],
          status: "done",
          grade: { pass: false, reason: message },
        };
        setRows([...next]);
        continue;
      }

      const parsed = parseChatStream(await response.text());
      if ("error" in parsed) {
        if (isKeyError(parsed.error)) {
          setRows(waitingRows());
          setBlocked(parsed.error);
          setRunning(false);
          return;
        }
        next[index] = {
          ...next[index],
          status: "done",
          grade: { pass: false, reason: parsed.error },
        };
        setRows([...next]);
        continue;
      }

      next[index] = {
        ...next[index],
        status: "done",
        grade: gradeCase(next[index].expect, parsed),
      };
      setRows([...next]);
    }

    setFinished(true);
    setRunning(false);
  }

  const passed = rows.filter((row) => row.grade?.pass).length;
  const graded = rows.filter((row) => row.grade).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-muted">
          Loads the sample policy, then sends each case through the chat route.
        </p>
        <button
          type="button"
          onClick={() => void onRun()}
          disabled={running}
          className="h-11 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-40"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      {blocked ? (
        <p
          className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {blocked}
        </p>
      ) : null}

      {finished && !blocked ? (
        <p className="text-sm text-muted">
          {passed} of {graded} passed.
        </p>
      ) : null}

      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="rounded-2xl border border-line bg-panel px-4 py-3 shadow-[var(--shadow)]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[11px] tracking-wide text-muted uppercase">
                {index + 1}. {EXPECT_LABEL[row.expect]}
              </p>
              {row.grade ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.grade.pass
                      ? "bg-user text-accent"
                      : "bg-danger-bg text-danger"
                  }`}
                >
                  {row.grade.pass ? "Pass" : "Fail"}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted">
                  {row.status === "running" ? "Running" : "Not run"}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6">{row.prompt}</p>
            {row.grade ? (
              <p className="mt-2 text-sm leading-6 text-muted">{row.grade.reason}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

async function errorMessage(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  try {
    const body: unknown = JSON.parse(text);
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Plain-text error from the chat route.
  }
  return text || `Request failed (${response.status}).`;
}
