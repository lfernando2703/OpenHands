import { useTranslation } from "react-i18next";
import { BrandButton } from "#/components/features/settings/brand-button";
import type { ContextRelevanceItem } from "#/hooks/use-context-engineering";
import { I18nKey } from "#/i18n/declaration";

export function RelevanceListCard({
  items,
  onPrune,
  onPin,
}: {
  items: ContextRelevanceItem[];
  onPrune: (file: string) => void;
  onPin: (file: string) => void;
}) {
  const { t } = useTranslation("openhands");

  return (
    <section
      data-testid="context-relevance-list"
      className="flex flex-col gap-2"
    >
      <h3 className="text-sm font-medium text-[var(--oh-foreground)]">
        {t(I18nKey.CONTEXT$RELEVANCE)}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.file}
            data-testid={`context-relevance-${item.file}`}
            data-source={item.source}
            className="flex flex-col gap-1 rounded-md border border-[var(--oh-border-subtle)] p-2"
          >
            <span className="text-xs text-[var(--oh-foreground)]">
              {item.file}
            </span>
            <span className="text-xs text-[var(--oh-muted)]">
              {item.reason}
            </span>
            <div className="flex gap-1">
              <BrandButton
                type="button"
                variant="tertiary"
                testId={`context-prune-file-${item.file}`}
                onClick={() => onPrune(item.file)}
              >
                {t(I18nKey.CONTEXT$PRUNE_FILE)}
              </BrandButton>
              <BrandButton
                type="button"
                variant="tertiary"
                testId={`context-pin-file-${item.file}`}
                onClick={() => onPin(item.file)}
              >
                {item.pinned
                  ? t(I18nKey.CONTEXT$PIN_FILE)
                  : t(I18nKey.CONTEXT$PIN_FILE)}
              </BrandButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
