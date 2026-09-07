import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ContextService from "#/api/context-service/context-service.api";
import type {
  CreateContextBranchRequest,
  RejoinContextBranchRequest,
} from "#/api/context-service/context-types";
import { CONTEXT_QUERY_KEYS } from "#/hooks/query/query-keys";

function useInvalidateContext() {
  const queryClient = useQueryClient();
  return (conversationId?: string) => {
    queryClient.invalidateQueries({ queryKey: CONTEXT_QUERY_KEYS.all });
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: CONTEXT_QUERY_KEYS.branches(conversationId),
      });
    }
  };
}

export function useContextBranches(conversationId?: string) {
  return useQuery({
    queryKey: CONTEXT_QUERY_KEYS.branches(conversationId ?? ""),
    queryFn: () => ContextService.listBranches(conversationId ?? ""),
    enabled: Boolean(conversationId),
  });
}

export function useContextConfig() {
  return useQuery({
    queryKey: CONTEXT_QUERY_KEYS.config(),
    queryFn: () => ContextService.getConfig(),
  });
}

export function useCreateContextBranch() {
  const invalidate = useInvalidateContext();
  return useMutation({
    mutationFn: (payload: CreateContextBranchRequest) =>
      ContextService.createBranch(payload),
    onSuccess: (branch) => invalidate(branch.conversation_id),
  });
}

export function useRenameContextBranch() {
  const invalidate = useInvalidateContext();
  return useMutation({
    mutationFn: ({ branchId, name }: { branchId: string; name: string }) =>
      ContextService.renameBranch(branchId, name),
    onSuccess: (branch) => invalidate(branch.conversation_id),
  });
}

export function useRejoinContextBranch() {
  const invalidate = useInvalidateContext();
  return useMutation({
    mutationFn: ({
      branchId,
      payload,
      conversationId,
    }: {
      branchId: string;
      payload: RejoinContextBranchRequest;
      conversationId: string;
    }) => ContextService.rejoin(branchId, payload).then(() => conversationId),
    onSuccess: (conversationId) => invalidate(conversationId),
  });
}

export function usePutContextConfig() {
  const invalidate = useInvalidateContext();
  return useMutation({
    mutationFn: ContextService.putConfig,
    onSuccess: () => invalidate(),
  });
}
