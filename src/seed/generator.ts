import { GeneratorConfig, GeneratedScenario, Profile, REQUIRED_DATASETS } from "./types";
import { SeededRng } from "./prng";
import { configHash } from "./config";

type Row = Record<string, unknown>;

const ACCOUNT_ROWS: Row[] = [
  { internalid: 1000, accountSearchDisplayNameCopy: "Assets", acctNumber: "1000", parent: null, acctType: "Other Asset", acctTypeText: "Other Asset" },
  { internalid: 1100, accountSearchDisplayNameCopy: "Accounts Receivable", acctNumber: "1100", parent: 1000, acctType: "Accounts Receivable", acctTypeText: "Accounts Receivable" },
  { internalid: 1110, accountSearchDisplayNameCopy: "A/R - Enterprise", acctNumber: "1110", parent: 1100, acctType: "Accounts Receivable", acctTypeText: "Accounts Receivable" },
  { internalid: 1120, accountSearchDisplayNameCopy: "A/R - Mid Market", acctNumber: "1120", parent: 1100, acctType: "Accounts Receivable", acctTypeText: "Accounts Receivable" },
  { internalid: 4000, accountSearchDisplayNameCopy: "Revenue", acctNumber: "4000", parent: null, acctType: "Income", acctTypeText: "Income" },
  { internalid: 6100, accountSearchDisplayNameCopy: "Operations Expense", acctNumber: "6100", parent: null, acctType: "Expense", acctTypeText: "Expense" },
];

const SUBSIDIARY_ROWS: Row[] = [
  { internalid: 1, namenohierarchy: "Global", parent: null },
  { internalid: 2, namenohierarchy: "US", parent: 1 },
  { internalid: 3, namenohierarchy: "US West", parent: 2 },
];

const DEPARTMENT_ROWS: Row[] = [
  { internalid: 11, name: "Sales" },
  { internalid: 12, name: "Operations" },
  { internalid: 13, name: "Finance" },
];

const LOCATION_ROWS: Row[] = [
  { internalid: 21, name: "New York" },
  { internalid: 22, name: "San Francisco" },
  { internalid: 23, name: "Austin" },
];

const CLASS_ROWS: Row[] = [
  { internalid: 31, name: "Enterprise" },
  { internalid: 32, name: "Mid-Market" },
  { internalid: 33, name: "SMB" },
];

const ITEM_NAMES = [
  "Analytics Platform",
  "Implementation Services",
  "Support Plan",
  "Forecasting Add-On",
  "Data Connectors",
  "Training Package",
  "Security Bundle",
  "Compliance Toolkit",
];

const FIRST_NAMES = ["Dana", "Miles", "Priya", "Jordan", "Alex", "Casey", "Morgan", "Taylor", "Riley", "Avery"];
const LAST_NAMES = ["Cole", "Shah", "Nair", "Lee", "Nguyen", "Martinez", "Patel", "Brown", "Wilson", "Smith"];
const COMPANY_WORDS_A = ["Apex", "Bright", "Northwind", "Vertex", "Summit", "Orion", "Bluefin", "Evergreen", "Trailhead", "Harbor"];
const COMPANY_WORDS_B = ["Retail", "Logistics", "Health", "Labs", "Foods", "Systems", "Capital", "Energy", "Works", "Industrial"];

