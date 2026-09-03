//URL<->ComparePanel "Compare to" target mapping (PlayerTabs.tsx); pure + DOM-free so it unit-tests.
export const DEFAULT_COMPARE_TARGET = 'same';
export const COMPARE_TARGET_PARAM = 'target';
export const COMPARE_TARGET_CHANGE_EVENT = 'ranklock:comparetarget';

export function compareTargetFromParam(raw: string | null | undefined): string {
  return raw != null && raw.trim() ? raw.trim() : DEFAULT_COMPARE_TARGET;
}

export function compareTargetToParam(target: string): string | null {
  return target === DEFAULT_COMPARE_TARGET ? null : target;
}
