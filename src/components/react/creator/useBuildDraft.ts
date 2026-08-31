//Working-build state for the Build Creator. Holds the parts of a BuildInput plus the single
//global conditionals switch, and derives the BuildInput the calculator / share / draft APIs
//consume — `conditionalsOn` is derived, so a shared or saved build always matches the panels.
import { useCallback, useMemo, useState } from 'react';
import type { BuildInput } from '../../../lib/computeStats';
import { MAX_ITEMS } from './buildModel';

interface DraftState {
  heroId: number | null;
  patch: string | undefined;
  items: number[];
  imbueTargets: Record<number, number>;
  conditionalItems: number[];
  upgradesFrom: Record<number, number>;
  conditionalsEnabled: boolean;
}

const EMPTY: DraftState = {
  heroId: null,
  patch: undefined,
  items: [],
  imbueTargets: {},
  conditionalItems: [],
  upgradesFrom: {},
  conditionalsEnabled: true,
};

function omitKey(rec: Record<number, number>, key: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (Number(k) !== key) out[Number(k)] = v;
  }
  return out;
}

export interface BuildDraft {
  heroId: number | null;
  build: BuildInput;
  conditionalsEnabled: boolean;
  selectHero: (heroId: number, patch?: string) => void;
  addItem: (itemId: number) => void;
  removeItem: (itemId: number) => void;
  setImbue: (itemId: number, abilityId: number | null) => void;
  toggleConditional: (itemId: number) => void;
  setConditionalsEnabled: (on: boolean) => void;
  loadBuild: (build: BuildInput) => void;
  clearItems: () => void;
}

export function useBuildDraft(): BuildDraft {
  const [state, setState] = useState<DraftState>(EMPTY);

  //Re-picking the SAME hero only refreshes the patch stamp; switching heroes rebuilds from empty.
  const selectHero = useCallback((heroId: number, patch?: string) => {
    setState((p) => (p.heroId === heroId ? { ...p, patch } : { ...EMPTY, heroId, patch }));
  }, []);

  const addItem = useCallback((itemId: number) => {
    setState((p) =>
      p.items.includes(itemId) || p.items.length >= MAX_ITEMS ? p : { ...p, items: [...p.items, itemId] },
    );
  }, []);

  const removeItem = useCallback((itemId: number) => {
    setState((p) => ({
      ...p,
      items: p.items.filter((i) => i !== itemId),
      imbueTargets: omitKey(p.imbueTargets, itemId),
      conditionalItems: p.conditionalItems.filter((i) => i !== itemId),
      upgradesFrom: omitKey(p.upgradesFrom, itemId),
    }));
  }, []);

  const setImbue = useCallback((itemId: number, abilityId: number | null) => {
    setState((p) => ({
      ...p,
      imbueTargets: abilityId == null ? omitKey(p.imbueTargets, itemId) : { ...p.imbueTargets, [itemId]: abilityId },
    }));
  }, []);

  const toggleConditional = useCallback((itemId: number) => {
    setState((p) => ({
      ...p,
      conditionalItems: p.conditionalItems.includes(itemId)
        ? p.conditionalItems.filter((i) => i !== itemId)
        : [...p.conditionalItems, itemId],
    }));
  }, []);

  const setConditionalsEnabled = useCallback((on: boolean) => {
    setState((p) => ({ ...p, conditionalsEnabled: on }));
  }, []);

  const loadBuild = useCallback((build: BuildInput) => {
    setState({
      heroId: build.heroId > 0 ? build.heroId : null,
      patch: build.patch,
      items: [...build.items],
      imbueTargets: { ...(build.imbueTargets ?? {}) },
      conditionalItems: [...(build.conditionalItems ?? [])],
      upgradesFrom: { ...(build.upgradesFrom ?? {}) },
      //the wire carries the expanded set, not the switch: flagged-but-none-on means "off".
      conditionalsEnabled: (build.conditionalsOn?.length ?? 0) > 0 || (build.conditionalItems?.length ?? 0) === 0,
    });
  }, []);

  const clearItems = useCallback(() => {
    setState((p) => ({ ...EMPTY, heroId: p.heroId, patch: p.patch, conditionalsEnabled: p.conditionalsEnabled }));
  }, []);

  const build = useMemo<BuildInput>(
    () => ({
      heroId: state.heroId ?? 0,
      patch: state.patch,
      items: state.items,
      imbueTargets: state.imbueTargets,
      conditionalItems: state.conditionalItems,
      conditionalsOn: state.conditionalsEnabled ? state.conditionalItems : [],
      upgradesFrom: state.upgradesFrom,
    }),
    [state],
  );

  return {
    heroId: state.heroId,
    build,
    conditionalsEnabled: state.conditionalsEnabled,
    selectHero,
    addItem,
    removeItem,
    setImbue,
    toggleConditional,
    setConditionalsEnabled,
    loadBuild,
    clearItems,
  };
}
