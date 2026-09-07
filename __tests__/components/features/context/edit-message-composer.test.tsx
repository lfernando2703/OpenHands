import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import { CONTEXT_FORK_REVISION_PREFIX } from "#/api/context-service/context-constants";
import { EditMessageComposer } from "#/components/features/context/edit-message-composer";
import { I18nKey } from "#/i18n/declaration";
import { resetContextMockData } from "#/mocks/context-handlers";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";

const createConversationMock = vi.fn();
const navigateMock = vi.fn();
const createBranchMock = vi.fn();

vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({
    mutateAsync: createConversationMock,
    isPending: false,
  }),
}));

vi.mock("#/hooks/query/use-context-branches", () => ({
  useContextBranches: () => ({ data: [] }),
  useCreateContextBranch: () => ({
    mutateAsync: createBranchMock,
    isPending: false,
  }),
}));

vi.mock("#/context/navigation-context", async (importActual) => ({
  ...(await importActual<object>()),
  useNavigation: () => ({
    navigate: navigateMock,
    conversationId: "conv-1",
    currentPath: "/conversations/conv-1",
    isNavigating: false,
  }),
}));

describe("EditMessageComposer", () => {
  beforeEach(() => {
    resetContextMockData();
    createConversationMock.mockReset();
    createBranchMock.mockReset();
    navigateMock.mockReset();
    createConversationMock.mockResolvedValue({ conversation_id: "forked-edit" });
    createBranchMock.mockResolvedValue({
      branch_id: "br-edit",
      conversation_id: "conv-1",
    });
    useContextEngineeringStore.setState({
      editRequest: {
        conversationId: "conv-1",
        parentBranchId: null,
        divergedAtEventTs: "2026-01-01T00:00:00+00:00",
        divergedAtEventId: "evt-9",
        originalText: "original",
      },
    });
  });

  it("creates a named fork and opens the forked conversation", async () => {
    renderWithProviders(<EditMessageComposer />);

    expect(screen.getByTestId("context-edit-notice")).toHaveTextContent(
      I18nKey.CONTEXT$EDIT_NOTICE,
    );
    fireEvent.change(screen.getByTestId("context-edit-text"), {
      target: { value: "revised question" },
    });
    fireEvent.click(screen.getByTestId("context-edit-save"));

    await waitFor(() => expect(createBranchMock).toHaveBeenCalled());
    expect(createBranchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        diverged_at_event_id: "evt-9",
      }),
    );
    await waitFor(() => expect(createConversationMock).toHaveBeenCalled());
    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "revised question",
        parentConversationId: "conv-1",
        conversationInstructions: expect.stringContaining(
          CONTEXT_FORK_REVISION_PREFIX,
        ),
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/conversations/forked-edit");
    expect(useContextEngineeringStore.getState().editRequest).toBeNull();
  });
});
