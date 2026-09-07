import type { OpenHandsEvent } from "#/types/agent-server/core";
import type { ContextCheckpoint, ContextExportPayload } from "./context-types";

export function buildContextExportPayload(options: {
  conversationId: string;
  branchId: string | null;
  divergence: ContextExportPayload["divergence"];
  checkpoints: ContextCheckpoint[];
  events: OpenHandsEvent[];
}): ContextExportPayload {
  return {
    conversation_id: options.conversationId,
    branch_id: options.branchId,
    divergence: options.divergence,
    checkpoints: options.checkpoints,
    events: options.events,
  };
}

function eventLine(event: OpenHandsEvent): string {
  const timestamp = "timestamp" in event ? String(event.timestamp) : "";
  const id = "id" in event ? String(event.id) : "";
  return `- ${timestamp} ${id}`.trim();
}

export function buildContextExportMarkdown(
  payload: ContextExportPayload,
): string {
  const lines = [
    `# Context export`,
    "",
    `conversation_id: ${payload.conversation_id}`,
    `branch_id: ${payload.branch_id ?? ""}`,
    `divergence: ${payload.divergence.event_id ?? ""} (${payload.divergence.event_ts ?? ""})`,
    "",
    "## Checkpoints",
  ];
  if (payload.checkpoints.length === 0) {
    lines.push("- none");
  } else {
    for (const checkpoint of payload.checkpoints) {
      lines.push(`- ${checkpoint.label} @ ${checkpoint.at_event_ts}`);
    }
  }
  lines.push("", "## Events");
  const events = payload.events as OpenHandsEvent[];
  if (events.length === 0) {
    lines.push("- none");
  } else {
    for (const event of events) {
      lines.push(eventLine(event));
    }
  }
  return `${lines.join("\n")}\n`;
}
