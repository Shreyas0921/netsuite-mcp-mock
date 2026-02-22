import { logger } from "../utils/logger";
import { NetSuiteDataProvider, ProviderContext, SearchRestletRequest, SearchRestletResponse, SuiteQLResponse } from "./types";
import { evaluateSearchRequest } from "./mock/query-evaluator";
import { loadScenario, ScenarioData, watchScenario } from "./mock/scenario-loader";
import { executeMockSuiteQL } from "./mock/sql-router";

export class MockScenarioProvider implements NetSuiteDataProvider {
  private readonly dataDir: string;
  private readonly scenario: string;
  private data: ScenarioData;
  private readonly stopWatch?: () => void;

  constructor(context: ProviderContext) {
    this.dataDir = context.demoDataDir || "demo-data/scenarios";
    this.scenario = context.demoScenario || "";

    if (!this.scenario) {
      throw new Error("DEMO_SCENARIO is required when NETSUITE_MODE=mock");
    }

    this.data = loadScenario(this.dataDir, this.scenario);

    this.stopWatch = watchScenario(
      this.dataDir,
      this.scenario,
      (next) => {
        this.data = next;
        logger.info({
          Module: "mock-provider",
          Message: `Reloaded scenario '${this.scenario}' successfully`,
          ObjectMsg: {
            loadedAt: next.loadedAt,
            datasets: Object.keys(next.records),
          },
        });
      },
      (error) => {
        logger.error({
          Module: "mock-provider",
          Message: "Scenario reload failed; keeping last valid dataset",
          ObjectMsg: {
            error: error.message,
            scenario: this.scenario,
          },
        });
      }
    );

    logger.info({
      Module: "mock-provider",
      Message: `Loaded scenario '${this.scenario}'`,
      ObjectMsg: {
        loadedAt: this.data.loadedAt,
        datasets: Object.keys(this.data.records),
      },
    });
  }

  dispose(): void {
    if (this.stopWatch) {
      this.stopWatch();
    }
  }

  async executeSuiteQL(query: string, offset?: number): Promise<SuiteQLResponse> {
    return executeMockSuiteQL(query, offset || 0, this.data.records);
  }

  async searchRestlet(req: SearchRestletRequest): Promise<SearchRestletResponse> {
    const dataset = this.data.records[req.type];
    if (!dataset) {
      throw new Error(`No dataset configured for search type '${req.type}' in scenario '${this.scenario}'`);
    }

    const { count, rows } = evaluateSearchRequest(dataset, req);

    return {
      success: true,
      data: {
        count,
        items: req.countOnly ? [] : rows,
      },
    };
  }
}
