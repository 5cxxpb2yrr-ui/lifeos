/**
 * Transaction Intelligence is a transient analysis pipeline.
 * Callers should persist only the returned aggregate summary, reviewed decisions,
 * approved canonical records, and (only when explicitly requested) an archive.
 * This module never writes to the LifeOS database.
 */
export type TransactionDirection = "inflow" | "outflow" | "transfer" | "unknown";
export type TransactionConfidence = "high" | "medium" | "low";

export interface TransactionInput {
  transaction_id?: string; transactionId?: string; id?: string;
  date?: string; transactionDate?: string; posted_datetime?: string;
  amount?: number | string; amountMinor?: number | string;
  name?: string; merchant_name?: string; merchant?: string; description?: string;
  account_id?: string; accountId?: string; account_name?: string; institution?: string;
  category?: string | string[]; personal_finance_category?: { primary?: string; detailed?: string };
  pending?: boolean; currency?: string; iso_currency_code?: string;
}

export interface ParsedTransaction {
  sourceTransactionId?: string;
  date: string;
  amountMinor: number;
  direction: TransactionDirection;
  merchant: string;
  description: string;
  category: string;
  accountId?: string;
  accountName?: string;
  institution?: string;
  currency: string;
  pending: boolean;
  confidence: TransactionConfidence;
  signals: string[];
}

export interface TransactionRecommendation {
  id: string;
  kind: "review" | "recurring_candidate" | "possible_fee" | "cash_pressure";
  title: string;
  explanation: string;
  confidence: TransactionConfidence;
  evidence: string[];
}

export interface TransactionIntelligenceSummary {
  schemaVersion: "lifeos-transaction-summary.v1";
  generatedAt: string;
  period: { startDate: string; endDate: string };
  source: { institution?: string; accountNames: string[]; currencies: string[] };
  transactionCount: number;
  pendingCount: number;
  inflowMinor: number;
  outflowMinor: number;
  transferMinor: number;
  netFlowMinor: number;
  categoryTotals: Array<{ category: string; direction: "inflow" | "outflow"; totalMinor: number; count: number }>;
  recommendations: TransactionRecommendation[];
  retention: {
    rawTransactionsPersisted: false;
    policy: "discard-by-default";
    archiveCreated: boolean;
    archiveManifestRequired: true;
  };
}

export interface ArchiveManifest {
  schemaVersion: "lifeos-transaction-archive-manifest.v1";
  createdAt: string;
  archiveId: string;
  institution?: string;
  accountNames: string[];
  period: { startDate: string; endDate: string };
  transactionCount: number;
  pendingCount: number;
  currencies: string[];
  totalsMinor: { inflow: number; outflow: number; transfer: number; netFlow: number };
  categoryTotals: TransactionIntelligenceSummary["categoryTotals"];
  archive: { containsIndividualTransactions: true; encryptionRequired: true; privateStorageRequired: true };
  retention: { expiresAt?: string; deletionReviewedAt?: string };
}

const asText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const dateOnly = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? "";
};
const amount = (value: unknown): number => {
  const n = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : NaN;
};
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
const normalizeCategory = (row: TransactionInput): string => {
  const provider = row.personal_finance_category?.detailed || row.personal_finance_category?.primary;
  const category = Array.isArray(row.category) ? row.category.filter(Boolean).join(" / ") : asText(row.category);
  return (asText(provider) || category || "Uncategorized").replace(/_/g, " ").trim();
};

function hasCategoryDirectionMismatch(category: string, direction: TransactionDirection): boolean {
  const value = category.toLowerCase().replace(/[_/]+/g, " ");
  const expenseTerms = ["food", "drink", "coffee", "fast food", "merchandise", "shopping", "gift", "transportation", "taxi", "ride share", "utility", "rent", "mortgage", "loan payment", "bill", "fee", "travel", "flight", "entertainment", "subscription"];
  const incomeTerms = ["income", "payroll", "salary", "wages", "interest earned", "dividend", "deposit"];
  const expenseLike = expenseTerms.some(term => value.includes(term));
  const incomeLike = incomeTerms.some(term => value.includes(term));
  return (direction === "inflow" && expenseLike) || (direction === "outflow" && incomeLike);
}

