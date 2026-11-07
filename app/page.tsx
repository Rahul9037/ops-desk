import { ChatPanel } from "./chat-panel";

export default function Home() {
  return (
    <main className="flex h-dvh flex-col">
      <header className="border-b border-line bg-panel px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
              Internal ops
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Ops Desk</h1>
          </div>
          <p className="text-right text-xs text-muted">
            Cited answers from your notes
          </p>
        </div>
      </header>
      <ChatPanel />
    </main>
  );
}
