import React from "react";
import { useTranslation } from "react-i18next";
import { buildContextForkSuffix } from "#/api/context-service/context-service.api";
import { CONTEXT_EDIT_COMPOSER_TEST_ID } from "#/api/context-service/context-constants";
import { getStoredConversationMetadata } from "#/api/conversation-metadata-store";
import { BrandButton } from "#/components/features/settings/brand-button";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { useNavigation } from "#/context/navigation-context";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import {
  useContextBranches,
  useCreateContextBranch,
} from "#/hooks/query/use-context-branches";
import { I18nKey } from "#/i18n/declaration";
import { useContextEngineeringStore } from "#/stores/context-engineering-store";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import type { ContextEditRequest } from "#/api/context-service/context-types";

export function EditMessageComposer() {
  const editRequest = useContextEngineeringStore((state) => state.editRequest);
  if (!editRequest) return null;
  return <EditMessageComposerForm request={editRequest} />;
}

function EditMessageComposerForm({ request }: { request: ContextEditRequest }) {
  const { t } = useTranslation("openhands");
  const { navigate } = useNavigation();
  const closeEdit = useContextEngineeringStore((state) => state.closeEdit);
  const { data: branches } = useContextBranches(request.conversationId);
  const { mutateAsync: createBranch, isPending: isCreatingBranch } =
    useCreateContextBranch();
  const { mutateAsync: createConversation, isPending: isCreatingConversation } =
    useCreateConversation();
  const [text, setText] = React.useState(request.originalText);
  const isBusy = isCreatingBranch || isCreatingConversation;
  const parent = request.parentBranchId
    ? branches?.find((item) => item.branch_id === request.parentBranchId)
    : undefined;

  const handleSave = async () => {
    const edited = text.trim();
    if (!edited || isBusy) return;
    try {
      await createBranch({
        conversation_id: request.conversationId,
        name: t(I18nKey.CONTEXT$EDIT),
        diverged_at_event_ts: request.divergedAtEventTs,
        diverged_at_event_id: request.divergedAtEventId,
        parent_branch_id: request.parentBranchId,
      });
      const suffix = buildContextForkSuffix({
        parentBranchName: parent?.name ?? t(I18nKey.CONTEXT$ROOT),
        parentBranchId: request.parentBranchId,
        divergedAtEventId: request.divergedAtEventId,
        divergedAtEventTs: request.divergedAtEventTs,
        revisionNote: edited,
      });
      const metadata = getStoredConversationMetadata(request.conversationId);
      const created = await createConversation({
        query: edited,
        conversationInstructions: suffix,
        parentConversationId: request.conversationId,
        workingDir: metadata?.selected_workspace ?? undefined,
        workspaceMode: metadata?.workspace_mode ?? undefined,
        entryPoint: "context-fork",
      });
      closeEdit();
      navigate(`/conversations/${created.conversation_id}`);
    } catch (error) {
      displayErrorToast(error instanceof Error ? error.message : null);
    }
  };

  return (
    <ModalBackdrop onClose={isBusy ? undefined : closeEdit}>
      <div
        data-testid={CONTEXT_EDIT_COMPOSER_TEST_ID}
        className="flex w-[420px] max-w-[90vw] flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4"
      >
        <p
          data-testid="context-edit-notice"
          className="text-sm text-[var(--oh-muted)]"
        >
          {t(I18nKey.CONTEXT$EDIT_NOTICE)}
        </p>
        <textarea
          data-testid="context-edit-text"
          className="min-h-24 rounded-md border border-[var(--oh-border)] bg-base p-2 text-sm text-[var(--oh-foreground)]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label={t(I18nKey.CONTEXT$EDIT)}
        />
        <div className="flex justify-end gap-2">
          <BrandButton
            type="button"
            variant="secondary"
            testId="context-edit-cancel"
            isDisabled={isBusy}
            onClick={closeEdit}
          >
            {t(I18nKey.BUTTON$CANCEL)}
          </BrandButton>
          <BrandButton
            type="button"
            variant="primary"
            testId="context-edit-save"
            isDisabled={isBusy || !text.trim()}
            onClick={() => {
              void handleSave();
            }}
          >
            {t(I18nKey.CONTEXT$EDIT_SAVE)}
          </BrandButton>
        </div>
      </div>
    </ModalBackdrop>
  );
}
