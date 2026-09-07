import axios from "axios";
import { NoBackendAvailableError } from "../agent-server-client-options";
import { getEffectiveLocalBackend } from "../backend-registry/active-store";
import {
  CONTEXT_BRANCHES_PATH,
  CONTEXT_CONFIG_PATH,
  CONTEXT_FORK_BLOCK_END,
  CONTEXT_FORK_BLOCK_START,
  CONTEXT_IMPORT_PATH,
  SESSION_API_KEY_HEADER,
} from "./context-constants";
import type {
  ContextBranch,
  ContextConfig,
  CreateContextBranchRequest,
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
}): string {
  return [
    CONTEXT_FORK_BLOCK_START,
    `Parent branch: ${options.parentBranchName}${options.parentBranchId ? ` (${options.parentBranchId})` : ""}`,
    `Diverged at: ${options.divergedAtEventId} (${options.divergedAtEventTs})`,
    CONTEXT_FORK_BLOCK_END,
  ].join("\n");
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
};

export default ContextService;