export function parseConnectedTransactions(rows: TransactionInput[]): ParsedTransaction[] {
  const parsed: ParsedTransaction[] = [];
  for (const row of rows) {
    const date = dateOnly(row.posted_datetime ?? row.date ?? row.transactionDate);
    const raw = row.amountMinor != null ? amount(row.amountMinor) : amount(row.amount);
    if (!date || !Number.isFinite(raw) || raw === 0) continue;
    const description = [row.name, row.description].map(asText).filter(Boolean).join(" — ");
    const merchant = asText(row.merchant_name) || asText(row.merchant) || asText(row.name) || "Unknown merchant";
    const label = [merchant, description, normalizeCategory(row)].join(" ").toLowerCase();
    const signals: string[] = [];
    const isTransfer = /\b(transfer|payment to own account|internal transfer|account transfer)\b/.test(label);
    const isRefund = /\b(refund|reversal|cashback)\b/.test(label);
    // Plaid convention: positive amount is money leaving the account; negative is money entering.
    const direction: TransactionDirection = isTransfer ? "transfer" : raw < 0 || isRefund ? "inflow" : raw > 0 ? "outflow" : "unknown";
    if (isTransfer) signals.push("transfer-language");
    if (isRefund) signals.push("refund-language");
    if (row.pending === true) signals.push("pending");
    if (row.personal_finance_category?.detailed || row.personal_finance_category?.primary || row.category) signals.push("provider-category");
    if (hasCategoryDirectionMismatch(normalizeCategory(row), direction)) signals.push("category-direction-mismatch");
    const hasStableId = Boolean(row.transaction_id || row.transactionId || row.id);
    if (hasStableId) signals.push("source-id");
    parsed.push({
      sourceTransactionId: asText(row.transaction_id || row.transactionId || row.id) || undefined,
      date,
      amountMinor: Math.round(Math.abs(raw) * (row.amountMinor != null ? 1 : 100)),
      direction,
      merchant,
      description: description || merchant,
      category: normalizeCategory(row),
      accountId: asText(row.account_id || row.accountId) || undefined,
      accountName: asText(row.account_name) || undefined,
      institution: asText(row.institution) || undefined,
      currency: asText(row.currency || row.iso_currency_code) || "USD",
      pending: row.pending === true,
      confidence: isTransfer || hasStableId ? "high" : (row.category || row.personal_finance_category ? "medium" : "low"),
      signals
    });
  }
  return parsed.sort((a, b) => a.date.localeCompare(b.date) || (a.sourceTransactionId ?? "").localeCompare(b.sourceTransactionId ?? ""));
}

const sum = (rows: ParsedTransaction[], direction: TransactionDirection) =>
  rows.filter(row => row.direction === direction).reduce((total, row) => total + row.amountMinor, 0);

