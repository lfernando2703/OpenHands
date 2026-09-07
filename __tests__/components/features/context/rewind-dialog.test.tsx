import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import EventService from "#/api/event-service/event-service.api";
import { RewindDialog } from "#/components/features/context/rewind-dialog";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";

vi.mock("#/api/event-service/event-service.api", () => ({
  default: {
    searchEvents: vi.fn(),
  },
}));

describe("RewindDialog", () => {
  beforeEach(() => {
    useContextEngineeringStore.setState({ isRewindOpen: true });
    vi.mocked(EventService.searchEvents).mockResolvedValue({
      items: [
        {
          id: "evt-rewind",
          timestamp: "2026-05-01T00:00:00.000Z",
        },
      ],
      next_page_id: null,
    } as never);
  });

  it("sets the rewind anchor from the selected event", async () => {
    renderWithProviders(<RewindDialog />);
    expect(
      await screen.findByTestId("context-rewind-event-evt-rewind"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("context-rewind-event-evt-rewind"));
    fireEvent.click(screen.getByTestId("context-rewind-confirm"));
    await waitFor(() =>
      expect(useContextEngineeringStore.getState().rewindAnchor).toBe(
        "2026-05-01T00:00:00.000Z",
      ),
    );
    expect(screen.queryByText(I18nKey.CONTEXT$REWIND_TITLE)).toBeNull();
  });
});
