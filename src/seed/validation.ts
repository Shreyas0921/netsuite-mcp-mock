import fs from "fs";
import path from "path";
import { DatasetKey, GeneratedScenario, REQUIRED_DATASETS, ValidationIssue, ValidationResult } from "./types";

type RecordMap = Record<DatasetKey, Record<string, unknown>[]>;

export function validateGeneratedScenario(scenario: GeneratedScenario, scenarioRoot = "<memory>"): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (scenario.manifest.version !== 1) {
    issues.push({ path: `${scenarioRoot}/manifest.json`, message: "manifest.version must be 1" });
  }

  if (!scenario.manifest.scenario) {
    issues.push({ path: `${scenarioRoot}/manifest.json`, message: "manifest.scenario must be non-empty" });
  }

  for (const key of REQUIRED_DATASETS) {
    if (!scenario.manifest.datasets[key]) {
      issues.push({ path: `${scenarioRoot}/manifest.json`, message: `Missing manifest dataset key '${key}'` });
    }

    const rows = scenario.records[key];
    if (!Array.isArray(rows)) {
      issues.push({ path: `${scenarioRoot}/${scenario.manifest.datasets[key] || key}`, message: `Dataset '${key}' must be an array` });
      continue;
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        issues.push({ path: `${scenarioRoot}/${scenario.manifest.datasets[key]}#${i}`, message: `Dataset '${key}' row must be an object` });
      }
    }
  }

  issues.push(...validateReferences(scenario.records, scenarioRoot));
  return { ok: issues.length === 0, issues };
}

function validateReferences(records: RecordMap, scenarioRoot: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const accountIds = new Set(records.accounts.map((r) => String(r.internalid)));
  const customerIds = new Set(records.customer.map((r) => String(r.internalid)));
  const vendorIds = new Set(records.vendor.map((r) => String(r.internalid)));
  const subsidiaryIds = new Set(records.subsidiary.map((r) => String(r.internalid)));

  for (let i = 0; i < records.invoice.length; i += 1) {
    const invoice = records.invoice[i];
    const customerId = nestedId(invoice, "customer");
    const accountId = nestedId(invoice, "account");

    if (customerId && !customerIds.has(customerId)) {
      issues.push({
        path: `${scenarioRoot}/datasets/invoice.json#${i}`,
        message: `Invoice references unknown customer ${customerId}`,
      });
    }

    if (accountId && !accountIds.has(accountId)) {
      issues.push({
        path: `${scenarioRoot}/datasets/invoice.json#${i}`,
        message: `Invoice references unknown account ${accountId}`,
      });
    }
  }

  for (let i = 0; i < records.transaction.length; i += 1) {
    const tx = records.transaction[i];
    const accountId = nestedId(tx, "account");
    const subsidiaryId = nestedId(tx, "subsidiary");
    const vendorId = nestedId(tx, "vendor");

    if (accountId && !accountIds.has(accountId)) {
      issues.push({
        path: `${scenarioRoot}/datasets/transaction.json#${i}`,
        message: `Transaction references unknown account ${accountId}`,
      });
    }

    if (subsidiaryId && !subsidiaryIds.has(subsidiaryId)) {
      issues.push({
        path: `${scenarioRoot}/datasets/transaction.json#${i}`,
        message: `Transaction references unknown subsidiary ${subsidiaryId}`,
      });
    }

    if (vendorId && !vendorIds.has(vendorId)) {
      issues.push({
        path: `${scenarioRoot}/datasets/transaction.json#${i}`,
        message: `Transaction references unknown vendor ${vendorId}`,
      });
    }
  }

  return issues;
}

function nestedId(row: Record<string, unknown>, key: string): string | null {
  const obj = row[key];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const id = (obj as Record<string, unknown>).internalid;
  if (id === null || id === undefined) return null;
  return String(id);
}

export function validateScenarioOnDisk(rootDir: string, scenarioName: string): ValidationResult {
  const scenarioDir = path.join(rootDir, scenarioName);
  const manifestPath = path.join(scenarioDir, "manifest.json");
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(manifestPath)) {
    return { ok: false, issues: [{ path: manifestPath, message: "Missing manifest.json" }] };
  }

  const manifest = parseJson(manifestPath, issues);
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, issues };
  }
  const manifestObj = manifest as Record<string, unknown>;

  const records: Partial<RecordMap> = {};

  for (const key of REQUIRED_DATASETS) {
    const datasets = manifestObj.datasets as Record<string, unknown> | undefined;
    const rel = (datasets || {})[key];
    if (typeof rel !== "string") {
      issues.push({ path: manifestPath, message: `Missing dataset mapping '${key}'` });
      continue;
    }

    const full = path.resolve(scenarioDir, rel);
    if (!full.startsWith(scenarioDir)) {
      issues.push({ path: manifestPath, message: `Dataset path escapes scenario dir for '${key}'` });
      continue;
    }

    const dataset = parseJson(full, issues);
    if (!Array.isArray(dataset)) {
      issues.push({ path: full, message: "Dataset must be an array" });
      continue;
    }

    records[key] = dataset as Record<string, unknown>[];
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const loaded: GeneratedScenario = {
    manifest: manifestObj as unknown as GeneratedScenario["manifest"],
    records: records as RecordMap,
    metadata: {
      generator_version: "unknown",
      generated_at: "unknown",
      seed: 0,
      config_hash: "unknown",
    },
  };

  return validateGeneratedScenario(loaded, scenarioDir);
}

function parseJson(filePath: string, issues: ValidationIssue[]): unknown {
  if (!fs.existsSync(filePath)) {
    issues.push({ path: filePath, message: "File does not exist" });
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    issues.push({
      path: filePath,
      message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  }
}
