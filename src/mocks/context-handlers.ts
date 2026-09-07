import { http, HttpResponse } from "msw";
import {
  CONTEXT_BRANCHES_PATH,
  CONTEXT_CHECKPOINTS_PATH,
  CONTEXT_CONFIG_PATH,
  CONTEXT_EXPORT_PATH,
  CONTEXT_IMPORT_PATH,
  DEFAULT_CONTEXT_MAX_DEPTH,
} from "#/api/context-service/context-constants";
import type {
  ContextBranch,
  ContextCheckpoint,
  ContextConfig,
  CreateContextBranchRequest,
  CreateContextCheckpointRequest,
} from "#/api/context-service/context-types";

const DEFAULT_CONFIG: ContextConfig = {
  max_depth: DEFAULT_CONTEXT_MAX_DEPTH,
};

let config: ContextConfig = { ...DEFAULT_CONFIG };
let branches: ContextBranch[] = [];
let checkpoints: ContextCheckpoint[] = [];
let branchCounter = 1;
let checkpointCounter = 1;

export function resetContextMockData() {
  config = { ...DEFAULT_CONFIG };
  branches = [];
  checkpoints = [];
  branchCounter = 1;
  checkpointCounter = 1;
}

export function seedContextBranches(items: ContextBranch[]) {
  branches = items.map((item) => ({ ...item, rejoins: [...item.rejoins] }));
}

function createBranch(payload: CreateContextBranchRequest): ContextBranch {
  const parent = payload.parent_branch_id
    ? branches.find((item) => item.branch_id === payload.parent_branch_id)
    : undefined;
  const depth = parent ? parent.depth + 1 : 0;
  if (depth > config.max_depth) {
    throw new Error("depth");
  }
  const branch: ContextBranch = {
    branch_id: `branch-${branchCounter}`,
    conversation_id: payload.conversation_id,
    parent_id: payload.parent_branch_id ?? null,
    name: payload.name,
    diverged_at_event_ts: payload.diverged_at_event_ts,
    diverged_at_event_id: payload.diverged_at_event_id,
    depth,
    created_at: "2026-01-01T00:00:00+00:00",
    ancestry: parent ? [parent.branch_id, ...parent.ancestry] : [],
    rejoins: [],
  };
  branchCounter += 1;
  branches = [...branches, branch];
  return branch;
}

export const CONTEXT_HANDLERS = [
  http.get(`*${CONTEXT_BRANCHES_PATH}`, ({ request }) => {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversation_id") ?? "";
    return HttpResponse.json({
      branches: branches.filter(
        (item) => item.conversation_id === conversationId,
      ),
    });
  }),
  http.post(`*${CONTEXT_BRANCHES_PATH}`, async ({ request }) => {
    const payload = (await request.json()) as CreateContextBranchRequest;
    try {
      return HttpResponse.json({ branch: createBranch(payload) });
    } catch {
      return HttpResponse.json(
        { error: "fork depth exceeded" },
        { status: 422 },
      );
    }
  }),
  http.put(
    `*${CONTEXT_BRANCHES_PATH}/:branchId`,
    async ({ params, request }) => {
      const payload = (await request.json()) as { name?: string };
      const branchId = String(params.branchId);
      branches = branches.map((item) =>
        item.branch_id === branchId
          ? { ...item, name: payload.name ?? item.name }
          : item,
      );
      const branch = branches.find((item) => item.branch_id === branchId);
      if (!branch) {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }
      return HttpResponse.json({ branch });
    },
  ),
  http.post(
    `*${CONTEXT_BRANCHES_PATH}/:branchId/rejoin`,
    async ({ params, request }) => {
      const payload = (await request.json()) as {
        from_branch_id?: string;
        rejoin_event_ts?: string;
      };
      const branchId = String(params.branchId);
      branches = branches.map((item) =>
        item.branch_id === branchId
          ? {
              ...item,
              rejoins: [
                ...item.rejoins,
                {
                  id: `rejoin-${item.rejoins.length + 1}`,
                  branch_id: branchId,
                  from_branch_id: payload.from_branch_id ?? "",
                  rejoin_event_ts: payload.rejoin_event_ts ?? "",
                  created_at: "2026-01-02T00:00:00+00:00",
                },
              ],
            }
          : item,
      );
      const branch = branches.find((item) => item.branch_id === branchId);
      return HttpResponse.json({ branch });
    },
  ),
  http.get(`*${CONTEXT_CONFIG_PATH}`, () => HttpResponse.json(config)),
  http.put(`*${CONTEXT_CONFIG_PATH}`, async ({ request }) => {
    const payload = (await request.json()) as Partial<ContextConfig>;
    config = { ...config, ...payload };
    return HttpResponse.json(config);
  }),
  http.post(`*${CONTEXT_IMPORT_PATH}`, () => HttpResponse.json(config)),
  http.get(`*${CONTEXT_CHECKPOINTS_PATH}`, ({ request }) => {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversation_id");
    const branchId = url.searchParams.get("branch_id");
    return HttpResponse.json({
      checkpoints: checkpoints.filter((item) => {
        if (branchId) return item.branch_id === branchId;
        if (conversationId) return item.conversation_id === conversationId;
        return false;
      }),
    });
  }),
  http.post(`*${CONTEXT_CHECKPOINTS_PATH}`, async ({ request }) => {
    const payload = (await request.json()) as CreateContextCheckpointRequest;
    const branch = branches.find(
      (item) => item.branch_id === payload.branch_id,
    );
    const checkpoint: ContextCheckpoint = {
      id: `checkpoint-${checkpointCounter}`,
      branch_id: payload.branch_id,
      conversation_id: branch?.conversation_id ?? "",
      label: payload.label,
      at_event_ts: payload.at_event_ts,
      created_at: "2026-01-02T00:00:00+00:00",
    };
    checkpointCounter += 1;
    checkpoints = [...checkpoints, checkpoint];
    return HttpResponse.json({ checkpoint });
  }),
  http.delete(`*${CONTEXT_CHECKPOINTS_PATH}/:checkpointId`, ({ params }) => {
    const checkpointId = String(params.checkpointId);
    checkpoints = checkpoints.filter((item) => item.id !== checkpointId);
    return HttpResponse.json({ ok: true });
  }),
  http.post(
    `*${CONTEXT_BRANCHES_PATH}/:branchId/rewind`,
    async ({ params, request }) => {
      const payload = (await request.json()) as { after_timestamp?: string };
      return HttpResponse.json({
        rewind: {
          id: "rewind-1",
          branch_id: String(params.branchId),
          after_timestamp: payload.after_timestamp ?? "",
          created_at: "2026-01-02T00:00:00+00:00",
        },
      });
    },
  ),
  http.get(`*${CONTEXT_EXPORT_PATH}`, ({ request }) => {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branch_id");
    const branch = branches.find((item) => item.branch_id === branchId);
    return HttpResponse.json({
      conversation_id: branch?.conversation_id ?? "",
      branch_id: branchId,
      divergence: {
        parent_id: branch?.parent_id ?? null,
        event_id: branch?.diverged_at_event_id ?? null,
        event_ts: branch?.diverged_at_event_ts ?? null,
      },
      checkpoints: checkpoints.filter((item) => item.branch_id === branchId),
      events: [],
    });
  }),
];
