import { useMemo, useState } from "react";
import {
  CONTEXT_CATEGORIES,
  CONTEXT_CATEGORY_FILES,
  CONTEXT_CATEGORY_HISTORY,
  CONTEXT_CATEGORY_TASK,
  CONTEXT_CATEGORY_THOUGHTS,
  CONTEXT_CATEGORY_TOOLS,
  type ContextCategory,
} from "#/api/context-service/context-constants";
import type { GraphRelevantFile } from "#/api/graph-service/graph-types";
import GraphService from "#/api/graph-service/graph-service.api";
import { useContextWindowUsage } from "#/hooks/use-context-window-usage";
import { useQuery } from "@tanstack/react-query";
import useMetricsStore from "#/stores/metrics-store";
import { GRAPH_QUERY_KEYS } from "#/hooks/query/query-keys";

export interface ContextCategoryShare {
  id: ContextCategory;
  tokens: number;
  share: number;
}

export interface ContextRelevanceItem {
  file: string;
  relevance: number;
  reason: string;
  pinned: boolean;
  source: "graph" | "estimator";
}

const CATEGORY_WEIGHTS: Record<ContextCategory, number> = {
  [CONTEXT_CATEGORY_HISTORY]: 0.4,
  [CONTEXT_CATEGORY_THOUGHTS]: 0.15,
  [CONTEXT_CATEGORY_TOOLS]: 0.2,
  [CONTEXT_CATEGORY_FILES]: 0.15,
  [CONTEXT_CATEGORY_TASK]: 0.1,
};

export function splitContextComposition(
  perTurnToken: number,
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  } | null,
): ContextCategoryShare[] {
  const cacheTokens =
    (usage?.cache_read_tokens ?? 0) + (usage?.cache_write_tokens ?? 0);
  const thoughts = usage?.completion_tokens ?? 0;
  const prompt = usage?.prompt_tokens ?? 0;
  const weighted = CONTEXT_CATEGORIES.map((id) => {
    let tokens = Math.round(perTurnToken * CATEGORY_WEIGHTS[id]);
    if (id === CONTEXT_CATEGORY_THOUGHTS && thoughts > 0) {
      tokens = thoughts;
    }
    if (id === CONTEXT_CATEGORY_FILES && cacheTokens > 0) {
      tokens = cacheTokens;
    }
    if (id === CONTEXT_CATEGORY_HISTORY && prompt > 0) {
      tokens = Math.max(tokens, Math.round(prompt * 0.5));
    }
    return { id, tokens };
  });
  const total = weighted.reduce((sum, item) => sum + item.tokens, 0) || 1;
  return weighted.map((item) => ({
    ...item,
    share: item.tokens / total,
  }));
}

function estimateRelevance(
  shares: ContextCategoryShare[],
): ContextRelevanceItem[] {
  return shares
    .filter((item) => item.tokens > 0)
    .map((item) => ({
      file: item.id,
      relevance: item.share,
      reason: "estimator",
      pinned: false,
      source: "estimator" as const,
    }));
}

export function useContextEngineering() {
  const usage = useContextWindowUsage();
  const storeUsage = useMetricsStore((state) => state.usage);
  const [pruned, setPruned] = useState<Set<ContextCategory>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const composition = useMemo(
    () => splitContextComposition(usage?.perTurnToken ?? 0, storeUsage ?? null),
    [usage?.perTurnToken, storeUsage],
  );

  const graphStatus = useQuery({
    queryKey: GRAPH_QUERY_KEYS.status(),
    queryFn: () => GraphService.getStatus(),
    retry: false,
  });

  const graphFiles = useMemo<GraphRelevantFile[]>(() => {
    if (!graphStatus.data) return [];
    const indexed = graphStatus.data.files_indexed ?? 0;
    if (indexed <= 0) return [];
    return [
      {
        file: graphStatus.data.root ?? ".",
        relevance: graphStatus.data.coverage ?? 0,
        reason: "graph",
        lines: indexed,
      },
    ];
  }, [graphStatus.data]);

  const relevance: ContextRelevanceItem[] = graphStatus.isSuccess
    ? graphFiles.map((item) => ({
        file: item.file,
        relevance: item.relevance,
        reason: item.reason,
        pinned: pinned.has(item.file),
        source: "graph",
      }))
    : estimateRelevance(composition).map((item) => ({
        ...item,
        pinned: pinned.has(item.file),
      }));

  return {
    usage,
    composition,
    pruned,
    togglePrune: (id: ContextCategory) => {
      setPruned((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    relevance,
    graphAvailable: graphStatus.isSuccess,
    graphFiles,
    togglePin: (file: string) => {
      setPinned((prev) => {
        const next = new Set(prev);
        if (next.has(file)) next.delete(file);
        else next.add(file);
        return next;
      });
    },
  };
}
