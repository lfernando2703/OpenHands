import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import { CONTEXT_FORK_BLOCK_START } from "#/api/context-service/context-constants";
import ContextService from "#/api/context-service/context-service.api";
import { ForkDialog } from "#/components/features/context/fork-dialog";
import { I18nKey } from "#/i18n/declaration";
import { resetContextMockData } from "#/mocks/context-handlers";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";

const createConversationMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({
    mutateAsync: createConversationMock,
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

describe("ForkDialog", () => {
  beforeEach(() => {
    resetContextMockData();
    createConversationMock.mockReset();
    navigateMock.mockReset();
    createConversationMock.mockResolvedValue({ conversation_id: "forked-1" });
    useContextEngineeringStore.setState({
      isPanelOpen: false,
      forkRequest: {
        conversationId: "conv-1",
        parentBranchId: null,
        divergedAtEventTs: "2026-01-01T00:00:00+00:00",
        divergedAtEventId: "evt-9",
        preview: "Hello world",
      },
    });
  });

  it("creates a branch then launches a forked conversation", async () => {
    const createSpy = vi.spyOn(ContextService, "createBranch");
    renderWithProviders(<ForkDialog />);

    fireEvent.change(screen.getByTestId("context-fork-name"), {
      target: { value: "experiment" },
    });
    fireEvent.click(screen.getByTestId("context-fork-confirm"));

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        name: "experiment",
        diverged_at_event_id: "evt-9",
      }),
    );
    await waitFor(() => expect(createConversationMock).toHaveBeenCalled());
    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parentConversationId: "conv-1",
        conversationInstructions: expect.stringContaining(
          CONTEXT_FORK_BLOCK_START,
        ),
      }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/conversations/forked-1");
    expect(useContextEngineeringStore.getState().forkRequest).toBeNull();
  });

  it("renders the divergence preview", () => {
    renderWithProviders(<ForkDialog />);
    expect(screen.getByTestId("context-fork-divergence")).toHaveTextContent(
      "Hello world",
    );
    expect(screen.getByText(I18nKey.CONTEXT$FORK_TITLE)).toBeInTheDocument();
  });
});
