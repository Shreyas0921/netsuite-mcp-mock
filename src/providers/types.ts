import { Method } from "axios";

export type SuiteQLResponse = {
  totalCount: number;
  items: Record<string, unknown>[];
  hasMore: boolean;
  offset: number;
  count: number;
};

export type SearchRestletRequest = {
  type: string;
  filters: FilterNode[];
  columns: Array<Record<string, unknown>>;
  countOnly?: boolean;
  maxResults?: number;
  settings?: Array<{ name: string; value: string }>;
};

export type FilterNode = string | string[] | FilterNode[];

export type SearchRestletResponse = {
  success?: boolean;
  error?: unknown;
  data?: {
    count: number;
    items: unknown[][];
  };
};

export interface NetSuiteDataProvider {
  executeSuiteQL(query: string, offset?: number): Promise<SuiteQLResponse>;
  searchRestlet(req: SearchRestletRequest): Promise<SearchRestletResponse>;
}

export interface ProviderContext {
  netsuiteRestUrl?: string;
  netsuiteSearchRestletUrl?: string;
  netsuiteAccessToken?: string;
  demoDataDir?: string;
  demoScenario?: string;
}

export interface HttpRequestParams {
  endpoint: string;
  method?: Method;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}
