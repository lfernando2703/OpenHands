export interface ContextRejoin {
  id: string;
  branch_id: string;
  from_branch_id: string;
  rejoin_event_ts: string;
  created_at: string;
}

export interface ContextBranch {
  branch_id: string;
  conversation_id: string;
  parent_id: string | null;
  name: string;
  diverged_at_event_ts: string;
  diverged_at_event_id: string;
  depth: number;
  created_at: string;
  ancestry: string[];
  rejoins: ContextRejoin[];
}

export interface ContextConfig {
  max_depth: number;
}

export interface CreateContextBranchRequest {
  conversation_id: string;
  name: string;
  diverged_at_event_ts: string;
  diverged_at_event_id: string;
  parent_branch_id?: string | null;
}

export interface RenameContextBranchRequest {
  name: string;
}

export interface RejoinContextBranchRequest {
  from_branch_id: string;
  rejoin_event_ts: string;
}

export interface ContextForkRequest {
  conversationId: string;
  parentBranchId: string | null;
  divergedAtEventTs: string;
  divergedAtEventId: string;
  preview: string;
  editedMessage?: string;
  suggestedName?: string;
}

export interface ContextCheckpoint {
  id: string;
  branch_id: string;
  conversation_id: string;
  label: string;
  at_event_ts: string;
  created_at: string;
}

export interface CreateContextCheckpointRequest {
  branch_id: string;
  label: string;
  at_event_ts: string;
}

export interface ContextRewindRecord {
  id: string;
  branch_id: string;
  after_timestamp: string;
  created_at: string;
}

export interface ContextExportDivergence {
  parent_id: string | null;
  event_id: string | null;
  event_ts: string | null;
}

export interface ContextExportPayload {
  conversation_id: string;
  branch_id: string | null;
  divergence: ContextExportDivergence;
  checkpoints: ContextCheckpoint[];
  events: unknown[];
}

export interface ContextEditRequest {
  conversationId: string;
  parentBranchId: string | null;
  divergedAtEventTs: string;
  divergedAtEventId: string;
  originalText: string;
}
