import type {
	Taxonomy,
	AIModel,
	BenchmarkData,
	FilterState,
	ScenarioIndex,
	MetricMeta
} from '../types';
import type { NutritionCategory, NutritionCategoryDetail } from '../data';
import { humanizeName } from '../utils';

// ===== App State (Svelte 5 runes) =====
// Single shared reactive object. appData.ts owns the $state root and the
// "real page-load data" fields; filters.ts (loaded alongside it) adds
// filter-selection and metadata-lookup fields to this same object rather
// than creating a second one — appState must stay one object so every
// consumer sees the same reactive instance.

export const appState = $state({
	taxonomy: null as Taxonomy | null,
	models: [] as AIModel[],
	benchmarkData: {} as BenchmarkData,
	scenarioIndex: null as ScenarioIndex | null,
	metricCriteria: {} as Record<string, string>,
	metricMeta: {} as Record<string, MetricMeta>,
	nutritionScore: [] as NutritionCategory[],
	nutritionCat: [] as NutritionCategoryDetail[],
	filters: { model: 'claude-haiku-4-5', age: 'adult' } as FilterState,
	loading: true,
	error: null as string | null
});

export function setData(taxonomy: Taxonomy, models: AIModel[], benchmarkData: BenchmarkData) {
	appState.taxonomy = normalizeTaxonomyNames(taxonomy);
	appState.models = models;
	appState.benchmarkData = benchmarkData;
	appState.loading = false;
}

function normalizeTaxonomyNames(taxonomy: Taxonomy): Taxonomy {
	return {
		...taxonomy,
		areas: taxonomy.areas.map((area) => ({
			...area,
			name: humanizeName(area.name),
			subareas: area.subareas.map((sub) => ({
				...sub,
				name: humanizeName(sub.name),
				metrics: sub.metrics.map((m) => ({ ...m, name: humanizeName(m.name) }))
			}))
		}))
	};
}
