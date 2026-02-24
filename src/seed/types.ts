export const REQUIRED_DATASETS = [
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
] as const;

export type DatasetKey = (typeof REQUIRED_DATASETS)[number];
export type Scale = "small" | "medium" | "large";
export type Profile = "baseline" | "ar_spike" | "revenue_drop";

export type ScenarioManifest = {
  version: 1;
  scenario: string;
  description?: string;
  as_of_date: string;
  datasets: Record<DatasetKey, string>;
};

export type GeneratedScenario = {
  manifest: ScenarioManifest;
  records: Record<DatasetKey, Record<string, unknown>[]>;
  metadata: {
    generator_version: string;
    generated_at: string;
    seed: number;
    config_hash: string;
  };
};

export type GeneratorCounts = Record<"customers" | "vendors" | "items" | "invoices" | "transactions", number>;

export type GeneratorConfig = {
  scenario: string;
  description?: string;
  asOfDate: string;
  seed: number;
  scale: Scale;
  profile: Profile;
  counts: GeneratorCounts;
  baseScenario?: string;
};

export type SeedCliOptions = {
  name?: string;
  asOfDate?: string;
  scale?: Scale;
  seed?: number;
  profile?: Profile;
  baseScenario?: string;
  configPath?: string;
  customers?: number;
  vendors?: number;
  items?: number;
  invoices?: number;
  transactions?: number;
  rootDir?: string;
  force?: boolean;
  dryRun?: boolean;
  strict?: boolean;
  json?: boolean;
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};
