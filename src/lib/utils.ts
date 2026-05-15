import type { appState as AppStateInstance } from '$lib/store.svelte';
import type { Area, Subarea, Metric, ScenarioMeta } from '$lib/types';
import { averageScore } from '$lib/scores';

type AppState = typeof AppStateInstance;

export function getScores(appState: AppState, modelId?: string, age?: string): Record<string, number> {
	const m = modelId ?? appState.filters.model;
	const a = age ?? appState.filters.age;
	return appState.benchmarkData[`${m}|${a}`] ?? {};
}

export function getModelName(appState: AppState, modelId?: string): string {
	const id = modelId ?? appState.filters.model;
	return appState.models.find((m) => m.id === id)?.name ?? id;
}

export function getModelProvider(appState: AppState, modelId?: string): string {
	const id = modelId ?? appState.filters.model;
	return appState.models.find((m) => m.id === id)?.provider ?? '';
}

export function computeAreaScore(appState: AppState, areaId: string, modelId?: string, age?: string): number {
	const area = appState.taxonomy?.areas.find((a) => a.id === areaId);
	if (!area) return 0;
	const scores = getScores(appState, modelId, age);
	const vals = area.subareas.flatMap((sub) => sub.metrics.map((m) => scores[m.id]).filter((s): s is number => s !== undefined));
	return averageScore(vals);
}

export function computeSubareaScore(appState: AppState, subareaId: string, modelId?: string, age?: string): number {
	const scores = getScores(appState, modelId, age);
	for (const area of appState.taxonomy?.areas ?? []) {
		const sub = area.subareas.find((s) => s.id === subareaId);
		if (sub) return averageScore(sub.metrics.map((m) => scores[m.id]).filter((s): s is number => s !== undefined));
	}
	return 0;
}

export function filterScenariosByAge(appState: AppState, metricId: string): ScenarioMeta[] {
	return (appState.scenarioIndex?.[metricId] ?? []).filter(
		(sc) => sc.age === appState.filters.age
	);
}

export function findMetricInTaxonomy(
	appState: AppState,
	metricId: string
): { area: Area; subarea: Subarea; metric: Metric } | null {
	for (const area of appState.taxonomy?.areas ?? [])
		for (const subarea of area.subareas)
			for (const metric of subarea.metrics)
				if (metric.id === metricId) return { area, subarea, metric };
	return null;
}
