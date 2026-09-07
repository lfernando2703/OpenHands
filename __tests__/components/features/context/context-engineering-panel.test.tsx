import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import GraphService from "#/api/graph-service/graph-service.api";
import { ContextCompositionCard } from "#/components/features/context/context-composition-card";
import { ContextEngineeringPanel } from "#/components/features/context/context-engineering-panel";
import { ContextTreeView } from "#/components/features/context/context-tree-view";
import { RelevanceListCard } from "#/components/features/context/relevance-list-card";
import {
  CONTEXT_CATEGORY_HISTORY,
  CONTEXT_CATEGORY_THOUGHTS,
} from "#/api/context-service/context-constants";
import { I18nKey } from "#/i18n/declaration";
import useMetricsStore from "#/stores/metrics-store";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { splitContextComposition } from "#/hooks/use-context-engineering";

const compactMock = vi.fn();

vi.mock("#/hooks/use-compact-context-action", () => ({
  useCompactContextAction: () => ({
    handleCompact: compactMock,
    isCompacting: false,
    isDisabled: false,
    description: "CONVERSATION$COMPACT_CONTEXT_DESCRIPTION",
  }),
}));

vi.mock("#/hooks/use-select-conversation-tab", () => ({
  useSelectConversationTab: () => ({
    navigateToTab: vi.fn(),
    selectTab: vi.fn(),
    isTabActive: vi.fn(),
    onTabChange: vi.fn(),
    selectedTab: null,
    isRightPanelShown: false,
  }),
}));

describe("context engineering visualization", () => {
  beforeEach(() => {
    compactMock.mockReset();
    useContextEngineeringStore.setState({ isPanelOpen: true });
    useMetricsStore.setState({
      cost: null,
      max_budget_per_task: null,
      usage: {
        prompt_tokens: 800,
        completion_tokens: 200,
        cache_read_tokens: 50,
        cache_write_tokens: 10,
        context_window: 1000,
        per_turn_token: 400,
      },
    });
  });

  it("splits composition categories and toggles prune", () => {
    const shares = splitContextComposition(400, {
      prompt_tokens: 800,
      completion_tokens: 200,
      cache_read_tokens: 50,
      cache_write_tokens: 10,
    });
    const pruned = new Set<typeof CONTEXT_CATEGORY_HISTORY>();
    const onTogglePrune = vi.fn();
    renderWithProviders(
      <ContextCompositionCard
        percentage={40}
        perTurnToken={400}
        contextWindow={1000}
        shares={shares}
        pruned={pruned}
        onTogglePrune={onTogglePrune}
      />,
    );
    expect(screen.getByTestId("context-category-history")).toBeInTheDocument();
    expect(screen.getByTestId("context-category-thoughts")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(onTogglePrune).toHaveBeenCalledWith(CONTEXT_CATEGORY_HISTORY);
    expect(compactMock).toHaveBeenCalled();
  });

  it("renders tree ancestry, depth, and rejoin", () => {
    renderWithProviders(
      <ContextTreeView
        branches={[
          {
            branch_id: "br-root",
            conversation_id: "test-conversation-id",
            parent_id: null,
            name: "main",
            diverged_at_event_ts: "2026-01-01T00:00:00+00:00",
            diverged_at_event_id: "evt-1",
            depth: 0,
            created_at: "2026-01-01T00:00:00+00:00",
            ancestry: [],
            rejoins: [
              {
                id: "rj-1",
                branch_id: "br-root",
                from_branch_id: "br-child",
                rejoin_event_ts: "2026-01-03T00:00:00+00:00",
                created_at: "2026-01-03T00:00:00+00:00",
              },
            ],
          },
        ]}
        graphAvailable={false}
        graphFiles={[]}
      />,
    );
    expect(screen.getByTestId("context-tree-view")).toBeInTheDocument();
    expect(screen.getByTestId("context-tree-node-br-root")).toHaveTextContent(
      "0:2026-01-01T00:00:00+00:00",
    );
    expect(screen.queryByTestId("context-graph-overlay")).not.toBeInTheDocument();
  });

  it("renders the graph overlay when the graph service is present", () => {
    renderWithProviders(
      <ContextTreeView
        branches={[]}
        graphAvailable
        graphFiles={[
          { file: "app.py", relevance: 0.9, reason: "graph", lines: 12 },
        ]}
      />,
    );
    expect(screen.getByTestId("context-graph-overlay")).toBeInTheDocument();
  });

  it("renders relevance from the estimator", () => {
    renderWithProviders(
      <RelevanceListCard
        items={[
          {
            file: CONTEXT_CATEGORY_THOUGHTS,
            relevance: 0.2,
            reason: "estimator",
            pinned: false,
            source: "estimator",
          },
        ]}
        onPrune={vi.fn()}
        onPin={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId(`context-relevance-${CONTEXT_CATEGORY_THOUGHTS}`),
    ).toHaveAttribute("data-source", "estimator");
  });

  it("renders relevance from the graph service", () => {
    renderWithProviders(
      <RelevanceListCard
        items={[
          {
            file: "app.py",
            relevance: 0.8,
            reason: "graph",
            pinned: false,
            source: "graph",
          },
        ]}
        onPrune={vi.fn()}
        onPin={vi.fn()}
      />,
    );
    expect(screen.getByTestId("context-relevance-app.py")).toHaveAttribute(
      "data-source",
      "graph",
    );
  });

  it("enables rewind, checkpoint, and export actions", async () => {
    vi.spyOn(GraphService, "getStatus").mockRejectedValue(new Error("missing"));
    renderWithProviders(<ContextEngineeringPanel />);
    expect(
      await screen.findByTestId("context-engineering-panel"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("context-action-rewind")).not.toBeDisabled();
    expect(screen.getByTestId("context-action-checkpoint")).not.toBeDisabled();
    expect(screen.getByTestId("context-action-export")).not.toBeDisabled();
    expect(screen.getByText(I18nKey.CONTEXT$PANEL_TITLE)).toBeInTheDocument();
  });
});
