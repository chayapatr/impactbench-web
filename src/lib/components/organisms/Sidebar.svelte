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

	interface Props {
		onOpenNutritionLabel?: () => void;
		onEditFocus?: () => void;
		onClearFocus?: () => void;
	}

	let { onOpenNutritionLabel, onEditFocus, onClearFocus }: Props = $props();

	const top = $derived(sidebarState.navStack[sidebarState.navStack.length - 1]);
	const isFocused = $derived(top.type !== 'overview' && top.type !== 'smart-focus');

	let copyLinkState = $state<'idle' | 'copied'>('idle');

	const deepLinkTarget = $derived(() => {
		if (top.type === 'metric') return { metricId: top.metricId, scenarioId: null };
		if (top.type === 'scenario') return { metricId: top.metricId, scenarioId: top.scenarioMeta.scenario_id };
		return null;
	});

	function copyDeepLink() {
		const link = deepLinkTarget();
		if (!link) return;
		const url = new URL(window.location.href);
		url.search = '';
		url.searchParams.set('metric', link.metricId);
		if (link.scenarioId) url.searchParams.set('scenario', link.scenarioId);
		navigator.clipboard.writeText(url.toString()).then(() => {
			copyLinkState = 'copied';
			setTimeout(() => { copyLinkState = 'idle'; }, 2000);
		});
	}

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
</script>

<div class="flex h-full flex-col overflow-hidden bg-[#fafaf9]">
	<!-- Smart focus card -->
	{#if leaderboardState.smartFocusNode}
		{@const focusNode = leaderboardState.smartFocusNode}
		{@const isOnSmartFocus = top.type === 'smart-focus'}
		<div class="flex-shrink-0 px-[10px] pt-[10px] pb-[6px]">
			<div class="rounded-[12px] border border-[#b8e8e7] bg-[#e0f7f7] p-[14px] shadow-[0_1px_2px_rgba(0,179,176,0.08)]">
				<div class="flex items-start justify-between gap-2">
					<div class="flex items-center gap-[6px] text-[10px] font-[700] uppercase tracking-[0.06em] text-[#00b3b0]">
						<i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
						Focus Area
					</div>
					{#if onClearFocus}
						<button
							class="flex h-[20px] w-[20px] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[#0e7490] transition-colors duration-150 hover:bg-[#ccf2f1] hover:text-[#dc2626]"
							aria-label="Clear focus"
							title="Clear focus"
							onclick={onClearFocus}
						>
							<i class="fa-solid fa-xmark text-[11px]"></i>
						</button>
					{/if}
				</div>
				<p class="mt-[8px] text-[13px] leading-[1.45] text-[#1a1a1a] italic">
					"{focusNode.userText}"
				</p>
				<div class="mt-[12px] flex flex-col gap-[6px]">
					<button
						class="inline-flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[8px] border-none px-3 py-[8px] text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(3,141,143,0.25)] transition-[transform,box-shadow,filter] duration-150 hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[0_3px_10px_rgba(3,141,143,0.35)] active:translate-y-0"
						style="background:linear-gradient(135deg,#00b3b0,#038d8f)"
						onclick={onOpenNutritionLabel}
					>
						<i class="fa-solid fa-flask text-[12px]"></i>
						Download Nutrition Label
					</button>
					<button
						class="inline-flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[8px] border-[1.5px] border-[#b8e8e7] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#0e7490] transition-[background,border-color] duration-150 hover:border-[#00b3b0] hover:bg-[#f0fafa]"
						onclick={onEditFocus}
					>
						<i class="fa-solid fa-pen text-[11px]"></i>
						Edit Focus Area
					</button>
				</div>
				{#if !isOnSmartFocus}
					<button
						class="mt-[8px] inline-flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[6px] border-none bg-transparent px-2 py-[5px] text-[11px] font-semibold text-[#0e7490] transition-colors duration-150 hover:bg-[#ccf2f1]"
						onclick={() => { if (focusNode) sidebarState.navStack = [{ type: 'overview' }, focusNode]; }}
					>
						<i class="fa-solid fa-arrow-up text-[9px]"></i>
						Go to Your Focus Areas
					</button>
				{/if}
			</div>
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

	<!-- Deep link copy bar (shown when viewing a metric or scenario) -->
	{#if deepLinkTarget()}
		<div class="flex-shrink-0 border-b border-[#f3f4f6] px-[14px] py-[8px]">
			<button
				class="inline-flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] font-medium text-[#6b7280] transition-[background,color,border-color] duration-150 hover:border-[#d1d5db] hover:bg-[#f9fafb] hover:text-[#1a1a1a]"
				onclick={copyDeepLink}
			>
				<i class="fa-solid {copyLinkState === 'copied' ? 'fa-check text-[#16a34a]' : 'fa-link'} text-[11px]"></i>
				{copyLinkState === 'copied' ? 'Link copied!' : 'Copy link to this view'}
			</button>
		</div>
	{/if}

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
