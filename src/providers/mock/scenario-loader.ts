import fs from "fs";
import path from "path";

export type ScenarioManifest = {
  version: number;
  scenario: string;
  description?: string;
  as_of_date?: string;
  datasets: Record<string, string>;
};

export type ScenarioData = {
  manifest: ScenarioManifest;
  records: Record<string, Record<string, unknown>[]>;
  loadedAt: string;
};

function readJson<T>(filePath: string): T {
  const fileContents = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(fileContents) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureArrayRecords(key: string, value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`Dataset '${key}' must be an array of records`);
  }

  return value.map((row, idx) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new Error(`Dataset '${key}' has invalid record at index ${idx}`);
    }
    return row as Record<string, unknown>;
  });
}

function validateManifest(manifest: ScenarioManifest): void {
  if (manifest.version !== 1) {
    throw new Error(`Unsupported scenario manifest version '${manifest.version}'. Only version=1 is supported.`);
  }

  if (!manifest.scenario || typeof manifest.scenario !== "string") {
    throw new Error("manifest.scenario must be a non-empty string");
  }

  if (!manifest.datasets || typeof manifest.datasets !== "object") {
    throw new Error("manifest.datasets must be an object mapping dataset keys to file paths");
  }

  const requiredDatasets = [
    "accounts",
    "accountingperiod",
    "subsidiary",
    "vendor",
    "customer",
    "department",
    "location",
    "item",
    "classification",
    "invoice",
    "customerpayment",
    "creditmemo",
    "transaction",
  ];

  for (const datasetKey of requiredDatasets) {
    if (!manifest.datasets[datasetKey]) {
      throw new Error(`Missing required dataset entry '${datasetKey}' in manifest.datasets`);
    }
  }
}

function validateReferences(records: Record<string, Record<string, unknown>[]>): void {
  const accountIds = new Set(records.accounts.map((r) => String(r.internalid)));
  const customerIds = new Set(records.customer.map((r) => String(r.internalid)));
  const vendorIds = new Set(records.vendor.map((r) => String(r.internalid)));
  const subsidiaryIds = new Set(records.subsidiary.map((r) => String(r.internalid)));

  const asObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  for (const invoice of records.invoice) {
    const customer = asObject(invoice.customer);
    const account = asObject(invoice.account);

    if (customer?.internalid && !customerIds.has(String(customer.internalid))) {
      throw new Error(`Invoice ${invoice.internalid} references unknown customer ${customer.internalid}`);
    }
    if (account?.internalid && !accountIds.has(String(account.internalid))) {
      throw new Error(`Invoice ${invoice.internalid} references unknown account ${account.internalid}`);
    }
  }

  for (const txn of records.transaction) {
    const account = asObject(txn.account);
    const subsidiary = asObject(txn.subsidiary);
    const vendor = asObject(txn.vendor);

    if (account?.internalid && !accountIds.has(String(account.internalid))) {
      throw new Error(`Transaction ${txn.internalid} references unknown account ${account.internalid}`);
    }
    if (subsidiary?.internalid && !subsidiaryIds.has(String(subsidiary.internalid))) {
      throw new Error(`Transaction ${txn.internalid} references unknown subsidiary ${subsidiary.internalid}`);
    }
    if (vendor?.internalid && !vendorIds.has(String(vendor.internalid))) {
      throw new Error(`Transaction ${txn.internalid} references unknown vendor ${vendor.internalid}`);
    }
  }
}

export function loadScenario(dataDir: string, scenario: string): ScenarioData {
  const scenarioRoot = path.resolve(process.cwd(), dataDir, scenario);
  const manifestPath = path.join(scenarioRoot, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Scenario manifest not found: ${manifestPath}`);
  }

  const manifest = readJson<ScenarioManifest>(manifestPath);
  validateManifest(manifest);

  const records: Record<string, Record<string, unknown>[]> = {};

  for (const [datasetKey, relativePath] of Object.entries(manifest.datasets)) {
    const datasetPath = path.resolve(scenarioRoot, relativePath);
    if (!datasetPath.startsWith(scenarioRoot)) {
      throw new Error(`Dataset path escapes scenario directory: ${relativePath}`);
    }
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset file missing for '${datasetKey}': ${datasetPath}`);
    }

    const datasetJson = readJson<unknown>(datasetPath);
    records[datasetKey] = ensureArrayRecords(datasetKey, datasetJson);
  }

  validateReferences(records);

  return {
    manifest,
    records,
    loadedAt: new Date().toISOString(),
  };
}

export function watchScenario(
  dataDir: string,
  scenario: string,
  onReload: (data: ScenarioData) => void,
  onError: (error: Error) => void
): () => void {
  const scenarioRoot = path.resolve(process.cwd(), dataDir, scenario);
  try {
    const watcher = fs.watch(
      scenarioRoot,
      { recursive: true },
      () => {
        try {
          const next = loadScenario(dataDir, scenario);
          onReload(next);
        } catch (error) {
          onError(error as Error);
        }
      }
    );

    return () => watcher.close();
  } catch {
    // Recursive watch is not supported on some platforms. In that case, we skip auto-reload.
    return () => {};
  }
}
