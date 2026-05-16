<script lang="ts">
	import { appState, sidebarBack, sidebarPush, sidebarState } from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import { getModelName, getScores, computeSubareaScore, filterScenariosByAge } from '$lib/utils';
	import type { ScenarioMeta } from '$lib/types';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import BadgeIcon from '$lib/components/atoms/BadgeIcon.svelte';
	import SectionLabel from '$lib/components/atoms/SectionLabel.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';
	import ModelAgeChip from '$lib/components/molecules/ModelAgeChip.svelte';

	interface Props {
		subareaId: string;
	}

	let { subareaId }: Props = $props();

	const subareaTuple = $derived(() => {
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

	let expandedMetricId: string | null = $state(null);
	let expandedScenarios: ScenarioMeta[] = $state([]);
	let copiedMetricId: string | null = $state(null);

	function toggleMetric(metricId: string) {
		if (expandedMetricId === metricId) {
			expandedMetricId = null;
			expandedScenarios = [];
		} else {
			expandedMetricId = metricId;
			expandedScenarios = filterScenariosByAge(appState, metricId);
		}
	}

	function copyMetricLink(metricId: string, e: MouseEvent) {
		e.stopPropagation();
		const url = new URL(window.location.href);
		url.search = '';
		url.searchParams.set('metric', metricId);
		navigator.clipboard.writeText(url.toString()).then(() => {
			copiedMetricId = metricId;
			setTimeout(() => { copiedMetricId = null; }, 2000);
		});
	}
</script>

{#if subareaTuple()}
	{@const { sub, area } = subareaTuple()!}
	{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
	{@const metrics = sub.metrics.map((m) => ({ ...m, score: scores[m.id] ?? 0 }))}
	{@const sorted =
		sidebarState.behaviorSort === 'score-desc'
			? [...metrics].sort((a, b) => b.score - a.score)
			: sidebarState.behaviorSort === 'score-asc'
				? [...metrics].sort((a, b) => a.score - b.score)
				: sidebarState.behaviorSort === 'name-asc'
					? [...metrics].sort((a, b) => a.name.localeCompare(b.name))
					: metrics}
	{@const posMetrics = metrics.filter((m) => (m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'flourishing')}
	{@const negMetrics = metrics.filter((m) => (m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'restrain_harm')}
	{@const posAvg = posMetrics.length ? posMetrics.reduce((s, m) => s + m.score, 0) / posMetrics.length : 0}
	{@const negAvg = negMetrics.length ? negMetrics.reduce((s, m) => s + m.score, 0) / negMetrics.length : 0}
	{@const posColor = posAvg >= 0.75 ? '#16a34a' : posAvg >= 0.55 ? '#d97706' : posAvg >= 0.35 ? '#ea580c' : '#dc2626'}
	{@const negColor = negAvg >= 0.75 ? '#16a34a' : negAvg >= 0.55 ? '#d97706' : negAvg >= 0.35 ? '#ea580c' : '#dc2626'}

	<StickyHeader backLabel={area.name} onBack={sidebarBack}>
		{#snippet right()}
			<ModelAgeChip modelName={getModelName(appState)} age={appState.filters.age} />
		{/snippet}
		{#snippet banner()}
			<ColoredBanner color={subColors.color} background={subColors.light} border={subColors.border} breadcrumb={area.name} icon={sub.icon} title={sub.name} score={subareaScore} />
		{/snippet}
	</StickyHeader>

	{#if subDesc}
		<div class="px-[14px] pt-3 pb-2">
			<p class="text-[12px] leading-[1.6] text-balance text-[#6b7280]">{subDesc}</p>
		</div>
	{/if}

	<!-- Score breakdown bars -->
	<div class="mt-4 flex items-baseline gap-1.5 px-[14px] pt-[10px] pb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
		Score Breakdown <span class="font-normal tracking-normal text-[#9ca3af] normal-case">(higher is better)</span>
	</div>
	<div class="flex flex-col gap-3 px-[14px] pb-3">
		<div>
			<div class="mb-1.5 flex items-center justify-between">
				<span class="flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
					<span class="inline-flex h-[16px] w-[16px] items-center justify-center rounded-full text-[10px]" style="background:#f3f4f6;color:#93c5fd"><i class="fa-solid fa-star" style="font-size:7px"></i></span>
					Flourishing
					<span class="font-normal text-[#9ca3af]">· {posMetrics.length} metrics</span>
				</span>
				<span class="text-[12px] font-bold" style="color:{posColor}">{posAvg.toFixed(2)}</span>
			</div>
			<div class="h-[8px] w-full overflow-hidden rounded-[4px] bg-[#f3f4f6]">
				<div class="h-full rounded-[4px] transition-[width] duration-300" style="width:{Math.round(posAvg * 100)}%;background:{posColor}"></div>
			</div>
		</div>
		{#if negMetrics.length > 0}
			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<span class="flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
						<span class="inline-flex h-[16px] w-[16px] items-center justify-center rounded-full text-[10px]" style="background:#f3f4f6;color:#c4b5fd"><i class="fa-solid fa-shield" style="font-size:7px"></i></span>
						Harm restraint
						<span class="font-normal text-[#9ca3af]">· {negMetrics.length} metrics</span>
					</span>
					<span class="text-[12px] font-bold" style="color:{negColor}">{negAvg.toFixed(2)}</span>
				</div>
				<div class="h-[8px] w-full overflow-hidden rounded-[4px] bg-[#f3f4f6]">
					<div class="h-full rounded-[4px] transition-[width] duration-300" style="width:{Math.round(negAvg * 100)}%;background:{negColor}"></div>
				</div>
			</div>
		{/if}
	</div>

	{@const metricById = Object.fromEntries(metrics.map((m) => [m.id, m]))}
	{@const hasGroups = sub.groups && sub.groups.length > 0}

	{#snippet metricRow(m: (typeof metrics)[0])}
		<div>
			<div
				class="group flex w-full items-center gap-[8px] border-l-[3px] transition-colors duration-150 hover:bg-[#f3f4f6]
					{expandedMetricId === m.id ? 'border-l-[#00b3b0] bg-[#f3f4f6]' : 'border-l-transparent'}"
			>
				<button
					class="flex min-w-0 flex-1 items-center gap-[8px] px-[14px] py-[7px] text-left cursor-pointer border-none bg-transparent"
					onclick={() => toggleMetric(m.id)}
				>
					<BadgeIcon type={(m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'flourishing' ? 'pass' : 'fail'} variant="metric" />
					<span class="min-w-0 flex-1 text-[12px] text-[#374151] {expandedMetricId === m.id ? 'whitespace-normal' : 'overflow-hidden text-ellipsis whitespace-nowrap'}">{m.name}</span>
				</button>
				<div class="relative flex-shrink-0">
					<button
						class="p-[3px] rounded text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-[#00b3b0] cursor-pointer border-none bg-transparent"
						onclick={(e) => copyMetricLink(m.id, e)}
					>
						<i class="fa-solid {copiedMetricId === m.id ? 'fa-check text-[#16a34a]' : 'fa-link'} text-[9px]"></i>
					</button>
					{#if copiedMetricId === m.id}
						<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-[5px] whitespace-nowrap rounded-[5px] bg-[#1a1a1a] px-[8px] py-[4px] text-[11px] font-medium text-white shadow-md pointer-events-none z-50">
							Link copied!
							<div class="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-[#1a1a1a]"></div>
						</div>
					{/if}
				</div>
				<button
					class="flex-shrink-0 flex items-center gap-[4px] pr-[14px] py-[7px] cursor-pointer border-none bg-transparent"
					onclick={() => toggleMetric(m.id)}
				>
					<ScorePill score={m.score} />
					<i class="fa-solid {expandedMetricId === m.id ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px] text-[#9ca3af]"></i>
				</button>
			</div>
			{#if expandedMetricId === m.id}
				<div class="bg-[#f9fafb] pb-1">
					{#if expandedScenarios.length === 0}
						<p class="px-[28px] py-2 text-[11px] text-[#9ca3af]">No scenarios available.</p>
					{:else}
						{#each expandedScenarios as sc (sc.scenario_id)}
							{@const rawResult = sc.verdicts?.[appState.filters.model]}
							{@const _isHarmful = m.behavior_type === 'restrain_harm' && m.measurement === 'presence'}
							{@const pass = rawResult === undefined ? null : _isHarmful ? rawResult === 'no' : rawResult === 'yes'}
							<button
								class="flex w-full items-center gap-[8px] px-[28px] py-[9px] text-left transition-colors duration-150 hover:bg-[#f3f4f6]"
								onclick={() => sidebarPush({ type: 'scenario', metricId: m.id, scenarioMeta: sc })}
							>
								<BadgeIcon type={pass === null ? 'empty' : pass ? 'pass' : 'fail'} />
								<span class="min-w-0 flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[#374151]">{sc.title}</span>
								<i class="fa-solid fa-chevron-right flex-shrink-0 text-[9px] text-[#9ca3af]"></i>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	{#if hasGroups}
		<div class="mt-3 flex flex-col gap-5 pb-4">
			{#each sub.groups as group (group.name)}
				{@const groupMetrics = group.metric_ids.map((id) => metricById[id]).filter(Boolean)}
				{#if groupMetrics.length > 0}
					<div>
						<div class="mb-0.5 border-b border-[#f3f4f6] px-[14px] pb-1.5 text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
							{group.name}
						</div>
						{#each groupMetrics as m (m.id)}
							{@render metricRow(m)}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="mt-2 flex items-center justify-between gap-2 px-6 pt-[10px] pb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
			<span>All Behaviors</span>
			<div class="flex gap-[5px]">
				{#each [['score-desc', 'Score ↓'], ['score-asc', 'Score ↑'], ['name-asc', 'A–Z']] as [mode, label] (mode)}
					<button
						class="cursor-pointer rounded-[12px] border-[1.5px] px-[10px] py-[3px] text-[11px] font-medium transition-all duration-150
							{sidebarState.behaviorSort === mode
							? 'border-[#80d8d7] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
							: 'border-[#e5e7eb] bg-[#fafaf9] text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]'}"
						onclick={() => (sidebarState.behaviorSort = mode as typeof sidebarState.behaviorSort)}
					>{label}</button>
				{/each}
			</div>
		</div>
		<div class="flex flex-col pb-4">
			{#each sorted as m (m.id)}
				{@render metricRow(m)}
			{/each}
		</div>
	{/if}
{/if}
