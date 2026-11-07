# Ops Desk

Ops Desk is a small internal chat for operations notes. You upload a Markdown file, ask a question, and the reply comes back in pieces in the same thread. When the note covers the question, the reply points at the passage it used. When it does not, the reply says so. You can also ask for a shift-handoff draft and get a card in the thread. The Gemini key stays on the server.

## What happens when you press Send

The page is `app/page.tsx`. The thread, the text box, and the Send and Stop buttons live in `app/chat-panel.tsx`. Send calls `sendMessage` from `useChat`, which posts the thread to `app/api/chat/route.ts`.

That route reads `GOOGLE_GENERATIVE_AI_API_KEY` and does not send the key to the browser. If `data/library.json` already has notes (`lib/store.ts`), `lib/embeddings.ts` turns the question into a list of 768 numbers with `gemini-embedding-2`. The same kind of list was stored for each passage at upload time. `lib/retrieve.ts` compares the two lists with cosine similarity (`lib/similarity.ts`) and keeps at most three whose score is at least 0.5. That score is only a measure of how close two passages are.

Those passages go to the chat model with the question. The model is `gemini-3.5-flash-lite`, and the route sets thinking to `minimal`. The model does not return the whole answer in one block. `streamText` writes each text piece into the HTTP response as it arrives, and `app/chat-panel.tsx` appends it to the message. Stop calls `stop()`, and the route passes that abort through to the model call.

If nothing in the library is close enough, and the message is not an explicit draft, the route never calls the chat model. It streams one fixed sentence instead. That path is below.

## Citations, and saying there is no source

A citation is a pointer back to a stored passage, not a link to the open web. Matching passages are labeled `C1`, `C2`, and `C3` in `lib/retrieve.ts`. The route attaches them to the assistant message and asks the model to write labels such as `[C1]` in the answer. `app/chat-panel.tsx` turns a label into a button. Clicking it, or the chip under the message, opens the stored passage in the side panel. The highlighted text is the chunk that was saved, not a rewrite.

The refusal is the exact sentence in `lib/sources.ts`: `I don't have a source for that.` The route uses it when the library is empty or when no passage clears 0.5, unless you explicitly asked for a draft. The model is not asked to guess.

## The handoff card

`draftHandoff` is the one function the model can call. It is defined in `lib/draft-handoff.ts`. The arguments are a title, a summary, and an owner. The server checks that shape and returns the same three fields. It does not send email, and it does not write the note anywhere outside the chat.

`app/chat-panel.tsx` looks for that result and draws a card with those three lines. If no passage was retrieved, the card adds: `This draft is not grounded in a source.` When the library has no match, the route still calls the model for this card only if the message asks for a draft, a handoff, or a shift note. A normal question with no source still gets the refusal sentence.

## What /evals checks

`/evals` is a page (`app/evals/page.tsx`, `app/evals/eval-runner.tsx`) with a Run button. Run loads the sample policy through `app/api/documents/sample/route.ts`, then sends each row of `evals/cases.json` through the same `app/api/chat/route.ts` the chat uses. `lib/eval-grade.ts` marks each row pass or fail and gives a one-line reason.

The list is eight fixed questions: five that the sample policy can answer, two it cannot, and one explicit handoff draft. The first five should come back with a citation. The next two should be the no-source sentence. The draft should come back with a title, a summary, and an owner. A fixed list matters because the next change is checked against the same questions. A new question you type once in the chat does not tell you whether the old ones still behave. If the Gemini key is missing, the page shows that error and does not make up a score.

## Resume bullets

- Built a Next.js chat (`app/chat-panel.tsx`, `app/api/chat/route.ts`) that streams `gemini-3.5-flash-lite` replies and aborts the model call when the user presses Stop.
- Indexed uploaded Markdown (`app/api/documents/route.ts`, `lib/ingest.ts`, `lib/chunk.ts`) into a local `data/library.json`, retrieved up to three passages with cosine similarity of at least 0.5, and showed those citations or the exact no-source sentence.
- Added one in-chat handoff card (`draftHandoff`: title, summary, owner) and an `/evals` page that reruns eight fixed cases through the same chat route.

## Left out on purpose

There is no sign-in. Anyone who can open the app uses the same local library file. There is no deploy setup in this repo; you run it on your machine with `npm run dev`. There is no second tool. `draftHandoff` is the only function the model can call, and the card never leaves the thread.
