import { useTranslation } from "react-i18next";
import type { ContextBranch } from "#/api/context-service/context-types";
import { BranchPanel } from "#/components/features/context/branch-panel";
import { RelevantFilesCard } from "#/components/features/graph/relevant-files-card";
import type { GraphRelevantFile } from "#/api/graph-service/graph-types";
import { I18nKey } from "#/i18n/declaration";

export function ContextTreeView({
  branches,
  graphAvailable,
  graphFiles,
}: {
  branches: ContextBranch[] | undefined;
  graphAvailable: boolean;
  graphFiles: GraphRelevantFile[];
}) {
  const { t } = useTranslation("openhands");

  return (
    <section data-testid="context-tree-view" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-[var(--oh-foreground)]">
        {t(I18nKey.CONTEXT$TREE)}
      </h3>
      <BranchPanel />
      {branches?.map((branch) => (
        <span
          key={branch.branch_id}
          data-testid={`context-tree-node-${branch.branch_id}`}
          className="sr-only"
        >
          {branch.depth}:{branch.diverged_at_event_ts}
        </span>
      ))}
      {graphAvailable ? (
        <div data-testid="context-graph-overlay">
          <RelevantFilesCard
            files={graphFiles}
            budgetLines={graphFiles.reduce(
              (sum, item) => sum + (item.lines ?? 0),
              0,
            )}
            usedLines={graphFiles.reduce(
              (sum, item) => sum + (item.lines ?? 0),
              0,
            )}
            enabled
            defaultEnabled
            onToggle={() => undefined}
          />
        </div>
      ) : null}
    </section>
  );
}
