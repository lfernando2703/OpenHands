import React from "react";
import { useTranslation } from "react-i18next";
import { buildContextForkSuffix } from "#/api/context-service/context-service.api";
import { CONTEXT_FORK_DIALOG_TEST_ID } from "#/api/context-service/context-constants";
import type { ContextForkRequest } from "#/api/context-service/context-types";
import { getStoredConversationMetadata } from "#/api/conversation-metadata-store";
import { BrandButton } from "#/components/features/settings/brand-button";
import { SettingsInput } from "#/components/features/settings/settings-input";
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

export function ForkDialog() {
  const forkRequest = useContextEngineeringStore((state) => state.forkRequest);
  if (!forkRequest) {
    return null;
  }
  return <ForkDialogForm request={forkRequest} />;
}

function ForkDialogForm({ request }: { request: ContextForkRequest }) {
  const { t } = useTranslation("openhands");
  const { navigate } = useNavigation();
  const closeFork = useContextEngineeringStore((state) => state.closeFork);
  const { data: branches } = useContextBranches(request.conversationId);
  const { mutateAsync: createBranch, isPending: isCreatingBranch } =
    useCreateContextBranch();
  const { mutateAsync: createConversation, isPending: isCreatingConversation } =
    useCreateConversation();
  const [name, setName] = React.useState("");

  const parent = request.parentBranchId
    ? branches?.find((item) => item.branch_id === request.parentBranchId)
    : undefined;
  const parentName = parent?.name ?? t(I18nKey.CONTEXT$ROOT);
  const isBusy = isCreatingBranch || isCreatingConversation;

  const handleConfirm = async () => {
    const branchName = name.trim();
    if (!branchName || isBusy) return;
    try {
      await createBranch({
        conversation_id: request.conversationId,
        name: branchName,
        diverged_at_event_ts: request.divergedAtEventTs,
        diverged_at_event_id: request.divergedAtEventId,
        parent_branch_id: request.parentBranchId,
      });
      const suffix = buildContextForkSuffix({
        parentBranchName: parentName,
        parentBranchId: request.parentBranchId,
        divergedAtEventId: request.divergedAtEventId,
        divergedAtEventTs: request.divergedAtEventTs,
      });
      const metadata = getStoredConversationMetadata(request.conversationId);
      const created = await createConversation({
        conversationInstructions: suffix,
        parentConversationId: request.conversationId,
        workingDir: metadata?.selected_workspace ?? undefined,
        workspaceMode: metadata?.workspace_mode ?? undefined,
        entryPoint: "context-fork",
      });
      closeFork();
      navigate(`/conversations/${created.conversation_id}`);
    } catch (error) {
      displayErrorToast(error instanceof Error ? error.message : null);
    }
  };

  return (
    <ModalBackdrop onClose={isBusy ? undefined : closeFork}>
      <div
        data-testid={CONTEXT_FORK_DIALOG_TEST_ID}
        className="flex w-[420px] max-w-[90vw] flex-col gap-4 rounded-xl border border-[var(--oh-border)] bg-base-secondary p-4"
      >
        <h2 className="text-base font-semibold text-[var(--oh-foreground)]">
          {t(I18nKey.CONTEXT$FORK_TITLE)}
        </h2>
        <p
          data-testid="context-fork-divergence"
          className="text-sm text-[var(--oh-muted)]"
        >
          {t(I18nKey.CONTEXT$FORK_DIVERGENCE)} {request.preview}
        </p>
        <SettingsInput
          testId="context-fork-name"
          name="context-fork-name"
          type="text"
          label={t(I18nKey.CONTEXT$FORK_NAME)}
          value={name}
          placeholder={t(I18nKey.CONTEXT$FORK_NAME_PLACEHOLDER)}
          onChange={setName}
        />
        <div className="flex justify-end gap-2">
          <BrandButton
            type="button"
            variant="secondary"
            testId="context-fork-cancel"
            isDisabled={isBusy}
            onClick={closeFork}
          >
            {t(I18nKey.BUTTON$CANCEL)}
          </BrandButton>
          <BrandButton
            type="button"
            variant="primary"
            testId="context-fork-confirm"
            isDisabled={isBusy || !name.trim()}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {t(I18nKey.CONTEXT$FORK_CONFIRM)}
          </BrandButton>
        </div>
      </div>
    </ModalBackdrop>
  );
}