export function buildTransactionRecommendations(rows: ParsedTransaction[]): TransactionRecommendation[] {
  const recommendations: TransactionRecommendation[] = [];
  const merchantGroups = new Map<string, ParsedTransaction[]>();
  for (const row of rows.filter(item => !item.pending && item.direction === "outflow")) {
    const key = row.merchant.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    merchantGroups.set(key, [...(merchantGroups.get(key) ?? []), row]);
  }
  for (const [merchant, items] of merchantGroups) {
    const distinctDates = unique(items.map(item => item.date));
    if (merchant && distinctDates.length >= 3) {
      recommendations.push({
        id: "recurring:" + merchant.replace(/\s+/g, "-"),
        kind: "recurring_candidate",
        title: "Review possible recurring charge",
        explanation: "This merchant appears on at least three separate posted dates. Confirm whether it is a bill or subscription before adding a recurring rule.",
        confidence: "medium",
        evidence: [items[0].merchant, distinctDates.length + " separate dates", "Median transaction amount " + median(items.map(item => item.amountMinor)) + " minor units"]
      });
    }
  }
  for (const row of rows.filter(item => !item.pending && /\b(fee|overdraft|nsf|late charge|service charge)\b/i.test(item.description + " " + item.category))) {
    recommendations.push({
      id: "fee:" + (row.sourceTransactionId ?? row.date + ":" + row.amountMinor),
      kind: "possible_fee",
      title: "Review possible bank or service fee",
      explanation: "This transaction text resembles a fee. Verify the charge before taking action.",
      confidence: row.confidence,
      evidence: [row.date, row.merchant, row.category, row.amountMinor + " minor units"]
    });
  }
  for (const row of rows.filter(item => item.direction === "unknown" || item.category === "Uncategorized" || item.signals.includes("category-direction-mismatch"))) {
    const mismatch = row.signals.includes("category-direction-mismatch");
    recommendations.push({
      id: "review:" + (row.sourceTransactionId ?? row.date + ":" + row.amountMinor),
      kind: "review",
      title: mismatch ? "Review category and money direction" : "Review transaction classification",
      explanation: mismatch
        ? "The provider category looks unusual for the parsed money direction. The original category is preserved; verify it before using it in a forecast."
        : "The available bank fields are not enough to confidently classify this item. It is excluded from category-based recommendations until reviewed.",
      confidence: "low",
      evidence: [row.date, row.merchant, row.category, "direction: " + row.direction]
    });
  }
  return recommendations;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function summarizeTransactions(rows: ParsedTransaction[], generatedAt = new Date().toISOString()): TransactionIntelligenceSummary {
  const startDate = rows.reduce((min, row) => !min || row.date < min ? row.date : min, "");
  const endDate = rows.reduce((max, row) => row.date > max ? row.date : max, "");
  const categories = new Map<string, { category: string; direction: "inflow" | "outflow"; totalMinor: number; count: number }>();
  for (const row of rows) {
    if (row.direction !== "inflow" && row.direction !== "outflow") continue;
    const key = row.direction + "|" + row.category;
    const current = categories.get(key) ?? { category: row.category, direction: row.direction, totalMinor: 0, count: 0 };
    current.totalMinor += row.amountMinor;
    current.count += 1;
    categories.set(key, current);
  }
  const inflow = sum(rows, "inflow");
  const outflow = sum(rows, "outflow");
  const transfer = sum(rows, "transfer");
  return {
    schemaVersion: "lifeos-transaction-summary.v1",
    generatedAt,
    period: { startDate, endDate },
    source: {
      institution: unique(rows.map(row => row.institution ?? ""))[0],
      accountNames: unique(rows.map(row => row.accountName ?? "")),
      currencies: unique(rows.map(row => row.currency))
    },
    transactionCount: rows.length,
    pendingCount: rows.filter(row => row.pending).length,
    inflowMinor: inflow,
    outflowMinor: outflow,
    transferMinor: transfer,
    netFlowMinor: inflow - outflow,
    categoryTotals: [...categories.values()].sort((a, b) => a.category.localeCompare(b.category) || a.direction.localeCompare(b.direction)),
    recommendations: buildTransactionRecommendations(rows),
    retention: { rawTransactionsPersisted: false, policy: "discard-by-default", archiveCreated: false, archiveManifestRequired: true }
  };
}

export function buildArchiveManifest(
  summary: TransactionIntelligenceSummary,
  archiveId: string,
  options: { createdAt?: string; expiresAt?: string; deletionReviewedAt?: string } = {}
): ArchiveManifest {
  if (!archiveId.trim()) throw new Error("An archive ID is required.");
  return {
    schemaVersion: "lifeos-transaction-archive-manifest.v1",
    createdAt: options.createdAt ?? summary.generatedAt,
    archiveId,
    institution: summary.source.institution,
    accountNames: [...summary.source.accountNames],
    period: { ...summary.period },
    transactionCount: summary.transactionCount,
    pendingCount: summary.pendingCount,
    currencies: [...summary.source.currencies],
    totalsMinor: { inflow: summary.inflowMinor, outflow: summary.outflowMinor, transfer: summary.transferMinor, netFlow: summary.netFlowMinor },
    categoryTotals: summary.categoryTotals.map(item => ({ ...item })),
    archive: { containsIndividualTransactions: true, encryptionRequired: true, privateStorageRequired: true },
    retention: { expiresAt: options.expiresAt, deletionReviewedAt: options.deletionReviewedAt }
  };
}

export interface ForecastScenarioAdjustment { date: string; amountMinor: number; direction: "inflow" | "outflow"; label: string; }
export interface ScenarioForecastPoint { date: string; baselineClosingBalanceMinor: number; scenarioClosingBalanceMinor: number; deltaMinor: number; }
export interface ForecastScenarioResult { baselineUnchanged: true; scenarioEndingBalanceMinor: number; minimumScenarioBalanceMinor: number; firstNegativeDate?: string; points: ScenarioForecastPoint[]; }

/** Applies hypothetical changes to a copy of forecast points; never mutates baseline data. */
export function applyForecastScenario(
  baseline: Array<{ date: string; closingBalanceMinor: number }>,
  adjustments: ForecastScenarioAdjustment[]
): ForecastScenarioResult {
  let cumulativeDelta = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let firstNegativeDate: string | undefined;
  const points = baseline.map(point => {
    const dayDelta = adjustments.filter(item => item.date === point.date).reduce((total, item) => total + (item.direction === "inflow" ? Math.abs(item.amountMinor) : -Math.abs(item.amountMinor)), 0);
    cumulativeDelta += dayDelta;
    const scenarioClosingBalanceMinor = point.closingBalanceMinor + cumulativeDelta;
    minimum = Math.min(minimum, scenarioClosingBalanceMinor);
    if (scenarioClosingBalanceMinor < 0 && !firstNegativeDate) firstNegativeDate = point.date;
    return { date: point.date, baselineClosingBalanceMinor: point.closingBalanceMinor, scenarioClosingBalanceMinor, deltaMinor: cumulativeDelta };
  });
  return { baselineUnchanged: true, scenarioEndingBalanceMinor: points.at(-1)?.scenarioClosingBalanceMinor ?? 0, minimumScenarioBalanceMinor: Number.isFinite(minimum) ? minimum : 0, firstNegativeDate, points };
}
