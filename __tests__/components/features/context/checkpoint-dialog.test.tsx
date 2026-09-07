import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "test-utils";
import { CheckpointDialog } from "#/components/features/context/checkpoint-dialog";
import {
  resetContextMockData,
  seedContextBranches,
} from "#/mocks/context-handlers";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { useEventStore } from "#/stores/use-event-store";

describe("CheckpointDialog", () => {
  beforeEach(() => {
    resetContextMockData();
    seedContextBranches([
      {
        branch_id: "br-1",
        conversation_id: "test-conversation-id",
        parent_id: null,
        name: "main",
        diverged_at_event_ts: "2026-01-01T00:00:00+00:00",
        diverged_at_event_id: "evt-1",
        depth: 0,
        created_at: "2026-01-01T00:00:00+00:00",
        ancestry: [],
        rejoins: [],
      },
    ]);
    useContextEngineeringStore.setState({ isCheckpointOpen: true });
    useEventStore.setState({
      events: [
        { id: "evt-now", timestamp: "2026-06-01T00:00:00.000Z" } as never,
      ],
      eventIds: new Set(["evt-now"]),
      uiEvents: [],
      loadedConversationId: "test-conversation-id",
    });
  });

  it("creates a checkpoint and restores by rewinding", async () => {
    renderWithProviders(<CheckpointDialog />);
    fireEvent.change(screen.getByTestId("context-checkpoint-label"), {
      target: { value: "before-refactor" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("context-checkpoint-save")).toBeEnabled(),
    );
    fireEvent.click(screen.getByTestId("context-checkpoint-save"));

    await waitFor(() =>
      expect(
        screen.getByTestId("context-checkpoint-restore-checkpoint-1"),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByTestId("context-checkpoint-restore-checkpoint-1"),
    );
    expect(useContextEngineeringStore.getState().rewindAnchor).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });
});
