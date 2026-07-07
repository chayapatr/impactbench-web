<script lang="ts">
	import { appState, sidebarBack, openScenarioPanel, scenarioPanelState } from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { getModelName, getScores, filterScenariosByAge, findMetricInTaxonomy, metricPassFraction } from '$lib/utils';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';

	interface Props {
		metricId: string;
		metricName: string;
		backLabel: string;
	}

	let { metricId, metricName, backLabel }: Props = $props();

	const score = $derived(getScores(appState)[metricId] ?? 0);
	const metricColors = $derived(scoreColors(score));
	const _metric = $derived(findMetricInTaxonomy(appState, metricId)?.metric);
	const isHarmful = $derived(_metric?.type === 'negative');
	const scenarios = $derived(filterScenariosByAge(appState, metricId));
	const metricFrac = $derived(metricPassFraction(appState, metricId));
</script>

<StickyHeader {backLabel} onBack={sidebarBack}>
	{#snippet right()}
		<span class="truncate text-[11px] font-semibold text-[#9ca3af]">{getModelName(appState)}</span>
	{/snippet}
	{#snippet banner()}
		<ColoredBanner color={metricColors.color} background={metricColors.light} border={metricColors.border} title={metricName} score={score} total={metricFrac.total}>
			{#snippet children()}
				<div class="mb-[4px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">{backLabel} ›</div>
				<div class="flex items-start justify-between gap-2">
					<span class="flex-1 text-[15px] leading-[1.2] font-[700] tracking-[-0.01em] text-[#1a1a1a]">{metricName}</span>
					<ScorePill score={score} total={metricFrac.total} />
				</div>
			{/snippet}
		</ColoredBanner>
	{/snippet}
</StickyHeader>

<div class="px-6 py-4">
	{#if appState.metricCriteria?.[metricId]}
		<div class="mb-4 border-l-[2px] border-[#e5e7eb] pl-[8px] text-[11px] leading-[1.5] whitespace-pre-line text-[#6b7280]">
			{appState.metricCriteria[metricId]}
		</div>
	{/if}
	{#if scenarios.length === 0}
		<p class="text-[13px] leading-[1.6] text-[#6b7280]">No scenarios available for this metric.</p>
	{:else}
		<div class="mb-3 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">Scenarios</div>
		<div class="flex flex-col">
			{#each scenarios as sc (sc.scenario_id)}
				{@const rawResult = sc.verdicts?.[appState.filters.model]}
				{@const pass = rawResult === undefined ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
				{@const isActive = scenarioPanelState.open && scenarioPanelState.scenarioMeta?.scenario_id === sc.scenario_id}
				<button
					class="flex w-full items-center gap-[8px] border-l-[3px] px-[14px] py-[7px] text-left transition-colors duration-150 hover:border-l-[#00b3b0] hover:bg-[#f3f4f6] {isActive ? 'border-l-[#00b3b0] bg-[#f0fafa]' : 'border-l-transparent'}"
					onclick={() => openScenarioPanel(metricId, sc)}
				>
					{#if pass !== null}
						<span
							class="inline-flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-[800]"
							style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}>{pass ? '✓' : '✗'}</span>
					{:else}
						<span class="h-[16px] w-[16px] flex-shrink-0 rounded-full bg-[#f3f4f6]"></span>
					{/if}
					<span class="min-w-0 flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[#374151]">{sc.title}</span>
					<i class="fa-solid fa-chevron-right flex-shrink-0 text-[9px] text-[#9ca3af]"></i>
				</button>
			{/each}
		</div>
	{/if}
</div>
