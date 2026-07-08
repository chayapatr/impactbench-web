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

let started = false;

export async function initAppData() {
	if (started) return;
	started = true;

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
		appState.error = (err as Error).message;
		appState.loading = false;
	}
}
