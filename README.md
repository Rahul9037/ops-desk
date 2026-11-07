# Ops Desk

Real-time internal operations copilot. Milestone 1 is a single streaming chat thread: a message list, an input, a Stop control that aborts the response, and an error state when the request fails.

## Learning goal

This milestone is practice for the streaming chat loop a product engineer owns. The browser should show tokens as they arrive, the user should be able to stop a response, and a failed request should stay visible in the thread instead of disappearing. The OpenAI key stays on the server. Later milestones add retrieval, tools, and evals on this same shell.

## Run locally

Requires Node.js 22 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You must put your own OpenAI API key in `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

Restart `npm run dev` after you add or change the key. The key is read only by the server route. Do not commit `.env.local`.

Without a key, Send still reaches `/api/chat`, and the thread shows an error telling you the key is missing.

## Request path

The browser never talks to OpenAI. `useChat` posts the thread to the Next.js route, and that route calls the provider with `OPENAI_API_KEY`.

```text
Browser (message list, input, Stop)
  -> POST /api/chat          Next.js route handler
    -> OpenAI Responses API  model gpt-6-luna
      -> token stream back to the message list
```

`gpt-6-luna` is the current small, fast OpenAI chat model for high-volume work. The route sets `reasoningEffort` to `none` so the first tokens arrive without a reasoning delay. Stop aborts the browser request, and the route forwards that abort to the model call.
