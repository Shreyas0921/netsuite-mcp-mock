import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import { DatasetKey, GeneratedScenario, REQUIRED_DATASETS } from "./types";

export function resolveScenarioRoot(rootDir?: string): string {
  return path.resolve(process.cwd(), rootDir || "demo-data/scenarios");
}

export function scenarioDir(rootDir: string, scenario: string): string {
  return path.join(rootDir, scenario);
}

export function listScenarios(rootDir: string): Array<{ scenario: string; asOfDate?: string; description?: string }> {
  if (!fs.existsSync(rootDir)) return [];

  const dirs = fs.readdirSync(rootDir).filter((name) => {
    const p = path.join(rootDir, name);
    return fs.statSync(p).isDirectory();
  });

  const rows: Array<{ scenario: string; asOfDate?: string; description?: string }> = [];

  for (const name of dirs) {
    const manifestPath = path.join(rootDir, name, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
      rows.push({
        scenario: String(manifest.scenario || name),
        asOfDate: typeof manifest.as_of_date === "string" ? manifest.as_of_date : undefined,
        description: typeof manifest.description === "string" ? manifest.description : undefined,
      });
    } catch {
      rows.push({ scenario: name, description: "(invalid manifest.json)" });
    }
  }

  return rows.sort((a, b) => a.scenario.localeCompare(b.scenario));
}

export function writeScenarioAtomic(rootDir: string, scenario: GeneratedScenario, force = false): void {
  fs.mkdirSync(rootDir, { recursive: true });
  const target = scenarioDir(rootDir, scenario.manifest.scenario);

  if (fs.existsSync(target) && !force) {
    throw new Error(`Scenario already exists: ${target}. Use --force to overwrite.`);
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `seed-${scenario.manifest.scenario}-`));
  const stagingScenarioDir = path.join(staging, scenario.manifest.scenario);

  try {
    fs.mkdirSync(path.join(stagingScenarioDir, "datasets"), { recursive: true });

    fs.writeFileSync(
      path.join(stagingScenarioDir, "manifest.json"),
      stableJsonStringify(scenario.manifest),
      "utf-8"
    );

    for (const key of REQUIRED_DATASETS) {
      const rel = scenario.manifest.datasets[key as DatasetKey];
      const full = path.join(stagingScenarioDir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, stableJsonStringify(scenario.records[key as DatasetKey]), "utf-8");
    }

    fs.writeFileSync(
      path.join(stagingScenarioDir, "generator-metadata.json"),
      stableJsonStringify(scenario.metadata),
      "utf-8"
    );

    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }

    fs.renameSync(stagingScenarioDir, target);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

export function loadScenarioFromDisk(rootDir: string, scenarioName: string): GeneratedScenario {
  const dir = scenarioDir(rootDir, scenarioName);
  const manifestPath = path.join(dir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Scenario manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as GeneratedScenario["manifest"];
  const records = {} as Record<DatasetKey, Record<string, unknown>[]>;

  for (const key of REQUIRED_DATASETS) {
    const rel = manifest.datasets[key];
    const full = path.resolve(dir, rel);
    if (!full.startsWith(dir)) {
      throw new Error(`Dataset path escapes scenario dir: ${rel}`);
    }
    records[key] = JSON.parse(fs.readFileSync(full, "utf-8")) as Record<string, unknown>[];
  }

  const metadataPath = path.join(dir, "generator-metadata.json");
  const metadata = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, "utf-8"))
    : {
        generator_version: "unknown",
        generated_at: "unknown",
        seed: 0,
        config_hash: "unknown",
      };

  return { manifest, records, metadata };
}

export function cloneBaseScenario(rootDir: string, baseScenario: string, nextScenarioName: string): GeneratedScenario {
  const base = loadScenarioFromDisk(rootDir, baseScenario);
  const manifest = {
    ...deepClone(base.manifest),
    scenario: nextScenarioName,
  };

  return {
    manifest,
    records: deepClone(base.records),
    metadata: deepClone(base.metadata),
  };
}

export function runRepoDemoValidator(): { ok: boolean; output: string } {
  const proc = spawnSync(process.execPath, ["setup/validate-demo-data.js"], {
    cwd: process.cwd(),
    encoding: "utf-8",
  });

  const output = `${proc.stdout || ""}${proc.stderr || ""}`.trim();
  return { ok: proc.status === 0, output };
}

function stableJsonStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }

  return value;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
