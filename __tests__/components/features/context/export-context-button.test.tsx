import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import EventService from "#/api/event-service/event-service.api";
import { ExportContextButton } from "#/components/features/context/export-context-button";
import { CONTEXT_ACTION_EXPORT_TEST_ID } from "#/api/context-service/context-constants";
import { resetContextMockData } from "#/mocks/context-handlers";
import { downloadBlob } from "#/utils/utils";

vi.mock("#/utils/utils", async (importActual) => ({
  ...(await importActual<object>()),
  downloadBlob: vi.fn(),
}));

describe("ExportContextButton", () => {
  beforeEach(() => {
    resetContextMockData();
    vi.mocked(downloadBlob).mockReset();
    vi.spyOn(EventService, "searchEvents").mockResolvedValue({
      items: [
        { id: "evt-1", timestamp: "2026-01-01T00:00:00Z" },
        { id: "evt-2", timestamp: "2026-01-02T00:00:00Z" },
      ],
      next_page_id: null,
    } as never);
  });

  it("downloads markdown and JSON with events and branch metadata", async () => {
    renderWithProviders(<ExportContextButton />);
    fireEvent.click(screen.getByTestId(CONTEXT_ACTION_EXPORT_TEST_ID));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
    const markdown = vi.mocked(downloadBlob).mock.calls[0][0] as Blob;
    const json = vi.mocked(downloadBlob).mock.calls[1][0] as Blob;
    expect(markdown.type).toContain("markdown");
    expect(json.type).toContain("json");
    const jsonText = await json.text();
    expect(jsonText).toContain("evt-1");
    expect(jsonText).toContain("test-conversation-id");
  });
});
