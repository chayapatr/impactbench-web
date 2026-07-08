import type {
	Taxonomy,
	AIModel,
	BenchmarkData,
	FilterState,
	SunburstNodeData,
	ScenarioIndex,
	ScenarioDetail
} from './types';
import { averageScore, scoreToArcValue } from './scores';

export async function loadTaxonomy(): Promise<Taxonomy> {
	const res = await fetch('/data/taxonomy.json');
	if (!res.ok) throw new Error(`Failed to load taxonomy: ${res.status}`);
	return res.json();
}

export async function loadModels(): Promise<AIModel[]> {
	const res = await fetch('/data/models.json');
	if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
	const data = await res.json();
	return data.models;
}

export async function loadBenchmarkData(): Promise<BenchmarkData> {
	const res = await fetch('/data/benchmark-data.json');
	if (!res.ok) throw new Error(`Failed to load benchmark data: ${res.status}`);
	return res.json();
}

export async function loadScenarioIndex(): Promise<ScenarioIndex> {
	const res = await fetch('/data/scenario-index.json');
	if (!res.ok) throw new Error(`Failed to load scenario index: ${res.status}`);
	return res.json();
}

export async function loadMetricCriteria(): Promise<Record<string, string>> {
	const res = await fetch('/data/metric-criteria.json');
	if (!res.ok) return {};
	return res.json();
}

export async function loadMetricMeta(): Promise<Record<string, import('./types').MetricMeta>> {
	const res = await fetch('/data/metric-meta.json');
	if (!res.ok) return {};
	return res.json();
}

export interface NutritionCategory {
	id: string;
	label: string;
	models: Record<string, { adult: number; child: number }>;
}

export async function loadNutritionScore(): Promise<NutritionCategory[]> {
	const res = await fetch('/data/nutrition-score.json');
	if (!res.ok) throw new Error(`Failed to load nutrition score: ${res.status}`);
	return res.json();
}

export interface NutritionMetric {
	id: string;
	name: string;
	type: 'positive' | 'negative';
}

export interface NutritionCategoryDetail {
	id: string;
	label: string;
	description?: string;
	metrics: NutritionMetric[];
}

export async function loadNutritionCat(): Promise<NutritionCategoryDetail[]> {
	const res = await fetch('/data/nutrition-cat.json');
	if (!res.ok) throw new Error(`Failed to load nutrition cat: ${res.status}`);
	return res.json();
}

export async function loadScenarioDetail(
	benchmark: string,
	modelId: string,
	scenarioId: string
): Promise<ScenarioDetail> {
	const base = 'https://impactbench.from.pub/scenarios';
	const res = await fetch(`${base}/${benchmark}/${modelId}/${scenarioId}.json`);
	if (!res.ok) throw new Error(`Failed to load scenario: ${res.status}`);
	return res.json();
}

export function makeBenchmarkKey(modelId: string, age: string): string {
	return `${modelId}|${age}`;
}

export function getScoresForFilter(
	benchmarkData: BenchmarkData,
	filters: FilterState
): Record<string, number> {
	const key = makeBenchmarkKey(filters.model, filters.age);
	return benchmarkData[key] ?? {};
}

export function buildHierarchy(
	taxonomy: Taxonomy,
	scores: Record<string, number>
): SunburstNodeData {
	const root: SunburstNodeData = {
		id: 'root',
		name: 'AI Impact',
		depth: 0,
		type: 'root',
		children: []
	};

	for (const area of taxonomy.areas) {
		const areaNode: SunburstNodeData = {
			id: area.id,
			name: area.name,
			icon: area.icon,
			depth: 1,
			type: 'area',
			areaId: area.id,
			color: area.color,
			children: []
		};

		const areaScores: number[] = [];

		for (const subarea of area.subareas) {
			const subareaNode: SunburstNodeData = {
				id: subarea.id,
				name: subarea.name,
				icon: subarea.icon,
				depth: 2,
				type: 'subarea',
				areaId: area.id,
				subareaId: subarea.id,
				color: area.color,
				children: []
			};

			const subareaScores: number[] = [];

			for (const metric of subarea.metrics) {
				const score = scores[metric.id] ?? 0;
				subareaScores.push(score);

				const metricNode: SunburstNodeData = {
					id: metric.id,
					name: metric.name,
					depth: 3,
					type: 'metric',
					areaId: area.id,
					subareaId: subarea.id,
					color: area.color,
					metricType: metric.type,
					score,
					value: scoreToArcValue(score)
				};

				subareaNode.children!.push(metricNode);
			}

			const subareaAvg = averageScore(subareaScores);
			subareaNode.score = subareaAvg;
			subareaNode.value = scoreToArcValue(subareaAvg);
			areaScores.push(...subareaScores);

			areaNode.children!.push(subareaNode);
		}

		const areaAvg = averageScore(areaScores);
		areaNode.score = areaAvg;
		areaNode.value = scoreToArcValue(areaAvg);

		root.children!.push(areaNode);
	}

	root.score = averageScore(root.children!.map((c) => c.score ?? 0));
	return root;
}
