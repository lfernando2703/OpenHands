import axios from "axios";
import { NoBackendAvailableError } from "../agent-server-client-options";
import { getEffectiveLocalBackend } from "../backend-registry/active-store";
import {
  CONTEXT_BRANCHES_PATH,
  CONTEXT_CHECKPOINTS_PATH,
  CONTEXT_CONFIG_PATH,
  CONTEXT_EXPORT_PATH,
  CONTEXT_FORK_BLOCK_END,
  CONTEXT_FORK_BLOCK_START,
  CONTEXT_FORK_REVISION_PREFIX,
  CONTEXT_IMPORT_PATH,
  SESSION_API_KEY_HEADER,
} from "./context-constants";
import type {
  ContextBranch,
  ContextCheckpoint,
  ContextConfig,
  ContextExportPayload,
  ContextRewindRecord,
  CreateContextBranchRequest,
  CreateContextCheckpointRequest,
  RejoinContextBranchRequest,
} from "./context-types";

const contextAxios = axios.create();

contextAxios.interceptors.request.use((config) => {
  const backend = getEffectiveLocalBackend();
  if (!backend) throw new NoBackendAvailableError();
  // eslint-disable-next-line no-param-reassign
  config.baseURL = backend.host;
  const apiKey = backend.apiKey?.trim();
  if (apiKey) {
    config.headers.set(SESSION_API_KEY_HEADER, apiKey);
  }
  return config;
});

export function buildContextForkSuffix(options: {
  parentBranchName: string;
  parentBranchId: string | null;
  divergedAtEventId: string;
  divergedAtEventTs: string;
  revisionNote?: string;
}): string {
  const lines = [
    CONTEXT_FORK_BLOCK_START,
    `Parent branch: ${options.parentBranchName}${options.parentBranchId ? ` (${options.parentBranchId})` : ""}`,
    `Diverged at: ${options.divergedAtEventId} (${options.divergedAtEventTs})`,
  ];
  if (options.revisionNote) {
    lines.push(`${CONTEXT_FORK_REVISION_PREFIX} ${options.revisionNote}`);
  }
  lines.push(CONTEXT_FORK_BLOCK_END);
  return lines.join("\n");
}

export const ContextService = {
  listBranches: async (conversationId: string): Promise<ContextBranch[]> => {
    const { data } = await contextAxios.get<{ branches: ContextBranch[] }>(
      CONTEXT_BRANCHES_PATH,
      { params: { conversation_id: conversationId } },
    );
    return data.branches;
  },

  createBranch: async (
    payload: CreateContextBranchRequest,
  ): Promise<ContextBranch> => {
    const { data } = await contextAxios.post<{ branch: ContextBranch }>(
      CONTEXT_BRANCHES_PATH,
      payload,
    );
    return data.branch;
  },

  renameBranch: async (
    branchId: string,
    name: string,
  ): Promise<ContextBranch> => {
    const { data } = await contextAxios.put<{ branch: ContextBranch }>(
      `${CONTEXT_BRANCHES_PATH}/${encodeURIComponent(branchId)}`,
      { name },
    );
    return data.branch;
  },

  rejoin: async (
    branchId: string,
    payload: RejoinContextBranchRequest,
  ): Promise<{ branch: ContextBranch }> => {
    const { data } = await contextAxios.post<{ branch: ContextBranch }>(
      `${CONTEXT_BRANCHES_PATH}/${encodeURIComponent(branchId)}/rejoin`,
      payload,
    );
    return data;
  },

  getConfig: async (): Promise<ContextConfig> => {
    const { data } = await contextAxios.get<ContextConfig>(CONTEXT_CONFIG_PATH);
    return data;
  },

  putConfig: async (
    payload: Partial<ContextConfig>,
  ): Promise<ContextConfig> => {
    const { data } = await contextAxios.put<ContextConfig>(
      CONTEXT_CONFIG_PATH,
      payload,
    );
    return data;
  },

  importProjectConfig: async (path: string): Promise<ContextConfig> => {
    const { data } = await contextAxios.post<ContextConfig>(
      CONTEXT_IMPORT_PATH,
      {
        path,
      },
    );
    return data;
  },

  listCheckpoints: async (params: {
    conversationId?: string;
    branchId?: string;
  }): Promise<ContextCheckpoint[]> => {
    const { data } = await contextAxios.get<{
      checkpoints: ContextCheckpoint[];
    }>(CONTEXT_CHECKPOINTS_PATH, {
      params: {
        ...(params.conversationId
          ? { conversation_id: params.conversationId }
          : {}),
        ...(params.branchId ? { branch_id: params.branchId } : {}),
      },
    });
    return data.checkpoints;
  },

  createCheckpoint: async (
    payload: CreateContextCheckpointRequest,
  ): Promise<ContextCheckpoint> => {
    const { data } = await contextAxios.post<{
      checkpoint: ContextCheckpoint;
    }>(CONTEXT_CHECKPOINTS_PATH, payload);
    return data.checkpoint;
  },

  deleteCheckpoint: async (checkpointId: string): Promise<void> => {
    await contextAxios.delete(
      `${CONTEXT_CHECKPOINTS_PATH}/${encodeURIComponent(checkpointId)}`,
    );
  },

  recordRewind: async (
    branchId: string,
    afterTimestamp: string,
  ): Promise<ContextRewindRecord> => {
    const { data } = await contextAxios.post<{ rewind: ContextRewindRecord }>(
      `${CONTEXT_BRANCHES_PATH}/${encodeURIComponent(branchId)}/rewind`,
      { after_timestamp: afterTimestamp },
    );
    return data.rewind;
  },

  exportBranch: async (branchId: string): Promise<ContextExportPayload> => {
    const { data } = await contextAxios.get<ContextExportPayload>(
      CONTEXT_EXPORT_PATH,
      { params: { branch_id: branchId } },
    );
    return data;
  },
};

export default ContextService;
