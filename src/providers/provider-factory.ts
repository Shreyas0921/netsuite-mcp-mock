import { logger } from "../utils/logger";
import { LiveNetSuiteProvider } from "./live-provider";
import { MockScenarioProvider } from "./mock-provider";
import { NetSuiteDataProvider, ProviderContext } from "./types";

let provider: NetSuiteDataProvider | null = null;

export function buildProvider(mode: string, context: ProviderContext): NetSuiteDataProvider {
  if (mode === "mock") {
    return new MockScenarioProvider(context);
  }
  return new LiveNetSuiteProvider(context);
}

export function initializeProvider(mode: string, context: ProviderContext): NetSuiteDataProvider {
  if (provider) {
    return provider;
  }

  provider = buildProvider(mode, context);

  logger.info({
    Module: "provider-factory",
    Message: `Initialized NetSuite provider in '${mode}' mode`,
    ObjectMsg: {
      demoScenario: context.demoScenario,
      demoDataDir: context.demoDataDir,
    },
  });

  return provider;
}

export function getProvider(): NetSuiteDataProvider {
  if (!provider) {
    throw new Error("NetSuite provider is not initialized");
  }

  return provider;
}

export function resetProviderForTests(): void {
  const maybeDisposable = provider as unknown as { dispose?: () => void } | null;
  if (maybeDisposable && typeof maybeDisposable.dispose === "function") {
    maybeDisposable.dispose();
  }
  provider = null;
}
