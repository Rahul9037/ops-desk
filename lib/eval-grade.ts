import { NO_SOURCE_REPLY } from "./sources";

export type EvalExpect = "citation" | "no-source" | "handoff";

export type HandoffFields = {
  title: string;
  summary: string;
  owner: string;
};

export type ObservedReply = {
  text: string;
  citationLabels: string[];
  handoff: HandoffFields | null;
};

export type Grade = {
  pass: boolean;
  reason: string;
};

const KEY_MARKER = "GOOGLE_GENERATIVE_AI_API_KEY";

export function isKeyError(message: string): boolean {
  return message.includes(KEY_MARKER);
}

export function gradeCase(expect: EvalExpect, reply: ObservedReply): Grade {
  const text = reply.text.trim();
  const refused = text === NO_SOURCE_REPLY;
  const handoff = completeHandoff(reply.handoff);

  if (expect === "citation") {
    if (refused) {
      return { pass: false, reason: "Refused instead of citing a source." };
    }
    if (reply.citationLabels.length === 0) {
      return { pass: false, reason: "No citation was returned." };
    }
    return {
      pass: true,
      reason: `Cited ${reply.citationLabels.join(", ")}.`,
    };
  }

  if (expect === "no-source") {
    if (refused && reply.citationLabels.length === 0 && !handoff) {
      return { pass: true, reason: "Used the no-source refusal." };
    }
    return { pass: false, reason: "Did not use the no-source refusal." };
  }

  if (!handoff) {
    return {
      pass: false,
      reason: "No handoff card with a title, summary, and owner.",
    };
  }
  return { pass: true, reason: "Card has a title, summary, and owner." };
}

function completeHandoff(handoff: HandoffFields | null): boolean {
  if (!handoff) return false;
  return (
    handoff.title.trim().length > 0 &&
    handoff.summary.trim().length > 0 &&
    handoff.owner.trim().length > 0
  );
}

export function parseChatStream(raw: string): ObservedReply | { error: string } {
  let text = "";
  const citationLabels: string[] = [];
  const toolNames = new Map<string, string>();
  let handoff: HandoffFields | null = null;
  let error: string | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;

    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }
    if (!event || typeof event !== "object" || !("type" in event)) continue;
    const record = event as Record<string, unknown>;

    if (record.type === "text-delta" && typeof record.delta === "string") {
      text += record.delta;
    }

    if (record.type === "start") {
      for (const label of labelsFrom(record.messageMetadata)) {
        if (!citationLabels.includes(label)) citationLabels.push(label);
      }
    }

    if (
      (record.type === "tool-input-start" ||
        record.type === "tool-input-available") &&
      typeof record.toolCallId === "string" &&
      typeof record.toolName === "string"
    ) {
      toolNames.set(record.toolCallId, record.toolName);
    }

    if (
      record.type === "tool-output-available" &&
      typeof record.toolCallId === "string" &&
      toolNames.get(record.toolCallId) === "draftHandoff" &&
      isHandoff(record.output)
    ) {
      handoff = {
        title: record.output.title,
        summary: record.output.summary,
        owner: record.output.owner,
      };
    }

    if (record.type === "error" && typeof record.errorText === "string") {
      error = record.errorText;
    }
  }

  if (error) return { error };
  return { text, citationLabels, handoff };
}

function labelsFrom(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || !("citations" in metadata)) {
    return [];
  }
  const citations = metadata.citations;
  if (!Array.isArray(citations)) return [];
  return citations.flatMap((item) => {
    if (!item || typeof item !== "object" || !("label" in item)) return [];
    return typeof item.label === "string" ? [item.label] : [];
  });
}

function isHandoff(value: unknown): value is HandoffFields {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.title === "string" &&
    typeof draft.summary === "string" &&
    typeof draft.owner === "string"
  );
}
