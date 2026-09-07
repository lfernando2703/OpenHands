import { describe, expect, it } from "vitest";
import {
  buildContextForkSuffix,
} from "#/api/context-service/context-service.api";
import {
  CONTEXT_FORK_BLOCK_END,
  CONTEXT_FORK_BLOCK_START,
} from "#/api/context-service/context-constants";
import { I18nKey } from "#/i18n/declaration";

describe("context fork suffix", () => {
  it("names the parent branch and divergence event", () => {
    const suffix = buildContextForkSuffix({
      parentBranchName: "main",
      parentBranchId: "br-root",
      divergedAtEventId: "evt-9",
      divergedAtEventTs: "2026-01-01T00:00:00+00:00",
    });
    expect(suffix).toContain(CONTEXT_FORK_BLOCK_START);
    expect(suffix).toContain(CONTEXT_FORK_BLOCK_END);
    expect(suffix).toContain("main");
    expect(suffix).toContain("evt-9");
  });

  it("resolves CONTEXT i18n keys", () => {
    expect(I18nKey.CONTEXT$FORK_HERE).toBe("CONTEXT$FORK_HERE");
    expect(I18nKey.CONTEXT$BRANCHES).toBe("CONTEXT$BRANCHES");
  });
});
