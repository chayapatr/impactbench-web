<script lang="ts">
	import { appState, sidebarBack, openScenarioPanel, scenarioPanelState, sidebarState } from '$lib/store.svelte';
	import { scoreColors, scoreToColor, scorePillStyle } from '$lib/scores';
	import { SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import { getModelName, getScores, computeSubareaScore, filterScenariosByAge, subareaPassFraction } from '$lib/utils';
	import type { ScenarioMeta } from '$lib/types';
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
	const subareaFrac = $derived(subareaPassFraction(appState, subareaId));

	let expandedMetricId: string | null = $state(null);
	let expandedScenarios: ScenarioMeta[] = $state([]);
	function stepLabel(ratio: number): string {
		if (ratio >= 0.75) return 'Adequate';
		if (ratio >= 0.55) return 'Partial';
		if (ratio >= 0.35) return 'Lacking';
		return 'Failing';
	}

	function stepColor(ratio: number): string {
		if (ratio >= 0.75) return '#16a34a';
		if (ratio >= 0.55) return '#ca8a04';
		if (ratio >= 0.35) return '#ea580c';
		return '#dc2626';
	}

	function toggleMetric(metricId: string) {
		if (expandedMetricId === metricId) {
			expandedMetricId = null;
			expandedScenarios = [];
		} else {
			expandedMetricId = metricId;
			expandedScenarios = filterScenariosByAge(appState, metricId);
		}
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
	{@const posMetrics = metrics.filter(
		(m) => (m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'flourishing'
	)}
	{@const negMetrics = metrics.filter(
		(m) => (m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'restrain_harm'
	)}
	{@const posPassed = posMetrics.filter((m) => m.score >= 0.5).length}
	{@const negPassed = negMetrics.filter((m) => m.score >= 0.5).length}

	<StickyHeader backLabel={area.name} onBack={sidebarBack}>
		{#snippet right()}
			<ModelAgeChip modelName={getModelName(appState)} age={appState.filters.age} />
		{/snippet}
		{#snippet banner()}
			<ColoredBanner
				color={subColors.color}
				background={subColors.light}
				border={subColors.border}
				breadcrumb={area.name}
				icon={sub.icon}
				title={sub.name}
				score={subareaScore}
				total={subareaFrac.total}
			/>
		{/snippet}
	</StickyHeader>

	{#if subDesc}
		<div class="px-[14px] pt-3 pb-2">
			<p class="text-[12px] leading-[1.6] text-balance text-[#6b7280]">{subDesc}</p>
		</div>
	{/if}

	<!-- Metric group counts -->
	<div class="flex flex-col gap-[8px] border-b border-[#f3f4f6] px-[14px] pt-3 pb-3">
		<div class="flex items-center justify-between">
			<span class="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
				<i class="fa-solid fa-star text-[11px]" style="color:#93c5fd"></i>
				Promoting good behavior
			</span>
			<span class="flex items-center gap-[6px]">
				<span
					class="rounded-full px-[8px] py-[2px] text-[12px] font-semibold"
					style={scorePillStyle(posMetrics.length ? posPassed / posMetrics.length : 0)}
					>{posPassed}/{posMetrics.length}</span
				>
				<span class="text-[12px] font-medium text-[#374151]">metrics</span>
			</span>
		</div>
		{#if negMetrics.length > 0}
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
					<i class="fa-solid fa-shield text-[11px]" style="color:#c4b5fd"></i>
					Avoiding bad behavior
				</span>
				<span class="flex items-center gap-[6px]">
					<span
						class="rounded-full px-[8px] py-[2px] text-[12px] font-semibold"
						style={scorePillStyle(negMetrics.length ? negPassed / negMetrics.length : 0)}
						>{negPassed}/{negMetrics.length}</span
					>
					<span class="text-[12px] font-medium text-[#374151]">metrics</span>
				</span>
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
					class="flex min-w-0 flex-1 cursor-pointer items-center gap-[8px] border-none bg-transparent px-[14px] py-[7px] text-left"
					onclick={() => toggleMetric(m.id)}
				>
					<BadgeIcon
						type={(m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) ===
						'flourishing'
							? 'pass'
							: 'fail'}
						variant="metric"
					/>
					<span
						class="min-w-0 flex-1 text-[12px] text-[#374151] {expandedMetricId === m.id
							? 'whitespace-normal'
							: 'overflow-hidden text-ellipsis whitespace-nowrap'}">{m.name}</span
					>
				</button>
				<button
					class="flex flex-shrink-0 cursor-pointer items-center gap-[6px] border-none bg-transparent py-[7px] pr-[14px]"
					onclick={() => toggleMetric(m.id)}
				>
					{#if expandedMetricId === m.id}
						<span
							class="rounded-full px-[8px] py-[2px] text-[10px] font-semibold"
							style="background:{m.score >= 0.75
								? '#dcfce7'
								: m.score >= 0.55
									? '#fef9c3'
									: m.score >= 0.35
										? '#ffedd5'
										: '#fee2e2'};color:{m.score >= 0.75
								? '#16a34a'
								: m.score >= 0.55
									? '#ca8a04'
									: m.score >= 0.35
										? '#ea580c'
										: '#dc2626'}">{stepLabel(m.score)}</span
						>
					{:else}
						<span
							class="h-[8px] w-[8px] flex-shrink-0 rounded-full"
							style="background:{m.score >= 0.75
								? '#4ade80'
								: m.score >= 0.55
									? '#facc15'
									: m.score >= 0.35
										? '#fb923c'
										: '#f87171'}"
						></span>
					{/if}
					<i
						class="fa-solid {expandedMetricId === m.id
							? 'fa-chevron-up'
							: 'fa-chevron-down'} text-[9px] text-[#9ca3af]"
					></i>
				</button>
			</div>
			{#if expandedMetricId === m.id}
				<div class="bg-[#f9fafb] pb-1">
					{#if expandedScenarios.length === 0}
						<p class="px-[28px] py-2 text-[11px] text-[#9ca3af]">No scenarios available.</p>
					{:else}
						{#each expandedScenarios as sc (sc.scenario_id)}
							{@const rawResult = sc.verdicts?.[appState.filters.model]}
							{@const _isHarmful =
								m.behavior_type === 'restrain_harm' && m.measurement === 'presence'}
							{@const pass =
								rawResult === undefined
									? null
									: _isHarmful
										? rawResult === 'no'
										: rawResult === 'yes'}
							{@const isActive = scenarioPanelState.open && scenarioPanelState.scenarioMeta?.scenario_id === sc.scenario_id}
							<button
								class="flex w-full items-center gap-[8px] px-[28px] py-[9px] text-left transition-colors duration-150 hover:bg-[#f3f4f6] {isActive ? 'bg-[#f0fafa]' : ''}"
								onclick={() => openScenarioPanel(m.id, sc)}
							>
								<BadgeIcon type={pass === null ? 'empty' : pass ? 'pass' : 'fail'} />
								<span
									class="min-w-0 flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[#374151]"
									>{sc.title}</span
								>
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
						<div
							class="mb-0.5 border-b border-[#f3f4f6] px-[14px] pb-1.5 text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
						>
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
		<div
			class="mt-2 flex items-center justify-between gap-2 px-6 pt-[10px] pb-2 text-[11px] font-medium tracking-[0.06em] text-[#9ca3af] uppercase"
		>
			<span>All Behaviors</span>
			<div class="flex gap-[5px]">
				{#each [['score-desc', 'Score ↓'], ['score-asc', 'Score ↑'], ['name-asc', 'A–Z']] as [mode, label] (mode)}
					<button
						class="cursor-pointer rounded-[12px] border-[1.5px] px-[10px] py-[3px] text-[11px] font-medium transition-all duration-150
							{sidebarState.behaviorSort === mode
							? 'border-[#80d8d7] bg-[#e0f7f7] font-medium text-[#00b3b0]'
							: 'border-[#e5e7eb] bg-[#fafaf9] text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]'}"
						onclick={() => (sidebarState.behaviorSort = mode as typeof sidebarState.behaviorSort)}
						>{label}</button
					>
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
