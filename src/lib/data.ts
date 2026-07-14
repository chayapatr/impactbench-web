import type {
	Taxonomy,
	AIModel,
	BenchmarkData,
	FilterState,
	SunburstNodeData,
	ScenarioIndex,
	ScenarioDetail
} from './types';
import { env } from '$env/dynamic/public';
import { averageScore, scoreToArcValue } from './scores';

// All published data lives in R2 (bucket `impactbench-scenarios`, fronted by
// this domain) and is rebuilt by the impactbench-data publish workflow. Nothing
// is bundled into the site build, so a data update needs no site deploy.
//
// Set PUBLIC_DATA_BASE to point at a local server (e.g. http://localhost:8080)
// to test against locally-built data before publishing to R2.
const DATA_BASE = env.PUBLIC_DATA_BASE || 'https://impactbench.from.pub';

async function fetchData<T>(file: string): Promise<T> {
	const res = await fetch(`${DATA_BASE}/data/${file}`);
	if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
	return res.json();
}

export async function loadTaxonomy(): Promise<Taxonomy> {
	return fetchData<Taxonomy>('taxonomy.json');
}

export async function loadModels(): Promise<AIModel[]> {
	const data = await fetchData<{ models: AIModel[] }>('models.json');
	return data.models;
}

export async function loadBenchmarkData(): Promise<BenchmarkData> {
	return fetchData<BenchmarkData>('benchmark-data.json');
}

export async function loadScenarioIndex(): Promise<ScenarioIndex> {
	return fetchData<ScenarioIndex>('scenario-index.json');
}

// metric-details.json merges what used to be metric-criteria.json (definition)
// and metric-meta.json (contributor + mattersBecause), keyed the same way.
export interface MetricDetail {
	definition: string;
	contributor: string;
	mattersBecause: string;
}

export async function loadMetricDetails(): Promise<Record<string, MetricDetail>> {
	return fetchData<Record<string, MetricDetail>>('metric-details.json');
}

export interface NutritionMetric {
	id: string;
	name: string;
	type: 'positive' | 'negative';
	metric_id?: string;
	benchmark?: string;
	// The id this metric has inside the `nutritional-label` benchmark, when it is
	// one of the metrics that benchmark curated. /viewer needs it to map an
	// imported run (keyed m01..m83) onto the source metric. See metric-map.ts.
	label_metric_id?: string;
}

// nutrition.json merges what used to be nutrition-score.json (per-category
// per-model/per-age scores) and nutrition-cat.json (the metric breakdown).
export interface NutritionCategoryData {
	id: string;
	label: string;
	description?: string;
	models: Record<string, { adult: number; child: number }>;
	metrics: NutritionMetric[];
}

export async function loadNutrition(): Promise<NutritionCategoryData[]> {
	return fetchData<NutritionCategoryData[]>('nutrition.json');
}

// Kept as separate types because the store still holds these as two slices
// (and /viewer builds them client-side from an imported run).
export interface NutritionCategory {
	id: string;
	label: string;
	models: Record<string, { adult: number; child: number }>;
}

export interface NutritionCategoryDetail {
	id: string;
	label: string;
	description?: string;
	metrics: NutritionMetric[];
}

export async function loadScenarioDetail(
	benchmark: string,
	modelId: string,
	scenarioId: string
): Promise<ScenarioDetail> {
	const res = await fetch(`${DATA_BASE}/scenarios/${benchmark}/${modelId}/${scenarioId}.json`);
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
