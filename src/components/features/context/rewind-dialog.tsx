import React from "react";
import { useTranslation } from "react-i18next";
import { CONTEXT_REWIND_DIALOG_TEST_ID } from "#/api/context-service/context-constants";
import EventService from "#/api/event-service/event-service.api";
import { BrandButton } from "#/components/features/settings/brand-button";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { INITIAL_HISTORY_PAGE_SIZE } from "#/hooks/query/use-conversation-history";
import {
  useContextBranches,
  useRecordContextRewind,
} from "#/hooks/query/use-context-branches";
import { useUserConversation } from "#/hooks/query/use-user-conversation";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

export function RewindDialog() {
  const isOpen = useContextEngineeringStore((state) => state.isRewindOpen);
  if (!isOpen) return null;
  return <RewindDialogForm />;
}

function RewindDialogForm() {
  const { t } = useTranslation("openhands");
  const closeRewind = useContextEngineeringStore((state) => state.closeRewind);
  const setRewindAnchor = useContextEngineeringStore(
    (state) => state.setRewindAnchor,
  );
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useUserConversation(conversationId ?? null);
  const { data: branches } = useContextBranches(conversationId ?? undefined);
  const { mutateAsync: recordRewind } = useRecordContextRewind();
  const [events, setEvents] = React.useState<
    Array<{ id: string; timestamp: string }>
  >([]);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;
    void EventService.searchEvents(
      conversationId,
      conversation?.conversation_url ?? null,
      conversation?.session_api_key ?? null,
      {
        limit: INITIAL_HISTORY_PAGE_SIZE,
        sortOrder: "TIMESTAMP_DESC",
      },
    ).then((page) => {
      if (cancelled || !Array.isArray(page.items)) return;
      const next = page.items.flatMap((item) => {
        if (!("id" in item) || !("timestamp" in item) || !item.timestamp) {
          return [];
        }
        return [{ id: String(item.id), timestamp: String(item.timestamp) }];
      });
      setEvents(next);
      setSelected(next[0]?.timestamp ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    conversation?.conversation_url,
    conversation?.session_api_key,
  ]);

  const handleConfirm = async () => {
    if (!selected) return;
    try {
      const branchId = branches?.[0]?.branch_id;
      if (branchId) {
        await recordRewind({ branchId, afterTimestamp: selected });
      }
      setRewindAnchor(selected);
      closeRewind();
    } catch (error) {
      displayErrorToast(error instanceof Error ? error.message : null);
    }
  };

  return (
    <ModalBackdrop onClose={closeRewind}>
      <div
        data-testid={CONTEXT_REWIND_DIALOG_TEST_ID}
        className="flex w-[420px] max-w-[90vw] flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4"
      >
        <h2 className="text-base font-semibold text-[var(--oh-foreground)]">
          {t(I18nKey.CONTEXT$REWIND_TITLE)}
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--oh-muted)]">
            {t(I18nKey.CONTEXT$REWIND_EMPTY)}
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  data-testid={`context-rewind-event-${event.id}`}
                  className="w-full rounded px-2 py-1 text-left text-xs text-[var(--oh-foreground)] hover:bg-[var(--oh-interactive-hover)]"
                  onClick={() => setSelected(event.timestamp)}
                >
                  {event.timestamp} {event.id}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <BrandButton
            type="button"
            variant="secondary"
            testId="context-rewind-cancel"
            onClick={closeRewind}
          >
            {t(I18nKey.BUTTON$CANCEL)}
          </BrandButton>
          <BrandButton
            type="button"
            variant="primary"
            testId="context-rewind-confirm"
            isDisabled={!selected}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t(I18nKey.CONTEXT$REWIND_CONFIRM)}
          </BrandButton>
        </div>
      </div>
    </ModalBackdrop>
  );
}
