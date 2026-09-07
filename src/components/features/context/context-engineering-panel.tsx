import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CONTEXT_ACTION_CHECKPOINT_TEST_ID,
  CONTEXT_ACTION_REWIND_TEST_ID,
  CONTEXT_CATEGORY_FILES,
  CONTEXT_ENGINEERING_PANEL_TEST_ID,
} from "#/api/context-service/context-constants";
import { ContextCompositionCard } from "#/components/features/context/context-composition-card";
import { ContextTreeView } from "#/components/features/context/context-tree-view";
import { ExportContextButton } from "#/components/features/context/export-context-button";
import { RelevanceListCard } from "#/components/features/context/relevance-list-card";
import { BrandButton } from "#/components/features/settings/brand-button";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useContextBranches } from "#/hooks/query/use-context-branches";
import { useContextEngineering } from "#/hooks/use-context-engineering";
import { useSelectConversationTab } from "#/hooks/use-select-conversation-tab";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { getContextWindowUsagePercentage } from "#/utils/format-token-count";

export function ContextEngineeringPanel() {
  const { t } = useTranslation("openhands");
  const closePanel = useContextEngineeringStore((state) => state.closePanel);
  const openFork = useContextEngineeringStore((state) => state.openFork);
  const openRewind = useContextEngineeringStore((state) => state.openRewind);
  const openCheckpoint = useContextEngineeringStore(
    (state) => state.openCheckpoint,
  );
  const { conversationId } = useOptionalConversationId();
  const { data: branches } = useContextBranches(conversationId ?? undefined);
  const { navigateToTab } = useSelectConversationTab();
  const engineering = useContextEngineering();

  if (!engineering.usage) {
    return null;
  }

  const percentage = getContextWindowUsagePercentage(
    engineering.usage.perTurnToken,
    engineering.usage.contextWindow,
  );

  return (
    <aside
      data-testid={CONTEXT_ENGINEERING_PANEL_TEST_ID}
      className="flex h-full flex-col gap-4 overflow-y-auto rounded-lg border border-[var(--oh-border)] bg-base-secondary p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-[var(--oh-foreground)]">
          {t(I18nKey.CONTEXT$PANEL_TITLE)}
        </h2>
        <BrandButton
          type="button"
          variant="tertiary"
          testId="context-engineering-close"
          onClick={closePanel}
        >
          {t(I18nKey.BUTTON$CLOSE)}
        </BrandButton>
      </div>

      <ContextCompositionCard
        percentage={percentage}
        perTurnToken={engineering.usage.perTurnToken}
        contextWindow={engineering.usage.contextWindow}
        shares={engineering.composition}
        pruned={engineering.pruned}
        onTogglePrune={engineering.togglePrune}
      />

      <button
        type="button"
        data-testid="context-window-meter-bar-button"
        className="sr-only"
        aria-label={t(I18nKey.COMMON$USAGE)}
        onClick={() => navigateToTab("usage")}
      >
        {t(I18nKey.COMMON$USAGE)}
      </button>
      <BrandButton
        type="button"
        variant="tertiary"
        testId="context-window-plan-usage"
        onClick={() => navigateToTab("usage")}
      >
        {t(I18nKey.COMMON$USAGE)}
      </BrandButton>

      <ContextTreeView
        branches={branches}
        graphAvailable={engineering.graphAvailable}
        graphFiles={engineering.graphFiles}
      />
      <RelevanceListCard
        items={engineering.relevance}
        onPrune={() => engineering.togglePrune(CONTEXT_CATEGORY_FILES)}
        onPin={engineering.togglePin}
      />

      <div
        data-testid="context-engineering-actions"
        className="flex flex-wrap gap-2"
      >
        <BrandButton
          type="button"
          variant="secondary"
          testId="context-action-fork"
          startContent={<GitBranch size={14} />}
          onClick={() => {
            if (!conversationId) return;
            openFork({
              conversationId,
              parentBranchId: branches?.[0]?.branch_id ?? null,
              divergedAtEventTs: new Date().toISOString(),
              divergedAtEventId: "latest",
              preview: t(I18nKey.CONTEXT$NEW_BRANCH),
            });
          }}
        >
          {t(I18nKey.CONTEXT$NEW_BRANCH)}
        </BrandButton>
        <BrandButton
          type="button"
          variant="tertiary"
          testId={CONTEXT_ACTION_REWIND_TEST_ID}
          onClick={openRewind}
        >
          {t(I18nKey.CONTEXT$REWIND)}
        </BrandButton>
        <BrandButton
          type="button"
          variant="tertiary"
          testId={CONTEXT_ACTION_CHECKPOINT_TEST_ID}
          onClick={openCheckpoint}
        >
          {t(I18nKey.CONTEXT$CHECKPOINT)}
        </BrandButton>
        <ExportContextButton />
      </div>
    </aside>
  );
}
