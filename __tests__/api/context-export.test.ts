import { describe, expect, it } from "vitest";
import {
  buildContextExportMarkdown,
  buildContextExportPayload,
} from "#/api/context-service/context-export";
import type { OpenHandsEvent } from "#/types/agent-server/core";

describe("context export contract", () => {
  it("includes conversation, branch, divergence, checkpoints, and events", () => {
    const events = [
      { id: "evt-1", timestamp: "2026-01-01T00:00:00Z" },
      { id: "evt-2", timestamp: "2026-01-02T00:00:00Z" },
    ] as unknown as OpenHandsEvent[];
    const payload = buildContextExportPayload({
      conversationId: "conv-1",
      branchId: "br-1",
      divergence: {
        parent_id: null,
        event_id: "evt-1",
        event_ts: "2026-01-01T00:00:00Z",
      },
      checkpoints: [
        {
          id: "cp-1",
          branch_id: "br-1",
          conversation_id: "conv-1",
          label: "saved",
          at_event_ts: "2026-01-02T00:00:00Z",
          created_at: "2026-01-02T00:00:00Z",
        },
      ],
      events,
    });

    expect(payload).toMatchObject({
      conversation_id: "conv-1",
      branch_id: "br-1",
      divergence: { event_id: "evt-1" },
    });
    expect(payload.checkpoints).toHaveLength(1);
    expect(payload.events).toHaveLength(2);

    const markdown = buildContextExportMarkdown(payload);
    expect(markdown).toContain("conv-1");
    expect(markdown).toContain("saved");
    expect(markdown).toContain("evt-1");
    expect(markdown).toContain("evt-2");

    const parsed = JSON.parse(JSON.stringify(payload));
    expect(parsed.events.map((item: { id: string }) => item.id)).toEqual([
      "evt-1",
      "evt-2",
    ]);
  });
});