export function generateScenario(config: GeneratorConfig, packageVersion: string): GeneratedScenario {
  const rng = new SeededRng(config.seed);

  const customers = generateCustomers(config, rng);
  const vendors = generateVendors(config, rng);
  const items = generateItems(config, rng);
  const periods = generateAccountingPeriods(config.asOfDate);
  const invoices = generateInvoices(config, rng, customers, items, periods);
  const customerPayments = generateCustomerPayments(rng, invoices);
  const creditMemos = generateCreditMemos(rng, customers, periods);
  const transactions = generateTransactions(config, rng, vendors, periods);

  applyProfile(config.profile, rng, invoices, transactions);

  const records = {
    accounts: ACCOUNT_ROWS,
    accountingperiod: periods,
    subsidiary: SUBSIDIARY_ROWS,
    vendor: vendors,
    customer: customers,
    department: DEPARTMENT_ROWS,
    location: LOCATION_ROWS,
    item: items,
    classification: CLASS_ROWS,
    invoice: invoices,
    customerpayment: customerPayments,
    creditmemo: creditMemos,
    transaction: transactions,
  };

  const datasets = REQUIRED_DATASETS.reduce((acc, key) => {
    acc[key] = `datasets/${key}.json`;
    return acc;
  }, {} as Record<(typeof REQUIRED_DATASETS)[number], string>);

  const manifest = {
    version: 1 as const,
    scenario: config.scenario,
    description: config.description || profileDescription(config.profile),
    as_of_date: config.asOfDate,
    datasets,
  };

  return {
    manifest,
    records,
    metadata: {
      generator_version: packageVersion,
      generated_at: new Date().toISOString(),
      seed: config.seed,
      config_hash: configHash(config),
    },
  };
}

