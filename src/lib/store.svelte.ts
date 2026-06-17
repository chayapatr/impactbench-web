import type { Taxonomy, AIModel, BenchmarkData, FilterState, ScenarioIndex } from './types';
import type { NutritionCategory } from './data';
import { humanizeName } from './utils';

// ===== App State (Svelte 5 runes) =====

export const appState = $state({
	taxonomy: null as Taxonomy | null,
	models: [] as AIModel[],
	benchmarkData: {} as BenchmarkData,
	scenarioIndex: null as ScenarioIndex | null,
	metricCriteria: {} as Record<string, string>,
	nutritionScore: [] as NutritionCategory[],
	filters: { model: 'claude-haiku-4-5', age: 'adult' } as FilterState,
	loading: true,
	error: null as string | null,
	showGate: false // will be set from sessionStorage on mount
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

export function setFilters(filters: FilterState) {
	appState.filters = filters;
}

export function setScenarioIndex(idx: ScenarioIndex) {
	appState.scenarioIndex = idx;
}

export function setMetricCriteria(criteria: Record<string, string>) {
	appState.metricCriteria = criteria;
}

export function setNutritionScore(score: NutritionCategory[]) {
	appState.nutritionScore = score;
}

// ===== Tooltip State =====

export interface TooltipData {
	x: number;
	y: number;
	name: string;
	score: number;
	type: string;
	id: string;
	description?: string;
	children?: { id?: string; name?: string; score?: number; children?: { score?: number }[] }[];
	harmful?: boolean;
	behavior_type?: 'flourishing' | 'restrain_harm';
}

export const tooltipState = $state({
	visible: false,
	gateMode: false,
	data: null as TooltipData | null
});

// ===== Sidebar Nav State =====

export type ThemeMetricItem = { id: string; name: string; score: number };

export interface SmartTheme {
	name: string;
	description: string;
	icon: string;
	avg_score: number;
	metrics: ThemeMetricItem[];
}

export type NavLevel =
	| { type: 'overview' }
	| { type: 'area'; areaId: string }
	| { type: 'subarea'; subareaId: string }
	| { type: 'metric'; metricId: string; metricName: string }
	| { type: 'scenario'; metricId: string; scenarioMeta: import('./types').ScenarioMeta }
	| { type: 'smart-focus'; userText: string; themes: SmartTheme[] }
	| {
			type: 'theme-metrics';
			themeName: string;
			themeDesc: string;
			metrics: ThemeMetricItem[];
	  };

export const sidebarState = $state({
	navStack: [{ type: 'overview' }] as NavLevel[],
	behaviorSort: 'score-desc' as 'score-desc' | 'score-asc' | 'name-asc'
});

export function sidebarPush(level: NavLevel) {
	sidebarState.navStack = [...sidebarState.navStack, level];
}

export function sidebarBack() {
	if (sidebarState.navStack.length > 1) {
		sidebarState.navStack = sidebarState.navStack.slice(0, -1);
	}
}

export function sidebarNavigateToArea(areaId: string) {
	sidebarState.navStack = [{ type: 'overview' }, { type: 'area', areaId }];
}

export function sidebarNavigateToSubarea(subareaId: string, taxonomy: Taxonomy) {
	const area = taxonomy.areas.find((a) => a.subareas.some((s) => s.id === subareaId));
	const stack: NavLevel[] = [{ type: 'overview' }];
	if (area) stack.push({ type: 'area', areaId: area.id });
	stack.push({ type: 'subarea', subareaId });
	sidebarState.navStack = stack;
}

export function sidebarNavigateToMetric(metricId: string, taxonomy: Taxonomy) {
	for (const area of taxonomy.areas) {
		for (const sub of area.subareas) {
			const metric = sub.metrics.find((m) => m.id === metricId);
			if (metric) {
				sidebarState.navStack = [
					{ type: 'overview' },
					{ type: 'area', areaId: area.id },
					{ type: 'subarea', subareaId: sub.id },
					{ type: 'metric', metricId, metricName: metric.name }
				];
				return;
			}
		}
	}
}

export function sidebarNavigateToSmartFocus(userText: string, themes: SmartTheme[]) {
	const node = { type: 'smart-focus' as const, userText, themes };
	leaderboardState.smartFocusNode = node;
	sidebarState.navStack = [{ type: 'overview' }, node];
}

export function sidebarNavigateToThemeMetrics(
	themeName: string,
	themeDesc: string,
	metrics: ThemeMetricItem[]
) {
	sidebarState.navStack = [
		{ type: 'overview' },
		{ type: 'theme-metrics', themeName, themeDesc, metrics }
	];
}

// ===== Leaderboard State =====

export const leaderboardState = $state({
	selectedAreaId: null as string | null,
	selectedSubareaId: null as string | null,
	smartRanked: [] as { id: string; name: string; provider: string; score: number; flatScore: number }[],
	smartFocusNode: null as { type: 'smart-focus'; userText: string; themes: SmartTheme[] } | null
});

// ===== Smart Nutrition State =====

export const smartNutritionState = $state({
	open: false,
	opts: null as import('./types').SmartNutritionOpts | null,
	activeModelIdx: 0
});

// ===== Nutrition Label (deep-dive) State =====

export const nutritionLabelState = $state({
	open: false
});

// ===== Scenario side-panel (opens to the right of the main sidebar) =====

export const scenarioPanelState = $state({
	open: false,
	metricId: null as string | null,
	scenarioMeta: null as import('./types').ScenarioMeta | null
});

export function openScenarioPanel(
	metricId: string,
	scenarioMeta: import('./types').ScenarioMeta
) {
	scenarioPanelState.open = true;
	scenarioPanelState.metricId = metricId;
	scenarioPanelState.scenarioMeta = scenarioMeta;
}

export function closeScenarioPanel() {
	scenarioPanelState.open = false;
	scenarioPanelState.metricId = null;
	scenarioPanelState.scenarioMeta = null;
}
