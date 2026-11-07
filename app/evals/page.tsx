import Link from "next/link";
import { EvalRunner } from "./eval-runner";

export default function EvalsPage() {
  return (
    <main className="min-h-dvh">
      <header className="border-b border-line bg-panel px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
              Internal ops
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Evals</h1>
          </div>
          <Link href="/" className="text-xs text-muted underline">
            Back to chat
          </Link>
        </div>
      </header>
      <EvalRunner />
    </main>
  );
}
