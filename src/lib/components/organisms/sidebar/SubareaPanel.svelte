<script lang="ts">
	import {
		appState,
		sidebarBack,
		openMetricPanel,
		openScenarioPanel,
		closeScenarioPanel,
		scenarioPanelState
	} from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import {
		getScores,
		computeSubareaScore,
		subareaPassFraction,
		filterScenariosByAge
	} from '$lib/utils';

	interface Props {
		subareaId: string;
	}

	let { subareaId }: Props = $props();

	const subareaTuple = $derived.by(() => {
		if (!appState.taxonomy) return null;
		for (const area of appState.taxonomy.areas) {
			const sub = area.subareas.find((s) => s.id === subareaId);
			if (sub) return { sub, area };
		}
		return null;
	});

	const scores = $derived(getScores(appState));
	const subareaScore = $derived(computeSubareaScore(appState, subareaId));
	const subColors = $derived(scoreColors(subareaScore));
	const subareaFrac = $derived(subareaPassFraction(appState, subareaId));

	function stepLabel(ratio: number): string {
		if (ratio >= 0.75) return 'Adequate';
		if (ratio >= 0.55) return 'Partial';
		if (ratio >= 0.35) return 'Lacking';
		return 'Failing';
	}
	function stepStyle(ratio: number): string {
		if (ratio >= 0.75) return 'background:#dcfce7;color:#16a34a';
		if (ratio >= 0.55) return 'background:#fef9c3;color:#ca8a04';
		if (ratio >= 0.35) return 'background:#ffedd5;color:#ea580c';
		return 'background:#fee2e2;color:#dc2626';
	}
</script>

{#if subareaTuple}
	{@const { sub, area } = subareaTuple}
	{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
	{@const metrics = sub.metrics.map((m) => ({ ...m, score: scores[m.id] ?? 0 }))}
	{@const sorted = metrics}
	{@const metricById = Object.fromEntries(metrics.map((m) => [m.id, m]))}
	{@const hasGroups = sub.groups && sub.groups.length > 0}

	<!-- Description -->
	<div class="px-[14px] pt-[14px] pb-[12px]">
		{#if subDesc}
			<div class="mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
				Subarea Description
			</div>
			<p class="text-[12px] leading-[1.6] text-balance text-[#374151]">{subDesc}</p>
		{/if}
	</div>

	{#snippet metricCard(m: (typeof metrics)[0])}
		{@const isActive = scenarioPanelState.metricId === m.id}
		{@const hasSelection = scenarioPanelState.metricId !== null}
		{@const isFaded = hasSelection && !isActive}
		{@const mScenarios = filterScenariosByAge(appState, m.id)}
		{@const isHarmful = m.type === 'negative'}
		<div
			class="border-b border-[#f3f4f6] transition-[background,opacity,box-shadow] duration-150"
			style="background: {isActive ? '#f9fafb' : 'white'};{isActive ? ' box-shadow: inset 0 1px 0 #e5e7eb, inset 0 -1px 0 #e5e7eb;' : ''}{isFaded ? ' opacity: 0.55;' : ''}"
		>
			<button
				class="flex w-full cursor-pointer items-center gap-[8px] px-[14px] py-[10px] text-left"
				onclick={() => openMetricPanel(m.id)}
			>
				<!-- type badge with tooltip -->
				<div class="group relative flex-shrink-0">
					<span
						class="inline-flex h-[20px] w-[20px] items-center justify-center rounded-full"
						style={m.type === 'negative' ? 'background:#f3f4f6;color:#c4b5fd' : 'background:#f3f4f6;color:#93c5fd'}
					>
						<i class="fa-solid {m.type === 'negative' ? 'fa-shield' : 'fa-star'}" style="font-size:8px"></i>
					</span>
					<div
						class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[200px] -translate-x-1/2 rounded-[8px] bg-[#1a1a1a] px-[10px] py-[8px] text-[11px] leading-[1.45] text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
					>
						<div class="mb-[3px] font-semibold">
							{m.type === 'negative' ? 'Avoiding bad behavior' : 'Promoting good behavior'}
						</div>
						<div class="text-[#d1d5db]">
							{m.type === 'negative'
								? 'This metric is about how much this model avoids exhibiting bad behavior.'
								: 'This metric is about how much this model promotes good behavior.'}
						</div>
					</div>
				</div>
				<span class="min-w-0 flex-1 text-[12px] leading-[1.35] {isActive ? 'font-semibold text-[#1a1a1a]' : 'font-medium text-[#374151]'}">{m.name}</span>
				<span
					class="flex-shrink-0 rounded-full px-[8px] py-[2px] text-[10px] font-semibold"
					style={stepStyle(m.score)}
				>{stepLabel(m.score)}</span>
			</button>
			{#if isActive && mScenarios.length > 0}
				<div class="pb-[6px]">
					{#each mScenarios as sc (sc.scenario_id)}
						{@const rawResult = sc.verdicts?.[appState.filters.model]}
						{@const pass = rawResult === undefined ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
						{@const isScActive = scenarioPanelState.scenarioMeta?.scenario_id === sc.scenario_id}
						<button
							class="flex w-full items-center gap-[8px] border-l-[4px] py-[6px] pr-[14px] pl-[38px] text-left transition-colors duration-150 {isScActive ? 'border-l-[#0e7490] bg-[#eef2f2]' : 'border-l-transparent hover:bg-[#f3f4f6]'}"
							onclick={() => openScenarioPanel(m.id, sc)}
						>
							<span class="min-w-0 flex-1 overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-[#374151]">{sc.title}</span>
							<span
								class="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-[800]"
								style={pass === null ? 'background:#f3f4f6;color:#9ca3af' : pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
							>
								{#if pass === null}
									<i class="fa-solid fa-minus"></i>
								{:else if pass}
									<i class="fa-solid fa-check"></i>
								{:else}
									<i class="fa-solid fa-xmark"></i>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}

	{#if hasGroups}
		<div class="flex flex-col border-t border-[#f3f4f6] pb-4">
			{#each sub.groups as group (group.name)}
				{@const groupMetrics = group.metric_ids.map((id) => metricById[id]).filter(Boolean)}
				{#if groupMetrics.length > 0}
					<div>
						<div
							class="bg-white px-[14px] pt-[14px] pb-[6px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
						>
							{group.name}
						</div>
						{#each groupMetrics as m (m.id)}
							{@render metricCard(m)}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="flex flex-col border-t border-[#f3f4f6] pb-4">
			{#each metrics as m (m.id)}
				{@render metricCard(m)}
			{/each}
		</div>
	{/if}
{/if}
