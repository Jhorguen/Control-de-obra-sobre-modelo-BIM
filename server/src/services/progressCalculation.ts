import type { CurvePoint, LevelProgress, ProgressStatus, ProgressSummary } from '@bim/shared';
import {
  computeItemTotals,
  sumDecimals,
  type CalcElement,
  type CalcItem,
} from './budgetCalculation.js';

// Progress measures as pure functions (see PLAN.md, "Fórmulas de avance").

export interface HistoryEntry {
  status: ProgressStatus;
  /** YYYY-MM-DD */
  date: string;
  createdAt: Date;
}

export interface ProgressElement extends Omit<CalcElement, 'executed'> {
  level: string | null;
  plannedDate: string | null;
  history: readonly HistoryEntry[];
}

/**
 * Status of an element at a date: its latest record on or before that date, ordered by
 * date and then by creation time (several records on the same day: the last one wins).
 * Without records the element is PENDING. Without a date, the latest record overall.
 */
export function statusAt(history: readonly HistoryEntry[], date?: string): ProgressStatus {
  let latest: HistoryEntry | null = null;
  for (const entry of history) {
    if (date !== undefined && entry.date > date) continue;
    if (
      latest === null ||
      entry.date > latest.date ||
      (entry.date === latest.date && entry.createdAt > latest.createdAt)
    ) {
      latest = entry;
    }
  }
  return latest?.status ?? 'PENDING';
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

function valueTotals(
  items: readonly CalcItem[],
  elements: readonly ProgressElement[],
  isExecuted: (element: ProgressElement) => boolean,
) {
  const totals = computeItemTotals(
    items,
    elements.map((element) => ({ ...element, executed: isExecuted(element) })),
  );
  return {
    budget: sumDecimals(totals.map((t) => t.subtotal)),
    executed: sumDecimals(totals.map((t) => t.executedValue)),
  };
}

/**
 * Cumulative planned and executed value at every date that appears in the plan or the log.
 * Each point reuses the budget arithmetic, so the last executed point equals the executed
 * value of the dashboard and of the budget table.
 */
export function computeCurve(
  items: readonly CalcItem[],
  elements: readonly ProgressElement[],
): CurvePoint[] {
  const dates = new Set<string>();
  for (const element of elements) {
    if (element.plannedDate) dates.add(element.plannedDate);
    for (const entry of element.history) dates.add(entry.date);
  }
  return [...dates].sort().map((date) => {
    const executed = valueTotals(items, elements, (e) => statusAt(e.history, date) === 'DONE');
    const planned = valueTotals(
      items,
      elements,
      (e) => e.plannedDate !== null && e.plannedDate <= date,
    );
    return { date, planned: planned.executed.toNumber(), executed: executed.executed.toNumber() };
  });
}

export function computeProgressSummary(
  items: readonly CalcItem[],
  elements: readonly ProgressElement[],
): ProgressSummary {
  // Only elements with a budget item are in scope: an element nobody priced is not "work".
  const scoped = elements.filter((e) => e.budgetItemIds.length > 0);
  const statuses = new Map(scoped.map((e) => [e.id, statusAt(e.history)]));
  const isDone = (e: ProgressElement) => statuses.get(e.id) === 'DONE';

  const counts = { withItem: scoped.length, pending: 0, inProgress: 0, done: 0 };
  for (const status of statuses.values()) {
    if (status === 'DONE') counts.done++;
    else if (status === 'IN_PROGRESS') counts.inProgress++;
    else counts.pending++;
  }

  const overall = valueTotals(items, scoped, isDone);

  const levels = new Map<string | null, ProgressElement[]>();
  for (const element of scoped) {
    const list = levels.get(element.level) ?? [];
    list.push(element);
    levels.set(element.level, list);
  }
  const byLevel: LevelProgress[] = [...levels.entries()]
    .map(([level, levelElements]) => {
      const values = valueTotals(items, levelElements, isDone);
      const done = levelElements.filter(isDone).length;
      return {
        level,
        elements: levelElements.length,
        done,
        physicalProgress: ratio(done, levelElements.length),
        budget: values.budget.toNumber(),
        executedValue: values.executed.toNumber(),
        financialProgress: ratio(values.executed.toNumber(), values.budget.toNumber()),
      };
    })
    .sort((a, b) =>
      a.level === null ? 1 : b.level === null ? -1 : a.level.localeCompare(b.level, 'es'),
    );

  const budgetTotal = overall.budget.toNumber();
  const executedValue = overall.executed.toNumber();
  return {
    budgetTotal,
    executedValue,
    financialProgress: ratio(executedValue, budgetTotal),
    physicalProgress: ratio(counts.done, counts.withItem),
    counts,
    byLevel,
    curve: computeCurve(items, scoped),
    hasPlan: scoped.some((e) => e.plannedDate !== null),
  };
}
