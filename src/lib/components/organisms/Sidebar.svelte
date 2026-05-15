<script lang="ts">
	import {
		appState,
		sidebarState,
		leaderboardState
	} from '$lib/store.svelte';
	import { scoreToClass } from '$lib/scores';
	import { getScores, getModelName, getModelProvider, computeAreaScore, computeSubareaScore } from '$lib/utils';
	import ScorePill from '../atoms/ScorePill.svelte';
	import OverviewPanel from './sidebar/OverviewPanel.svelte';
	import AreaPanel from './sidebar/AreaPanel.svelte';
	import SubareaPanel from './sidebar/SubareaPanel.svelte';
	import MetricPanel from './sidebar/MetricPanel.svelte';
	import ScenarioPanel from './sidebar/ScenarioPanel.svelte';
	import SmartFocusPanel from './sidebar/SmartFocusPanel.svelte';
	import ThemeMetricsPanel from './sidebar/ThemeMetricsPanel.svelte';

	const top = $derived(sidebarState.navStack[sidebarState.navStack.length - 1]);
	const isFocused = $derived(top.type !== 'overview' && top.type !== 'smart-focus');

	const overallScore = $derived(() => {
		// In smart mode, show flat avg of all smart-focus metrics for the selected model
		if (leaderboardState.smartRanked.length > 0) {
			const entry = leaderboardState.smartRanked.find((e) => e.id === appState.filters.model);
			if (entry) return entry.flatScore;
		}
		const vals = Object.values(getScores(appState));
		return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
	});

	function getAncestorName(): string {
		const stack = sidebarState.navStack;
		if (stack.length < 2) return 'Back';
		const prev = stack[stack.length - 2];
		if (prev.type === 'area' && appState.taxonomy) {
			return appState.taxonomy.areas.find((a) => a.id === prev.areaId)?.name ?? 'Back';
		}
		if (prev.type === 'subarea' && appState.taxonomy) {
			for (const area of appState.taxonomy.areas) {
				const sub = area.subareas.find((s) => s.id === prev.subareaId);
				if (sub) return sub.name;
			}
		}
		if (prev.type === 'metric') return prev.metricName;
		return 'Back';
	}

	function goToSmartFocus() {
		const node = leaderboardState.smartFocusNode;
		if (node) sidebarState.navStack = [{ type: 'overview' }, node];
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-[#fafaf9]">
	<!-- Smart focus banner -->
	{#if leaderboardState.smartRanked.length > 0}
		{@const isOnSmartFocus = top.type === 'smart-focus'}
		<div class="flex-shrink-0 px-[10px] py-[8px]">
			<button
				class="flex w-full items-center gap-[8px] rounded-[8px] bg-[#e0f7f7] px-[12px] py-[8px] text-left transition-colors duration-150
					{isOnSmartFocus ? 'opacity-50 cursor-default' : 'hover:bg-[#ccf2f1] cursor-pointer'}"
				disabled={isOnSmartFocus}
				onclick={goToSmartFocus}
			>
				<i class="fa-solid fa-wand-magic-sparkles text-[11px] flex-shrink-0 text-[#00b3b0]"></i>
				<div class="min-w-0 flex-1">
					<div class="text-[10px] font-[700] uppercase tracking-[0.06em] text-[#00b3b0] leading-none mb-[2px]">Smart Focus</div>
					<div class="text-[11px] font-semibold text-[#0e7490] truncate leading-none">Go to Your Focus Areas</div>
				</div>
				{#if !isOnSmartFocus}
					<i class="fa-solid fa-arrow-up text-[9px] text-[#00b3b0] flex-shrink-0"></i>
				{/if}
			</button>
		</div>
	{/if}

	<!-- Model header (hidden in drill-down mode) -->
	<div class="flex-shrink-0 border-b border-[#f3f4f6] {isFocused ? 'hidden' : ''}" id="sb-header">
		<div class="px-[14px] pt-[20px] pb-[14px]">
			<div class="flex items-center gap-3">
				<div class="min-w-0 flex-1">
					<div class="mb-[3px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
						{getModelProvider(appState)}
					</div>
					<div class="truncate text-[16px] leading-[1.2] font-[800] tracking-[-0.02em] text-[#1a1a1a]">
						{getModelName(appState)}
					</div>
				</div>
				<ScorePill score={overallScore()} />
			</div>
		</div>
	</div>

	<!-- Panel router -->
	<div class="flex-1 overflow-y-auto text-[14px]" id="summary-panel">
		{#if top.type === 'overview'}
			<OverviewPanel />
		{:else if top.type === 'area' && appState.taxonomy}
			<AreaPanel areaId={top.areaId} />
		{:else if top.type === 'subarea' && appState.taxonomy}
			<SubareaPanel subareaId={top.subareaId} />
		{:else if top.type === 'metric'}
			<MetricPanel metricId={top.metricId} metricName={top.metricName} backLabel={getAncestorName()} />
		{:else if top.type === 'scenario'}
			<ScenarioPanel metricId={top.metricId} scenarioMeta={top.scenarioMeta} backLabel={getAncestorName()} />
		{:else if top.type === 'smart-focus'}
			<SmartFocusPanel themes={top.themes} userText={top.userText} />
		{:else if top.type === 'theme-metrics'}
			<ThemeMetricsPanel themeName={top.themeName} themeDesc={top.themeDesc} metrics={top.metrics} />
		{/if}
	</div>

	<!-- Site footer -->
	<div class="flex flex-shrink-0 flex-col gap-1.5 border-t border-[#f3f4f6] px-4 py-3">
		<p class="text-[11px] leading-[1.5] text-[#9ca3af]">
			MIT Media Lab · 77 Mass. Ave., E14/E15, Cambridge, MA 02139-4307 USA ⋅ <a
				href="https://accessibility.mit.edu/"
				target="_blank"
				rel="noopener"
				class="text-[#9ca3af] underline underline-offset-2 hover:text-[#6b7280]"
				>Accessibility [↗]</a
			>
		</p>
	</div>
</div>

<style>
	:global(.filter-select-style) {
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		background-size: 12px;
	}
	:global(.filter-select-style:hover) {
		border-color: #9ca3af;
	}
	:global(.filter-select-style:focus) {
		border-color: #00b3b0;
		box-shadow: 0 0 0 3px rgba(0, 179, 176, 0.12);
	}
</style>
