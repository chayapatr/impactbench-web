import type { Taxonomy } from '../types';

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
	| { type: 'smart-focus'; userText: string; themes: SmartTheme[] }
	| { type: 'theme-metrics'; themeName: string; themeDesc: string; metrics: ThemeMetricItem[] };

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

export function sidebarNavigateTo(...levels: NavLevel[]) {
	sidebarState.navStack = [{ type: 'overview' }, ...levels];
}

export function sidebarNavigateToMetric(metricId: string, taxonomy: Taxonomy) {
	for (const area of taxonomy.areas) {
		for (const sub of area.subareas) {
			const metric = sub.metrics.find((m) => m.id === metricId);
			if (metric) {
				sidebarNavigateTo(
					{ type: 'area', areaId: area.id },
					{ type: 'subarea', subareaId: sub.id },
					{ type: 'metric', metricId, metricName: metric.name }
				);
				return;
			}
		}
	}
}

// ===== Leaderboard State =====

export const leaderboardState = $state({
	selectedAreaId: null as string | null,
	selectedSubareaId: null as string | null,
	smartRanked: [] as {
		id: string;
		name: string;
		provider: string;
		score: number;
		flatScore: number;
	}[],
	smartFocusNode: null as { type: 'smart-focus'; userText: string; themes: SmartTheme[] } | null
});

// sidebarNavigateToSmartFocus writes to leaderboardState.smartFocusNode as a
// side effect — these two states are already coupled in practice (a
// "smart focus" is simultaneously a sidebar nav level and a leaderboard
// ranking context), which is why both live in this one file instead of two.
export function sidebarNavigateToSmartFocus(userText: string, themes: SmartTheme[]) {
	const node = { type: 'smart-focus' as const, userText, themes };
	leaderboardState.smartFocusNode = node;
	sidebarNavigateTo(node);
}

// ===== Smart Nutrition State =====

export const smartNutritionState = $state({
	open: false,
	opts: null as import('../types').SmartNutritionOpts | null,
	activeModelIdx: 0
});
