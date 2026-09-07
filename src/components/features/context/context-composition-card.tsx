import { Loader2, Minimize } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CONTEXT_CATEGORY_FILES,
  CONTEXT_CATEGORY_HISTORY,
  CONTEXT_CATEGORY_TASK,
  CONTEXT_CATEGORY_THOUGHTS,
  CONTEXT_CATEGORY_TOOLS,
  type ContextCategory,
} from "#/api/context-service/context-constants";
import { ContextWindowRing } from "#/components/features/chat/components/context-window-ring";
import { ToggleSwitch } from "#/ui/toggle-switch";
import { useCompactContextAction } from "#/hooks/use-compact-context-action";
import type { ContextCategoryShare } from "#/hooks/use-context-engineering";
import { I18nKey } from "#/i18n/declaration";
import { formatCompactTokenCount } from "#/utils/format-token-count";
import { cn } from "#/utils/utils";

const CATEGORY_LABEL: Record<ContextCategory, I18nKey> = {
  [CONTEXT_CATEGORY_HISTORY]: I18nKey.CONTEXT$CATEGORY_HISTORY,
  [CONTEXT_CATEGORY_THOUGHTS]: I18nKey.CONTEXT$CATEGORY_THOUGHTS,
  [CONTEXT_CATEGORY_TOOLS]: I18nKey.CONTEXT$CATEGORY_TOOLS,
  [CONTEXT_CATEGORY_FILES]: I18nKey.CONTEXT$CATEGORY_FILES,
  [CONTEXT_CATEGORY_TASK]: I18nKey.CONTEXT$CATEGORY_TASK,
};

export function ContextCompositionCard({
  percentage,
  perTurnToken,
  contextWindow,
  shares,
  pruned,
  onTogglePrune,
}: {
  percentage: number;
  perTurnToken: number;
  contextWindow: number;
  shares: ContextCategoryShare[];
  pruned: Set<ContextCategory>;
  onTogglePrune: (id: ContextCategory) => void;
}) {
  const { t } = useTranslation("openhands");
  const { handleCompact, isCompacting, isDisabled } =
    useCompactContextAction(perTurnToken);

  return (
    <section
      data-testid="context-composition-card"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <ContextWindowRing percentage={percentage} size={48} />
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--oh-foreground)]">
            {t(I18nKey.CONTEXT$COMPOSITION)}
          </h3>
          <p className="text-xs text-[var(--oh-muted)]">
            {formatCompactTokenCount(perTurnToken)} /{" "}
            {formatCompactTokenCount(contextWindow)}
          </p>
          <p className="text-xs text-[var(--oh-muted)]">
            {t(I18nKey.CONTEXT$ESTIMATE)}
          </p>
        </div>
      </div>
      <button
        type="button"
        data-testid="context-window-compact-button"
        disabled={isDisabled}
        aria-busy={isCompacting}
        aria-label={t(I18nKey.CONVERSATION$COMPACT_CONTEXT)}
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-xs",
          "text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        onClick={() => handleCompact()}
      >
        {isCompacting ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Minimize className="size-3" aria-hidden />
        )}
        <span>{t(I18nKey.CONVERSATION$COMPACT_CONTEXT)}</span>
      </button>
      <ul className="flex flex-col gap-2">
        {shares.map((share) => (
          <li
            key={share.id}
            data-testid={`context-category-${share.id}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-[var(--oh-foreground)]">
              {t(CATEGORY_LABEL[share.id])} {Math.round(share.share * 100)}%
            </span>
            <ToggleSwitch
              enabled={!pruned.has(share.id)}
              label={t(I18nKey.CONTEXT$PRUNE)}
              onToggle={() => {
                onTogglePrune(share.id);
                if (!pruned.has(share.id)) {
                  handleCompact();
                }
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
