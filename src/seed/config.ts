import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GeneratorConfig, GeneratorCounts, Profile, Scale, SeedCliOptions } from "./types";

const DEFAULT_COUNTS: Record<Scale, GeneratorCounts> = {
  small: { customers: 6, vendors: 4, items: 6, invoices: 12, transactions: 12 },
  medium: { customers: 20, vendors: 10, items: 12, invoices: 60, transactions: 60 },
  large: { customers: 60, vendors: 30, items: 40, invoices: 240, transactions: 220 },
};

type ConfigFileShape = Partial<{
  scenario: string;
  description: string;
  asOfDate: string;
  seed: number;
  scale: Scale;
  profile: Profile;
  counts: Partial<GeneratorCounts>;
  baseScenario: string;
}>;

export function isScale(value: string): value is Scale {
  return value === "small" || value === "medium" || value === "large";
}

export function isProfile(value: string): value is Profile {
  return value === "baseline" || value === "ar_spike" || value === "revenue_drop";
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function loadConfigFile(configPath?: string): ConfigFileShape {
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  const text = fs.readFileSync(resolved, "utf-8");
  try {
    const parsed = JSON.parse(text) as ConfigFileShape;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("must be a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid config JSON (${resolved}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function buildGeneratorConfig(options: SeedCliOptions, configFile: ConfigFileShape): GeneratorConfig {
  const scenario = options.name || configFile.scenario;
  if (!scenario) {
    throw new Error("Scenario name is required. Use --name or set scenario in --config");
  }

  const scale = options.scale || configFile.scale || "small";
  if (!isScale(scale)) {
    throw new Error(`Invalid scale '${String(scale)}'. Expected: small|medium|large`);
  }

  const profile = options.profile || configFile.profile || "baseline";
  if (!isProfile(profile)) {
    throw new Error(`Invalid profile '${String(profile)}'. Expected: baseline|ar_spike|revenue_drop`);
  }

  const asOfDate = options.asOfDate || configFile.asOfDate || new Date().toISOString().slice(0, 10);
  if (!isIsoDate(asOfDate)) {
    throw new Error(`Invalid --as-of-date '${asOfDate}'. Expected YYYY-MM-DD`);
  }

  const seed =
    options.seed ??
    configFile.seed ??
    Math.floor(Date.now() % 2147483647);

  const defaults = DEFAULT_COUNTS[scale];
  const counts: GeneratorCounts = {
    customers: optionsFromCounts(options, configFile, "customers", defaults.customers),
    vendors: optionsFromCounts(options, configFile, "vendors", defaults.vendors),
    items: optionsFromCounts(options, configFile, "items", defaults.items),
    invoices: optionsFromCounts(options, configFile, "invoices", defaults.invoices),
    transactions: optionsFromCounts(options, configFile, "transactions", defaults.transactions),
  };

  return {
    scenario,
    description: configFile.description,
    asOfDate,
    seed,
    scale,
    profile,
    counts,
    baseScenario: options.baseScenario || configFile.baseScenario,
  };
}

function optionsFromCounts(
  options: SeedCliOptions,
  configFile: ConfigFileShape,
  key: keyof GeneratorCounts,
  fallback: number
): number {
  const cliValue = (options as unknown as Record<string, unknown>)[key];
  if (typeof cliValue === "number") return normalizeCount(String(key), cliValue);

  const cfg = configFile.counts?.[key];
  if (typeof cfg === "number") return normalizeCount(String(key), cfg);

  return fallback;
}

function normalizeCount(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
    throw new Error(`Count '${name}' must be a positive integer`);
  }
  return value;
}

export function configHash(config: GeneratorConfig): string {
  return crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 12);
}
