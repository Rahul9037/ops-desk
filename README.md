# Ops Desk

Real-time internal operations copilot. The chat streams from Gemini, and answers can cite passages from Markdown you upload.

## Learning goal

This app is practice for the streaming chat loop a product engineer owns, then for grounding that loop in a document. The browser should show tokens as they arrive, the user should be able to stop a response, and a failed request should stay visible in the thread. When a question depends on company notes, the answer should point at the passage it used, and it should say so when it has no source. The Gemini key stays on the server.

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

## Upload a note and read a citation

1. Start the app with `GOOGLE_GENERATIVE_AI_API_KEY` set.
2. Click **Load sample policy**, or upload your own `.md` file. The sample is `samples/shift-handoff-policy.md`.
3. Ask something the note covers, such as when a Sev-1 pages the incident commander.
4. The reply streams with labels like `[C1]`. Click a label, or the source chip under the message, to open that passage in the side panel. The highlighted text is the stored chunk, not a paraphrase.
5. Ask something the note does not cover, such as the office wifi password. Ops Desk answers `I don't have a source for that.` and does not guess.

Upload splits the Markdown on headings, embeds each chunk with `gemini-embedding-2` (768 dimensions, free tier, same API key), and stores the vectors in `data/library.json` on this machine. That file is gitignored. A question is embedded the same way, and only chunks with cosine similarity of at least 0.5 are sent to the model. If none qualify, the model is not asked to invent an answer.

## Try a handoff card

Type this, with or without a library:

```text
Draft a shift note titled Morning handoff for owner Priya Raman about the open Sev-2.
```

Ops Desk calls `draftHandoff` and shows a card with the title, summary, and owner. The card stays in the chat. It does not send email or save the note. If nothing was retrieved, the card says the draft is not grounded.

## Evals

An eval is a fixed list of questions with an expected result, so a change can be checked against the same cases. This one checks that the sample policy is cited, that an unknown question is refused, and that an explicit draft returns a handoff card.

Open [http://localhost:3000/evals](http://localhost:3000/evals) and click Run. The page loads the sample policy, then sends each case through the same chat route.
