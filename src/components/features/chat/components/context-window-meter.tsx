import React from "react";
import { useTranslation } from "react-i18next";
import { useContextWindowUsage } from "#/hooks/use-context-window-usage";
import { StyledTooltip } from "#/components/shared/buttons/styled-tooltip";
import { ContextEngineeringPanel } from "#/components/features/context/context-engineering-panel";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";
import { chatInputIconButtonClassName } from "#/utils/form-control-classes";
import { getContextWindowUsagePercentage } from "#/utils/format-token-count";
import { ContextWindowRing } from "./context-window-ring";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";

export function ContextWindowMeter() {
  const { t } = useTranslation("openhands");
  const usage = useContextWindowUsage();
  const isPanelOpen = useContextEngineeringStore((state) => state.isPanelOpen);
  const openPanel = useContextEngineeringStore((state) => state.openPanel);
  const closePanel = useContextEngineeringStore((state) => state.closePanel);

  if (!usage) {
    return null;
  }

  const usagePercentage = getContextWindowUsagePercentage(
    usage.perTurnToken,
    usage.contextWindow,
  );
  const roundedPercentage = Math.round(usagePercentage);
  const remainingPercentage = Math.max(0, 100 - roundedPercentage);
  const usagePercentLabel = `${roundedPercentage}% ${t(I18nKey.CONVERSATION$USED)} (${remainingPercentage}% ${t(I18nKey.CONVERSATION$LEFT)})`;

  return (
    <div className="relative shrink-0">
      <StyledTooltip
        content={t(I18nKey.CHAT_INTERFACE$SHOW_CONTEXT)}
        placement="top"
      >
        <button
          type="button"
          className={cn(chatInputIconButtonClassName, "size-8")}
          aria-label={`${t(I18nKey.CHAT_INTERFACE$CONTEXT_WINDOW_METER_LABEL)}: ${usagePercentLabel}`}
          aria-expanded={isPanelOpen}
          aria-haspopup="dialog"
          data-testid="context-window-meter"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isPanelOpen) {
              closePanel();
            } else {
              openPanel();
            }
          }}
        >
          <ContextWindowRing percentage={usagePercentage} />
        </button>
      </StyledTooltip>

      {isPanelOpen ? (
        <div className="absolute bottom-full right-0 z-[60] mb-2 h-[min(70vh,640px)] w-[min(420px,90vw)]">
          <ContextEngineeringPanel />
        </div>
      ) : null}
    </div>
  );
}
