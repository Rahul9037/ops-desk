# Ops Desk

Real-time internal operations copilot. Milestone 1 is a single streaming chat thread: a message list, an input, a Stop control that aborts the response, and an error state when the request fails.

## Learning goal

This milestone is practice for the streaming chat loop a product engineer owns. The browser should show tokens as they arrive, the user should be able to stop a response, and a failed request should stay visible in the thread instead of disappearing. The Gemini key stays on the server. Later milestones add retrieval, tools, and evals on this same shell.

## Run locally

Requires Node.js 22 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You must put your own Gemini API key in `.env.local`:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=
```

Create the key in [Google AI Studio](https://aistudio.google.com/apikey). Restart `npm run dev` after you add or change it. The key is read only by the server route. Do not commit `.env.local`.

Without a key, Send still reaches `/api/chat`, and the thread shows an error telling you the key is missing.

## Request path

The browser never talks to Google. `useChat` posts the thread to the Next.js route, and that route calls the Gemini API with `GOOGLE_GENERATIVE_AI_API_KEY`.

```text
Browser (message list, input, Stop)
  -> POST /api/chat          Next.js route handler
    -> Gemini API            model gemini-3.5-flash-lite
      -> each text chunk back to the message list
```

`gemini-3.5-flash-lite` is the current fastest Gemini Flash-Lite model, and its input and output tokens are free of charge on the Gemini API free tier (rate limits still apply). The route sets `thinkingLevel` to `minimal` so the model does not hold the reply for a reasoning pass. The chat route does not wait for the full answer: each provider text delta is written to the response as it arrives, and the UI leaves Sending on the first chunk. Stop aborts the browser request, and the route forwards that abort to the model call.
