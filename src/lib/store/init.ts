import {
	loadTaxonomy,
	loadModels,
	loadBenchmarkData,
	loadScenarioIndex,
	loadMetricDetails,
	loadNutrition
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

		// metric-details.json and nutrition.json each merge two of the files the
		// store used to fetch separately. The store still keeps them as separate
		// slices — /viewer builds the same slices client-side from an imported
		// run — so split each payload back out on arrival.
		loadMetricDetails()
			.then((details) => {
				setMetricCriteria(
					Object.fromEntries(Object.entries(details).map(([id, d]) => [id, d.definition]))
				);
				setMetricMeta(
					Object.fromEntries(
						Object.entries(details).map(([id, d]) => [
							id,
							{ contributor: d.contributor, mattersBecause: d.mattersBecause }
						])
					)
				);
			})
			.catch((e) => console.warn('Failed to load metric details:', e));

		loadNutrition()
			.then((cats) => {
				setNutritionScore(cats.map(({ id, label, models }) => ({ id, label, models })));
				setNutritionCat(
					cats.map(({ id, label, description, metrics }) => ({ id, label, description, metrics }))
				);
			})
			.catch((e) => console.warn('Failed to load nutrition data:', e));
	} catch (err) {
		// Allow a retry after a failed initial load.
		pending = null;
		appState.error = (err as Error).message;
		appState.loading = false;
	}
}
