export const CONTEXT_API_PATH = "/api/context";
export const SESSION_API_KEY_HEADER = "X-Session-API-Key";

export const CONTEXT_BRANCHES_PATH = `${CONTEXT_API_PATH}/branches`;
export const CONTEXT_CONFIG_PATH = `${CONTEXT_API_PATH}/config`;
export const CONTEXT_IMPORT_PATH = `${CONTEXT_API_PATH}/import-project-config`;

export const CONTEXT_FORK_BLOCK_START = "<CONTEXT_FORK>";
export const CONTEXT_FORK_BLOCK_END = "</CONTEXT_FORK>";

export const DEFAULT_CONTEXT_MAX_DEPTH = 3;

export const CONTEXT_ENGINEERING_PANEL_TEST_ID = "context-engineering-panel";
export const CONTEXT_BRANCH_PANEL_TEST_ID = "context-branch-panel";
export const CONTEXT_FORK_DIALOG_TEST_ID = "context-fork-dialog";

export const CONTEXT_CATEGORY_HISTORY = "history";
export const CONTEXT_CATEGORY_THOUGHTS = "thoughts";
export const CONTEXT_CATEGORY_TOOLS = "tools";
export const CONTEXT_CATEGORY_FILES = "files";
export const CONTEXT_CATEGORY_TASK = "task";

export const CONTEXT_CATEGORIES = [
  CONTEXT_CATEGORY_HISTORY,
  CONTEXT_CATEGORY_THOUGHTS,
  CONTEXT_CATEGORY_TOOLS,
  CONTEXT_CATEGORY_FILES,
  CONTEXT_CATEGORY_TASK,
] as const;

export type ContextCategory = (typeof CONTEXT_CATEGORIES)[number];

export const CONTEXT_ACTION_REWIND_TEST_ID = "context-action-rewind";
export const CONTEXT_ACTION_CHECKPOINT_TEST_ID = "context-action-checkpoint";
export const CONTEXT_ACTION_EXPORT_TEST_ID = "context-action-export";

export const CONTEXT_CHECKPOINTS_PATH = `${CONTEXT_API_PATH}/checkpoints`;
export const CONTEXT_EXPORT_PATH = `${CONTEXT_API_PATH}/export`;

export const CONTEXT_FORK_REVISION_PREFIX = "Revision:";

export const CONTEXT_REWIND_DIALOG_TEST_ID = "context-rewind-dialog";
export const CONTEXT_CHECKPOINT_DIALOG_TEST_ID = "context-checkpoint-dialog";
export const CONTEXT_EDIT_COMPOSER_TEST_ID = "context-edit-composer";
export const CONTEXT_EXPORT_BUTTON_TEST_ID = "context-export-button";

export const CONTEXT_EXPORT_MARKDOWN_FILENAME = "context-export.md";
export const CONTEXT_EXPORT_JSON_FILENAME = "context-export.json";
