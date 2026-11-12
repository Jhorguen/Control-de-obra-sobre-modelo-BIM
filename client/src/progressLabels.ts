import type { ProgressStatus, StatusMapEntry } from '@bim/shared';
import { t } from './i18n/core';
import type { StatusColorGroups } from './viewer/BimViewer';

export function statusLabel(status: ProgressStatus): string {
  return t(`status.${status}`);
}

export function groupGuidsByStatus(entries: readonly StatusMapEntry[]): StatusColorGroups {
  const groups: Record<ProgressStatus, string[]> = { PENDING: [], IN_PROGRESS: [], DONE: [] };
  for (const entry of entries) groups[entry.status].push(entry.globalId);
  return groups;
}

/** Today as YYYY-MM-DD in the user's time zone (en-CA formats dates that way). */
export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}
