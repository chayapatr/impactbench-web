<script lang="ts">
	import {
		appState,
		sidebarBack,
		openMetricPanel,
		scenarioPanelState
	} from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import {
		getModelName,
		getScores,
		computeSubareaScore,
		subareaPassFraction
	} from '$lib/utils';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';
	import ModelAgeChip from '$lib/components/molecules/ModelAgeChip.svelte';

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
	function stepBorderColor(ratio: number): string {
		if (ratio >= 0.75) return '#16a34a';
		if (ratio >= 0.55) return '#ca8a04';
		if (ratio >= 0.35) return '#ea580c';
		return '#dc2626';
	}
</script>

{#if subareaTuple}
	{@const { sub, area } = subareaTuple}
	{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
	{@const metrics = sub.metrics.map((m) => ({ ...m, score: scores[m.id] ?? 0 }))}
	{@const sorted = metrics}
	{@const metricById = Object.fromEntries(metrics.map((m) => [m.id, m]))}
	{@const hasGroups = sub.groups && sub.groups.length > 0}

	<!-- Back bar -->
	<StickyHeader backLabel={area.name} onBack={sidebarBack}>
		{#snippet right()}
			<ModelAgeChip modelName={getModelName(appState)} age={appState.filters.age} />
		{/snippet}
	</StickyHeader>

	<!-- Merged breadcrumb + title + description (no left bar, no score chip) -->
	<div class="border-b border-[#e5e7eb] bg-[#f9fafb] px-[14px] pt-[10px] pb-[12px]">
		<div class="mb-[3px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
			{area.name} ›
		</div>
		<div class="flex items-center gap-2">
			{#if sub.icon}
				<i class="fa-solid {sub.icon} flex-shrink-0 text-[15px]"></i>
			{/if}
			<span class="min-w-0 flex-1 text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]">{sub.name}</span>
		</div>
		{#if subDesc}
			<p class="mt-[6px] text-[12px] leading-[1.6] text-balance text-[#6b7280]">{subDesc}</p>
		{/if}
	</div>

	{#snippet metricCard(m: (typeof metrics)[0])}
		{@const isActive = scenarioPanelState.open && scenarioPanelState.metricId === m.id}
		<button
			class="mx-[10px] mb-[6px] flex w-[calc(100%-20px)] cursor-pointer items-center gap-[10px] rounded-[10px] border px-[12px] py-[10px] text-left transition-all duration-150
				hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
			style={isActive
				? `border: 1px solid ${stepBorderColor(m.score)}; background: ${m.score >= 0.75 ? '#f0fafa' : m.score >= 0.55 ? '#fefce8' : m.score >= 0.35 ? '#fff7ed' : '#fef2f2'}`
				: 'border-color: #e5e7eb; background: white'}
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
				<!-- tooltip -->
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
			<span class="min-w-0 flex-1 text-[12px] leading-[1.35] font-medium text-[#374151]">{m.name}</span>
			<span
				class="flex-shrink-0 rounded-full px-[8px] py-[2px] text-[10px] font-semibold"
				style={stepStyle(m.score)}
			>{stepLabel(m.score)}</span>
		</button>
	{/snippet}

	{#if hasGroups}
		<div class="mt-2 flex flex-col pb-4">
			{#each sub.groups as group (group.name)}
				{@const groupMetrics = group.metric_ids.map((id) => metricById[id]).filter(Boolean)}
				{#if groupMetrics.length > 0}
					<div class="mb-3">
						<div
							class="mb-1.5 border-b border-[#f3f4f6] px-[14px] pb-1.5 text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
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
		<div class="mt-2 flex flex-col pb-4">
			{#each metrics as m (m.id)}
				{@render metricCard(m)}
			{/each}
		</div>
	{/if}
{/if}