function generateCustomers(config: GeneratorConfig, rng: SeededRng): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < config.counts.customers; i += 1) {
    const id = 5001 + i;
    const name = `${COMPANY_WORDS_A[i % COMPANY_WORDS_A.length]} ${COMPANY_WORDS_B[(i + 3) % COMPANY_WORDS_B.length]}`;
    const contact = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i + 2) % LAST_NAMES.length]}`;
    rows.push({
      internalid: id,
      entityid: name,
      email: `ap-${id}@example.com`,
      phone: `415-555-${String(1000 + i).padStart(4, "0")}`,
      altphone: `415-555-${String(2000 + i).padStart(4, "0")}`,
      fax: `415-555-${String(9000 + i).padStart(4, "0")}`,
      contact,
      altemail: `finance-${id}@example.com`,
      companyname: name,
      riskScore: rng.int(10, 90),
    });
  }
  return rows;
}

function generateVendors(config: GeneratorConfig, rng: SeededRng): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < config.counts.vendors; i += 1) {
    const id = 7001 + i;
    const name = `${COMPANY_WORDS_A[(i + 1) % COMPANY_WORDS_A.length]} Services ${i + 1}`;
    rows.push({
      internalid: id,
      entityid: name,
      email: `billing-${id}@example.com`,
      phone: `212-555-${String(1000 + i).padStart(4, "0")}`,
      altphone: `212-555-${String(2000 + i).padStart(4, "0")}`,
      fax: `212-555-${String(9000 + i).padStart(4, "0")}`,
      altemail: `accounting-${id}@example.com`,
      spendTier: rng.pick(["gold", "silver", "bronze"]),
    });
  }
  return rows;
}

function generateItems(config: GeneratorConfig, rng: SeededRng): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < config.counts.items; i += 1) {
    const id = 9001 + i;
    const name = ITEM_NAMES[i % ITEM_NAMES.length];
    rows.push({
      internalid: id,
      itemid: `SKU-${String(id)}`,
      displayname: name,
      salesdescription: `${name} package`,
      type: i % 2 === 0 ? "NonInvtPart" : "InvtPart",
      baseprice: String(rng.int(1000, 25000)),
    });
  }
  return rows;
}

function generateAccountingPeriods(asOfDate: string): Row[] {
  const anchor = new Date(`${asOfDate}T00:00:00Z`);
  const months: Row[] = [];
  for (let i = -2; i <= 0; i += 1) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + i, 1));
    const start = isoDate(d);
    const end = isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
    months.push({
      internalid: 301 + i + 2,
      periodname: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      startDate: start,
      endDate: end,
      isQuarter: "F",
      isYear: "F",
    });
  }

  const qStart = new Date(Date.UTC(anchor.getUTCFullYear(), Math.floor(anchor.getUTCMonth() / 3) * 3, 1));
  const qEnd = new Date(Date.UTC(qStart.getUTCFullYear(), qStart.getUTCMonth() + 3, 0));
  months.push({
    internalid: 399,
    periodname: `Q${Math.floor(anchor.getUTCMonth() / 3) + 1} ${anchor.getUTCFullYear()}`,
    startDate: isoDate(qStart),
    endDate: isoDate(qEnd),
    isQuarter: "T",
    isYear: "F",
  });

  return months;
}

function generateInvoices(config: GeneratorConfig, rng: SeededRng, customers: Row[], items: Row[], periods: Row[]): Row[] {
  const rows: Row[] = [];
  const periodRows = periods.filter((p) => p.isQuarter === "F");

  for (let i = 0; i < config.counts.invoices; i += 1) {
    const id = 8101 + i;
    const customer = customers[i % customers.length];
    const item = items[i % items.length];
    const period = periodRows[i % periodRows.length];
    const trandate = randomDateInPeriod(rng, String(period.startDate), String(period.endDate));
    const dueDate = addDays(trandate, 30);
    const amount = rng.int(3000, 65000);
    const isOpen = rng.next() < 0.65;
    const amountremaining = isOpen ? amount : 0;
    const accountId = i % 2 === 0 ? 1110 : 1120;
    const accountText = accountId === 1110 ? "A/R - Enterprise" : "A/R - Mid Market";

    rows.push({
      internalid: id,
      tranid: `INV-${id}`,
      trandate,
      postingperiod: { internalid: period.internalid, text: period.periodname },
      customer: { internalid: customer.internalid, entityid: customer.entityid },
      entity: { internalid: customer.internalid, text: customer.entityid },
      account: { internalid: accountId, number: String(accountId), text: accountText },
      status: isOpen ? "Open" : "Paid In Full",
      amount,
      amountremaining,
      duedate: dueDate,
      memo: "Generated invoice",
      type: "CustInvc",
      mainline: "T",
      memorized: "F",
      item: { internalid: item.internalid, type: "Service" },
    });
  }

  return rows;
}

function generateCustomerPayments(rng: SeededRng, invoices: Row[]): Row[] {
  const paidInvoices = invoices.filter((i) => Number(i.amountremaining || 0) === 0);
  const payments = paidInvoices.slice(0, Math.max(1, Math.floor(invoices.length / 4)));

  return payments.map((invoice, idx) => ({
    internalid: 8201 + idx,
    trandate: addDays(String(invoice.trandate), rng.int(7, 20)),
    amount: String(invoice.amount),
    customerMain: {
      internalid: (invoice.customer as Row).internalid,
      companyname: (invoice.customer as Row).entityid,
    },
  }));
}

function generateCreditMemos(rng: SeededRng, customers: Row[], periods: Row[]): Row[] {
  const rows: Row[] = [];
  const n = Math.max(1, Math.floor(customers.length / 3));
  const periodRows = periods.filter((p) => p.isQuarter === "F");

  for (let i = 0; i < n; i += 1) {
    const customer = customers[i];
    const period = periodRows[(i + 1) % periodRows.length];
    rows.push({
      internalid: 8301 + i,
      trandate: randomDateInPeriod(rng, String(period.startDate), String(period.endDate)),
      amount: String(rng.int(500, 5000)),
      customerMain: {
        internalid: customer.internalid,
        companyname: customer.companyname,
      },
    });
  }

  return rows;
}

function generateTransactions(config: GeneratorConfig, rng: SeededRng, vendors: Row[], periods: Row[]): Row[] {
  const rows: Row[] = [];
  const periodRows = periods.filter((p) => p.isQuarter === "F");

  for (let i = 0; i < config.counts.transactions; i += 1) {
    const id = 8401 + i;
    const vendor = vendors[i % vendors.length];
    const period = periodRows[i % periodRows.length];
    const trandate = randomDateInPeriod(rng, String(period.startDate), String(period.endDate));
    const type = rng.pick(["VendBill", "VendPymt", "Journal"]);
    const amount = rng.int(2500, 70000);
    const status = type === "VendPymt" ? "Paid In Full" : rng.pick(["Open", "Pending Approval"]);
    const accountId = type === "Journal" ? 1110 : 6100;

    rows.push({
      internalid: id,
      trandate,
      postingperiod: { internalid: period.internalid, text: period.periodname },
      closedate: status === "Open" ? "" : addDays(trandate, rng.int(5, 22)),
      type,
      tranid: `${type.toUpperCase()}-${id}`,
      transactionnumber: `TX-${id}`,
      amount,
      account: { internalid: accountId, number: String(accountId), text: accountId === 6100 ? "Operations Expense" : "A/R - Enterprise" },
      memomain: "Generated transaction",
      memo: "Generated transaction",
      vendor: { internalid: vendor.internalid, entityid: vendor.entityid },
      department: { internalid: i % 2 === 0 ? 12 : 11, text: i % 2 === 0 ? "Operations" : "Sales" },
      subsidiary: { internalid: 2, text: "US" },
      amortizationSchedule: { name: type === "Journal" ? "" : "Generated Schedule" },
      revrecstartdate: type === "Journal" ? "" : trandate,
      revrecenddate: type === "Journal" ? "" : addDays(trandate, 30),
      status,
      entity: vendor.entityid,
      class: { name: i % 2 === 0 ? "Enterprise" : "Mid-Market" },
      location: { name: i % 2 === 0 ? "San Francisco" : "New York" },
      posting: "T",
      accounttype: accountId === 6100 ? "Expense" : "Income",
      accountingperiod: {
        startdate: usDate(new Date(`${period.startDate}T00:00:00Z`)),
        enddate: usDate(new Date(`${period.endDate}T00:00:00Z`)),
      },
    });
  }

  return rows;
}

function applyProfile(profile: Profile, rng: SeededRng, invoices: Row[], transactions: Row[]): void {
  if (profile === "ar_spike") {
    const spikeCustomerId = (invoices[0]?.customer as Row | undefined)?.internalid;
    for (const invoice of invoices) {
      if ((invoice.customer as Row)?.internalid === spikeCustomerId || rng.next() < 0.55) {
        invoice.status = "Open";
        invoice.amountremaining = invoice.amount;
      }
    }
  }

  if (profile === "revenue_drop") {
    const sorted = [...invoices].sort((a, b) => String(a.trandate).localeCompare(String(b.trandate)));
    const half = Math.floor(sorted.length / 2);
    for (let i = half; i < sorted.length; i += 1) {
      sorted[i].amount = Math.max(500, Math.floor(Number(sorted[i].amount) * 0.6));
      sorted[i].amountremaining = Math.min(Number(sorted[i].amountremaining || 0), Number(sorted[i].amount));
    }

    for (const txn of transactions) {
      if (txn.type === "Journal") {
        txn.amount = Math.floor(Number(txn.amount) * 0.7);
      }
    }
  }
}

function randomDateInPeriod(rng: SeededRng, isoStart: string, isoEnd: string): string {
  const start = new Date(`${isoStart}T00:00:00Z`).getTime();
  const end = new Date(`${isoEnd}T00:00:00Z`).getTime();
  const ts = rng.int(start, end);
  return usDate(new Date(ts));
}

function addDays(usDateString: string, days: number): string {
  const parsed = parseUsDate(usDateString);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return usDate(parsed);
}

function parseUsDate(value: string): Date {
  const [month, day, year] = value.split("/").map((n) => Number(n));
  return new Date(Date.UTC(year, month - 1, day));
}

function usDate(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function profileDescription(profile: Profile): string {
  if (profile === "ar_spike") {
    return "Generated AR spike scenario with elevated open receivables";
  }
  if (profile === "revenue_drop") {
    return "Generated revenue drop scenario with declining invoice values";
  }
  return "Generated baseline scenario";
}
