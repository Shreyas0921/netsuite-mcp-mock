import { request } from "../utils/http";
import { NetSuiteDataProvider, ProviderContext, SearchRestletRequest, SearchRestletResponse, SuiteQLResponse } from "./types";

export class LiveNetSuiteProvider implements NetSuiteDataProvider {
  private readonly baseUrl: string;
  private readonly searchRestletUrl: string;
  private readonly authToken: string;

  constructor(context: ProviderContext) {
    if (!context.netsuiteRestUrl || !context.netsuiteAccessToken || !context.netsuiteSearchRestletUrl) {
      throw new Error(
        "Missing required environment variables for live mode: NETSUITE_REST_URL, NETSUITE_ACCESS_TOKEN, NETSUITE_SEARCH_REST_LET"
      );
    }

    this.baseUrl = context.netsuiteRestUrl;
    this.authToken = context.netsuiteAccessToken;
    this.searchRestletUrl = context.netsuiteSearchRestletUrl;
  }

  async executeSuiteQL(query: string, offset?: number): Promise<SuiteQLResponse> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/query/v1/suiteql`;

    const data = await request<{
      totalResults?: number;
      items?: Record<string, unknown>[];
      hasMore?: boolean;
      offset?: number;
      count?: number;
    }>({
      method: "POST",
      url,
      data: { q: query },
      params: { offset: offset || 0 },
      headers: {
        "Content-Type": "application/json",
        Prefer: "transient",
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    return {
      totalCount: data.totalResults || 0,
      items: data.items || [],
      hasMore: data.hasMore || false,
      offset: data.offset || 0,
      count: data.count || 0,
    };
  }

  async searchRestlet(req: SearchRestletRequest): Promise<SearchRestletResponse> {
    return request<SearchRestletResponse>({
      method: "POST",
      url: this.searchRestletUrl,
      data: req,
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        "Content-Type": "application/json",
      },
    });
  }
}
