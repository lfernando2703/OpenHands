import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "test-utils";
import ContextService from "#/api/context-service/context-service.api";
import type { ContextBranch } from "#/api/context-service/context-types";
import { BranchPanel } from "#/components/features/context/branch-panel";
import { I18nKey } from "#/i18n/declaration";

const ROOT: ContextBranch = {
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
};

const CHILD: ContextBranch = {
  branch_id: "br-child",
  conversation_id: "test-conversation-id",
  parent_id: "br-root",
  name: "experiment",
  diverged_at_event_ts: "2026-01-02T00:00:00+00:00",
  diverged_at_event_id: "evt-9",
  depth: 1,
  created_at: "2026-01-02T00:00:00+00:00",
  ancestry: ["br-root"],
  rejoins: [],
};

describe("BranchPanel", () => {
  beforeEach(() => {
    vi.spyOn(ContextService, "listBranches").mockResolvedValue([ROOT, CHILD]);
  });

  it("renders ancestry, depth, and divergence markers", async () => {
    renderWithProviders(<BranchPanel />);

    expect(await screen.findByTestId("context-branch-panel")).toBeInTheDocument();
    expect(
      await screen.findByTestId("context-branch-depth-br-child"),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId("context-branch-divergence-br-child"),
    ).toHaveTextContent("evt-9");
    expect(
      screen.getByTestId("context-branch-parent-br-child"),
    ).toHaveTextContent("br-root");
    expect(
      screen.getByTestId("context-branch-rejoin-marker-br-root"),
    ).toHaveTextContent("br-child");
    expect(screen.getByText(I18nKey.CONTEXT$NEW_BRANCH)).toBeInTheDocument();
  });
});
