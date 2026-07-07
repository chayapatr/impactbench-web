import type { ScenarioIndex, MetricMeta } from '../types';
import type { NutritionCategory, NutritionCategoryDetail } from '../data';
import { appState } from './appData.svelte';
import type { FilterState } from '../types';

// ===== Filters + supporting metadata lookups =====
// filters.ts adds these fields onto the single shared appState object
// declared in appData.ts (see the note there) rather than declaring its
// own $state root.

export function setFilters(filters: FilterState) {
	appState.filters = filters;
}

export function setScenarioIndex(idx: ScenarioIndex) {
	appState.scenarioIndex = idx;
}

export function setMetricCriteria(criteria: Record<string, string>) {
	appState.metricCriteria = criteria;
}

export function setMetricMeta(meta: Record<string, MetricMeta>) {
	appState.metricMeta = meta;
}

export function setNutritionScore(score: NutritionCategory[]) {
	appState.nutritionScore = score;
}

export function setNutritionCat(cat: NutritionCategoryDetail[]) {
	appState.nutritionCat = cat;
}
