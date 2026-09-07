import React from "react";
import { useTranslation } from "react-i18next";
import {
  CONTEXT_ACTION_EXPORT_TEST_ID,
  CONTEXT_EXPORT_JSON_FILENAME,
  CONTEXT_EXPORT_MARKDOWN_FILENAME,
} from "#/api/context-service/context-constants";
import {
  buildContextExportMarkdown,
  buildContextExportPayload,
} from "#/api/context-service/context-export";
import ContextService from "#/api/context-service/context-service.api";
import EventService from "#/api/event-service/event-service.api";
import { BrandButton } from "#/components/features/settings/brand-button";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import {
  useContextBranches,
  useContextCheckpoints,
} from "#/hooks/query/use-context-branches";
import { INITIAL_HISTORY_PAGE_SIZE } from "#/hooks/query/use-conversation-history";
import { useUserConversation } from "#/hooks/query/use-user-conversation";
import { I18nKey } from "#/i18n/declaration";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { downloadBlob } from "#/utils/utils";

export function ExportContextButton() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useUserConversation(conversationId ?? null);
  const { data: branches } = useContextBranches(conversationId ?? undefined);
  const { data: checkpoints } = useContextCheckpoints(
    conversationId ?? undefined,
  );
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (!conversationId || isExporting) return;
    setIsExporting(true);
    try {
      const branch = branches?.[0] ?? null;
      const metadata = branch
        ? await ContextService.exportBranch(branch.branch_id)
        : {
            conversation_id: conversationId,
            branch_id: null,
            divergence: {
              parent_id: null,
              event_id: null,
              event_ts: null,
            },
            checkpoints: checkpoints ?? [],
            events: [],
          };
      const page = await EventService.searchEvents(
        conversationId,
        conversation?.conversation_url ?? null,
        conversation?.session_api_key ?? null,
        {
          limit: INITIAL_HISTORY_PAGE_SIZE,
          sortOrder: "TIMESTAMP_DESC",
        },
      );
      const events = Array.isArray(page.items) ? [...page.items].reverse() : [];
      const payload = buildContextExportPayload({
        conversationId: metadata.conversation_id || conversationId,
        branchId: metadata.branch_id,
        divergence: metadata.divergence,
        checkpoints: metadata.checkpoints,
        events,
      });
      downloadBlob(
        new Blob([buildContextExportMarkdown(payload)], {
          type: "text/markdown",
        }),
        CONTEXT_EXPORT_MARKDOWN_FILENAME,
      );
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
        CONTEXT_EXPORT_JSON_FILENAME,
      );
    } catch (error) {
      displayErrorToast(error instanceof Error ? error.message : null);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <BrandButton
      type="button"
      variant="tertiary"
      testId={CONTEXT_ACTION_EXPORT_TEST_ID}
      isDisabled={!conversationId || isExporting}
      onClick={() => {
        void handleExport();
      }}
    >
      {t(I18nKey.CONTEXT$EXPORT)}
    </BrandButton>
  );
}
