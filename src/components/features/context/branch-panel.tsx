import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ContextBranch } from "#/api/context-service/context-types";
import { CONTEXT_BRANCH_PANEL_TEST_ID } from "#/api/context-service/context-constants";
import { BrandButton } from "#/components/features/settings/brand-button";
import { useNavigation } from "#/context/navigation-context";
import {
  useContextBranches,
  useRejoinContextBranch,
  useRenameContextBranch,
} from "#/hooks/query/use-context-branches";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";

function BranchRow({
  branch,
  conversationId,
}: {
  branch: ContextBranch;
  conversationId: string;
}) {
  const { t } = useTranslation("openhands");
  const { navigate } = useNavigation();
  const { mutate: rename } = useRenameContextBranch();
  const { mutate: rejoin } = useRejoinContextBranch();

  return (
    <li
      data-testid={`context-branch-${branch.branch_id}`}
      className="flex flex-col gap-1 rounded-md border border-[var(--oh-border-subtle)] p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--oh-foreground)]">
          {branch.name}
        </span>
        <span
          data-testid={`context-branch-depth-${branch.branch_id}`}
          className="rounded bg-[var(--oh-interactive-hover)] px-1.5 py-0.5 text-xs text-[var(--oh-muted)]"
        >
          {t(I18nKey.CONTEXT$DEPTH)} {branch.depth}
        </span>
      </div>
      <p
        data-testid={`context-branch-divergence-${branch.branch_id}`}
        className="text-xs text-[var(--oh-muted)]"
      >
        {t(I18nKey.CONTEXT$DIVERGED_AT)} {branch.diverged_at_event_id}
      </p>
      {branch.parent_id ? (
        <p
          data-testid={`context-branch-parent-${branch.branch_id}`}
          className="text-xs text-[var(--oh-muted)]"
        >
          {t(I18nKey.CONTEXT$PARENT)} {branch.parent_id}
        </p>
      ) : null}
      {branch.rejoins.length > 0 ? (
        <p
          data-testid={`context-branch-rejoin-marker-${branch.branch_id}`}
          className="text-xs text-[var(--oh-muted)]"
        >
          {t(I18nKey.CONTEXT$REJOIN)} {branch.rejoins[0].from_branch_id}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1">
        <BrandButton
          type="button"
          variant="tertiary"
          testId={`context-branch-open-${branch.branch_id}`}
          onClick={() => navigate(`/conversations/${branch.conversation_id}`)}
        >
          {t(I18nKey.CONTEXT$OPEN)}
        </BrandButton>
        <BrandButton
          type="button"
          variant="tertiary"
          testId={`context-branch-rename-${branch.branch_id}`}
          onClick={() => {
            const next = window.prompt(t(I18nKey.CONTEXT$RENAME), branch.name);
            if (next?.trim()) {
              rename({ branchId: branch.branch_id, name: next.trim() });
            }
          }}
        >
          {t(I18nKey.CONTEXT$RENAME)}
        </BrandButton>
        {branch.parent_id ? (
          <BrandButton
            type="button"
            variant="tertiary"
            testId={`context-branch-rejoin-${branch.branch_id}`}
            onClick={() =>
              rejoin({
                branchId: branch.parent_id as string,
                conversationId,
                payload: {
                  from_branch_id: branch.branch_id,
                  rejoin_event_ts: branch.diverged_at_event_ts,
                },
              })
            }
          >
            {t(I18nKey.CONTEXT$REJOIN)}
          </BrandButton>
        ) : null}
      </div>
    </li>
  );
}

export function BranchPanel() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const { data: branches } = useContextBranches(conversationId ?? undefined);
  const openFork = useContextEngineeringStore((state) => state.openFork);

  if (!conversationId) {
    return null;
  }

  return (
    <section
      data-testid={CONTEXT_BRANCH_PANEL_TEST_ID}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--oh-foreground)]">
          {t(I18nKey.CONTEXT$BRANCHES)}
        </h3>
        <BrandButton
          type="button"
          variant="secondary"
          testId="context-new-branch"
          startContent={<GitBranch size={14} />}
          onClick={() =>
            openFork({
              conversationId,
              parentBranchId: branches?.[0]?.branch_id ?? null,
              divergedAtEventTs: new Date().toISOString(),
              divergedAtEventId: "latest",
              preview: t(I18nKey.CONTEXT$NEW_BRANCH),
            })
          }
        >
          {t(I18nKey.CONTEXT$NEW_BRANCH)}
        </BrandButton>
      </div>
      {branches && branches.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {branches.map((branch) => (
            <BranchRow
              key={branch.branch_id}
              branch={branch}
              conversationId={conversationId}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--oh-muted)]">
          {t(I18nKey.CONTEXT$NO_BRANCHES)}
        </p>
      )}
    </section>
  );
}
