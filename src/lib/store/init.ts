import {
	loadTaxonomy,
	loadModels,
	loadBenchmarkData,
	loadScenarioIndex,
	loadMetricCriteria,
	loadMetricMeta,
	loadNutritionScore,
	loadNutritionCat
} from '../data';
import { appState, setData } from './appData.svelte';
import {
	setScenarioIndex,
	setMetricCriteria,
	setMetricMeta,
	setNutritionScore,
	setNutritionCat
} from './filters.svelte';

// ===== One-shot app data bootstrap =====
// Called from the root layout on mount. Loads the core datasets up front,
// then the heavier lookups (scenario index, criteria, nutrition data) in
// the background.

let pending: Promise<void> | null = null;

// Idempotent: concurrent/repeat callers share the same in-flight load.
// Awaiting it is also how callers know the initial datasets have landed.
export function initAppData(): Promise<void> {
	pending ??= load();
	return pending;
}

// Re-fetches everything, for callers that overwrote appState with their own
// dataset (the /viewer import) and need the real one back on exit.
export function reloadAppData(): Promise<void> {
	pending = null;
	return initAppData();
}

async function load() {
	appState.loading = true;
	appState.error = null;

	try {
		const [taxonomy, models, benchmarkData] = await Promise.all([
			loadTaxonomy(),
			loadModels(),
			loadBenchmarkData()
		]);
		setData(taxonomy, models, benchmarkData);

		loadScenarioIndex()
			.then(setScenarioIndex)
			.catch((e) => console.warn('Failed to load scenario index:', e));
		loadMetricCriteria()
			.then(setMetricCriteria)
			.catch((e) => console.warn('Failed to load metric criteria:', e));
		loadMetricMeta()
			.then(setMetricMeta)
			.catch((e) => console.warn('Failed to load metric meta:', e));
		loadNutritionScore()
			.then(setNutritionScore)
			.catch((e) => console.warn('Failed to load nutrition scores:', e));
		loadNutritionCat()
			.then(setNutritionCat)
			.catch((e) => console.warn('Failed to load nutrition categories:', e));
	} catch (err) {
		// Allow a retry after a failed initial load.
		pending = null;
		appState.error = (err as Error).message;
		appState.loading = false;
	}
}
