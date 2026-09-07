import React from "react";
import { useTranslation } from "react-i18next";
import { CONTEXT_CHECKPOINT_DIALOG_TEST_ID } from "#/api/context-service/context-constants";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsInput } from "#/components/features/settings/settings-input";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import {
  useContextBranches,
  useContextCheckpoints,
  useCreateContextCheckpoint,
} from "#/hooks/query/use-context-branches";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { useEventStore } from "#/stores/use-event-store";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

export function CheckpointDialog() {
  const isOpen = useContextEngineeringStore((state) => state.isCheckpointOpen);
  if (!isOpen) return null;
  return <CheckpointDialogForm />;
}

function CheckpointDialogForm() {
  const { t } = useTranslation("openhands");
  const closeCheckpoint = useContextEngineeringStore(
    (state) => state.closeCheckpoint,
  );
  const setRewindAnchor = useContextEngineeringStore(
    (state) => state.setRewindAnchor,
  );
  const { conversationId } = useOptionalConversationId();
  const { data: branches } = useContextBranches(conversationId ?? undefined);
  const { data: checkpoints } = useContextCheckpoints(
    conversationId ?? undefined,
  );
  const { mutateAsync: createCheckpoint, isPending } =
    useCreateContextCheckpoint();
  const [label, setLabel] = React.useState("");

  const latestTimestamp = useEventStore((state) => {
    const latest = state.events[state.events.length - 1];
    return latest && "timestamp" in latest ? latest.timestamp : null;
  });

  const branchId = branches?.[0]?.branch_id;
  const canSave = Boolean(
    label.trim() && branchId && latestTimestamp && !isPending,
  );

  const handleSave = async () => {
    const name = label.trim();
    if (!name || !branchId || !latestTimestamp || isPending) return;
    try {
      await createCheckpoint({
        branch_id: branchId,
        label: name,
        at_event_ts: latestTimestamp,
      });
      setLabel("");
    } catch (error) {
      displayErrorToast(error instanceof Error ? error.message : null);
    }
  };

  return (
    <ModalBackdrop onClose={isPending ? undefined : closeCheckpoint}>
      <div
        data-testid={CONTEXT_CHECKPOINT_DIALOG_TEST_ID}
        className="flex w-[420px] max-w-[90vw] flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4"
      >
        <h2 className="text-base font-semibold text-[var(--oh-foreground)]">
          {t(I18nKey.CONTEXT$CHECKPOINT_TITLE)}
        </h2>
        <SettingsInput
          testId="context-checkpoint-label"
          name="context-checkpoint-label"
          type="text"
          label={t(I18nKey.CONTEXT$CHECKPOINT_LABEL)}
          value={label}
          onChange={setLabel}
        />
        <BrandButton
          type="button"
          variant="primary"
          testId="context-checkpoint-save"
          isDisabled={!canSave}
          onClick={() => {
            void handleSave();
          }}
        >
          {t(I18nKey.CONTEXT$CHECKPOINT_SAVE)}
        </BrandButton>
        {checkpoints && checkpoints.length > 0 ? (
          <ul>
            {checkpoints.map((checkpoint) => (
              <li
                key={checkpoint.id}
                className="flex items-center justify-between gap-2 py-1"
              >
                <span className="text-xs text-[var(--oh-foreground)]">
                  {checkpoint.label}
                </span>
                <BrandButton
                  type="button"
                  variant="tertiary"
                  testId={`context-checkpoint-restore-${checkpoint.id}`}
                  onClick={() => {
                    setRewindAnchor(checkpoint.at_event_ts);
                    closeCheckpoint();
                  }}
                >
                  {t(I18nKey.CONTEXT$CHECKPOINT_RESTORE)}
                </BrandButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--oh-muted)]">
            {t(I18nKey.CONTEXT$CHECKPOINT_EMPTY)}
          </p>
        )}
        <BrandButton
          type="button"
          variant="secondary"
          testId="context-checkpoint-close"
          onClick={closeCheckpoint}
        >
          {t(I18nKey.BUTTON$CLOSE)}
        </BrandButton>
      </div>
    </ModalBackdrop>
  );
}
