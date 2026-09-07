import { http, HttpResponse } from "msw";
import {
  CONTEXT_BRANCHES_PATH,
  CONTEXT_CONFIG_PATH,
  CONTEXT_IMPORT_PATH,
  DEFAULT_CONTEXT_MAX_DEPTH,
} from "#/api/context-service/context-constants";
import type {
  ContextBranch,
  ContextConfig,
  CreateContextBranchRequest,
} from "#/api/context-service/context-types";

const DEFAULT_CONFIG: ContextConfig = {
  max_depth: DEFAULT_CONTEXT_MAX_DEPTH,
};

let config: ContextConfig = { ...DEFAULT_CONFIG };
let branches: ContextBranch[] = [];
let branchCounter = 1;

export function resetContextMockData() {
  config = { ...DEFAULT_CONFIG };
  branches = [];
  branchCounter = 1;
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
];
