import { appState } from './appData.svelte';
import { leaderboardState, sidebarNavigateToSmartFocus, smartNutritionState } from './nav.svelte';
import { makeBenchmarkKey } from '../data';
import { modelsForSurface } from '../utils';

// ===== Smart Explore =====
// The "describe your use case" pipeline: sends free text to the Casper API,
// which maps it to benchmark metrics grouped into themes; we then rank models
// on those themes and populate the smart-focus sidebar + nutrition label.

export const smartExploreState = $state({
	open: false,
	loading: false,
	initialText: ''
});

const CASPER_API = 'https://casper-production-7f8e.up.railway.app';

const BENCHMARK_ICONS: Record<string, string> = {
	humanebench: 'fa-heart-pulse',
	'humanagency-bench': 'fa-graduation-cap',
	'spillunder-effect': 'fa-compass',
	'emotional-dependency': 'fa-heart',
	'modulated-cognitive-autonomy-benchmark-mcab': 'fa-brain',
	'cognitive-offloading-asymmetry-over-scaffolding-vs-autonomy-preservation-in-llm-responses':
		'fa-seedling'
};

function subareaNameToId(name: string): string {
	return name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[()]/g, '');
}

function getWorstSubareasForModel(modelId: string, count = 3): { name: string; score: number }[] {
	const key = makeBenchmarkKey(modelId, appState.filters.age);
	const scores = appState.benchmarkData[key];
	if (!scores || !appState.taxonomy) return [];

	const allMetrics: { id: string; name: string; score: number }[] = [];
	for (const area of appState.taxonomy.areas)
		for (const sub of area.subareas)
			for (const m of sub.metrics) {
				const s = scores[m.id] ?? null;
				if (s !== null) allMetrics.push({ id: m.id, name: m.name, score: s });
			}

	allMetrics.sort((a, b) => a.score - b.score);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	const seen = new Set<string>();
	const result: { name: string; score: number }[] = [];
	for (const m of allMetrics) {
		if (seen.has(m.id)) continue;
		seen.add(m.id);
		result.push({ name: m.name, score: m.score });
		if (result.length >= count) break;
	}
	return result;
}

function getConstructScoresForModel(modelId: string, themeMetricIds: string[][]): number[] {
	const key = makeBenchmarkKey(modelId, appState.filters.age);
	const scores = appState.benchmarkData[key];
	if (!scores) return themeMetricIds.map(() => 0);
	return themeMetricIds.map((ids) => {
		const vals = ids.map((id) => scores[id] ?? null).filter((v) => v !== null) as number[];
		return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
	});
}

export async function runSmartExplore(text: string) {
	smartExploreState.open = false; // close modal immediately
	smartExploreState.loading = true;
	try {
		const resp = await fetch(CASPER_API + '/query', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt: text, query: text, top_n: 15, per_benchmark_cap: 3 })
		});
		if (!resp.ok) throw new Error('Casper API error: ' + resp.status);
		const data = await resp.json();

		interface ParsedMetric {
			id: string;
			name: string;
			benchmark: string;
			icon: string;
			subareas: string[];
			score: number;
			summary: string;
		}
		interface ParsedConstruct {
			text: string;
			description: string;
			avg_score: number;
			metrics: ParsedMetric[];
			subareas: string[];
			primarySubarea: string;
			icon: string;
			id: string | null;
		}

		// Parse themes into constructs
		const constructs: ParsedConstruct[] = (data.themes ?? []).map(
			(theme: Record<string, unknown>) => {
				const metrics = ((theme.metrics as Record<string, unknown>[]) ?? []).map(
					(m: Record<string, unknown>) => {
						const subareaIds = ((m.subareas as string[]) ?? []).map(subareaNameToId);
						return {
							id: m.id as string,
							name: m.name as string,
							benchmark: m.benchmark as string,
							icon: BENCHMARK_ICONS[m.benchmark as string] ?? 'fa-bullseye',
							subareas: subareaIds.length ? subareaIds : ['autonomy-preservation'],
							score: (m.score as number) ?? 0,
							summary: (m.description as string) ?? ''
						};
					}
				);
				// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
				const allSubareas = [...new Set(metrics.flatMap((m): string[] => m.subareas))];
				return {
					text: theme.name as string,
					description: (theme.description as string) ?? '',
					avg_score: (theme.avg_score as number) ?? 0,
					metrics,
					subareas: allSubareas.length ? allSubareas : ['autonomy-preservation'],
					primarySubarea: allSubareas[0] ?? 'autonomy-preservation',
					icon: metrics[0]?.icon ?? 'fa-bullseye',
					id: metrics[0]?.id ?? null
				};
			}
		);

		// Single pass: compute construct scores for all models, rank, build nutrition opts
		const constructMetricIds = constructs.map((c) => c.metrics.map((m) => m.id));

		// All metric IDs flat (for sidebar/label score)
		const allFlatMetricIds = constructMetricIds.flat();

		const allModelScores = modelsForSurface(appState, 'full')
			.map((m) => {
				const constructScores = getConstructScoresForModel(m.id, constructMetricIds);
				const avg = constructScores.length
					? constructScores.reduce((a, b) => a + b, 0) / constructScores.length
					: 0;
				// Flat avg across all metric IDs (for sidebar header + nutrition label)
				const key = makeBenchmarkKey(m.id, appState.filters.age);
				const rawScores = appState.benchmarkData[key];
				const flatVals = allFlatMetricIds
					.map((id) => rawScores?.[id] ?? null)
					.filter((v): v is number => v !== null);
				const flatScore = flatVals.length
					? flatVals.reduce((a, b) => a + b, 0) / flatVals.length
					: 0;
				return { model: m, avg, constructScores, flatScore };
			})
			.sort((a, b) => b.avg - a.avg);

		leaderboardState.smartRanked = allModelScores.map(({ model, avg, flatScore }) => ({
			id: model.id,
			name: model.name,
			provider: model.provider,
			score: avg,
			flatScore
		}));

		const topModels = allModelScores
			.slice(0, 3)
			.map(({ model, avg, constructScores, flatScore }) => ({
				name: model.name,
				provider: model.provider,
				score: avg,
				flatScore,
				constructScores,
				worstAreas: getWorstSubareasForModel(model.id, 3)
			}));

		smartNutritionState.opts = {
			userText: text,
			constructs: constructs.map((c) => ({
				text: c.text,
				benchmark: c.metrics[0]?.benchmark ?? 'benchmark',
				score: c.avg_score,
				icon: c.icon,
				summary: c.description
			})),
			topModels
		};
		smartNutritionState.activeModelIdx = 0;

		// Navigate sidebar to smart focus view with all themes as cards
		const smartThemes = constructs.map((c) => ({
			name: c.text,
			description: c.description,
			icon: c.icon ?? 'fa-bullseye',
			avg_score: c.avg_score,
			metrics: c.metrics.map((m) => ({ id: m.id, name: m.name, score: m.score ?? 0 }))
		}));
		sidebarNavigateToSmartFocus(text, smartThemes);
	} catch (err) {
		console.error('Smart Explore error:', err);
	} finally {
		smartExploreState.loading = false;
	}
}
