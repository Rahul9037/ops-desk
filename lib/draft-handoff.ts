import { tool } from "ai";
import { z } from "zod";

const DRAFT_REQUEST = /\b(draft|handoff|hand-off|shift note)\b/i;

export const draftHandoffInput = z.object({
  title: z.string().describe("Short title of the handoff"),
  summary: z.string().describe("What the next shift needs to know"),
  owner: z.string().describe("Person who owns the next action"),
});

export type HandoffDraft = z.infer<typeof draftHandoffInput>;

export function asksForDraft(text: string): boolean {
  return DRAFT_REQUEST.test(text);
}

export function draftHandoffTool() {
  return tool({
    description:
      "Draft a handoff or shift note as a card in this chat. Does not send email or save the note.",
    inputSchema: draftHandoffInput,
    execute: async ({ title, summary, owner }) => ({
      title,
      summary,
      owner,
    }),
  });
}
