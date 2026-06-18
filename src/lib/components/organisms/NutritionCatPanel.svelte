<script lang="ts">
	import { appState, openScenarioPanel, scenarioPanelState } from '$lib/store.svelte';
	import { scorePillStyle, scoreColors } from '$lib/scores';
	import { filterScenariosByAge } from '$lib/utils';
	import { STATIC_MITIGATION_TIPS } from '$lib/model-tips';
	import type { ScenarioMeta } from '$lib/types';
	import BadgeIcon from '$lib/components/atoms/BadgeIcon.svelte';
	import { scoreToLetterGrade } from '$lib/scores';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';

	interface Props {
		catId: string | null;
		modelId: string;
		onClose: () => void;
	}

	let { catId, modelId, onClose }: Props = $props();

	const age = $derived(appState.filters.age);
	const catDef = $derived(catId ? appState.nutritionCat.find((c) => c.id === catId) : null);
	const modelScores = $derived(appState.benchmarkData[`${modelId}|${age}`] ?? {});

	const metrics = $derived(
		(catDef?.metrics ?? [])
			.map((m) => ({ ...m, score: modelScores[m.id] ?? NaN }))
			.sort(
				(a, b) =>
					(Number.isFinite(b.score) ? b.score : -1) - (Number.isFinite(a.score) ? a.score : -1)
			)
	);

	const catScore = $derived(
		(() => {
			const valid = metrics.filter((m) => Number.isFinite(m.score));
			return valid.length ? valid.reduce((s, m) => s + m.score, 0) / valid.length : 0;
		})()
	);

	const colors = $derived(scoreColors(catScore));

	const tips = $derived(STATIC_MITIGATION_TIPS[`${appState.filters.model}|${age}`] ?? []);

	let expandedMetricId: string | null = $state(null);
	let expandedScenarios: ScenarioMeta[] = $state([]);

	function toggleMetric(metricId: string) {
		if (expandedMetricId === metricId) {
			expandedMetricId = null;
			expandedScenarios = [];
		} else {
			expandedMetricId = metricId;
			expandedScenarios = filterScenariosByAge(appState, metricId);
		}
	}

	function stepLabel(score: number): string {
		if (score >= 0.75) return 'Adequate';
		if (score >= 0.55) return 'Partial';
		if (score >= 0.35) return 'Lacking';
		return 'Failing';
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-white">
	{#if catDef}
		<StickyHeader backLabel="Mitigation tips" onBack={onClose}>
			{#snippet banner()}
				<ColoredBanner
					color={colors.color}
					background={colors.light}
					border={colors.border}
					title={catDef.label}
					score={catScore}
					total={metrics.length}
				>
					{#snippet children()}
						<div class="flex items-center gap-2">
							<span
								class="min-w-0 flex-1 text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]"
								>{catDef.label}</span
							>
							<span
								class="flex-shrink-0 text-[18px] leading-none font-[900]"
								style="color:{colors.color}">{scoreToLetterGrade(catScore)}</span
							>
						</div>
						{#if catDef.description}
							<div class="mt-[8px]">
								<!-- <div
									class="mt-4 mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
								>
									What we measure
								</div> -->
								<div class="text-[12px] leading-relaxed text-[#6b7280]">{catDef.description}</div>
							</div>
						{/if}
					{/snippet}
				</ColoredBanner>
			{/snippet}
		</StickyHeader>

		<div class="sidebar-scroll flex-1 overflow-y-auto pt-2">
			{#each metrics as m (m.id)}
				{@const isExpanded = expandedMetricId === m.id}
				<div>
					<div
						class="group flex w-full items-center gap-[8px] border-l-[3px] transition-colors duration-150 hover:bg-[#f3f4f6]
							{isExpanded ? 'border-l-[#00b3b0] bg-[#f3f4f6]' : 'border-l-transparent'}"
					>
						<button
							class="flex min-w-0 flex-1 cursor-pointer items-center gap-[8px] border-none bg-transparent px-[14px] py-[7px] text-left"
							onclick={() => toggleMetric(m.id)}
						>
							<BadgeIcon type={m.type === 'positive_behavior' ? 'pass' : 'fail'} variant="metric" />
							<span
								class="min-w-0 flex-1 text-[12px] text-[#374151] {isExpanded
									? 'whitespace-normal'
									: 'overflow-hidden text-ellipsis whitespace-nowrap'}">{m.name}</span
							>
						</button>
						<button
							class="flex flex-shrink-0 cursor-pointer items-center gap-[6px] border-none bg-transparent py-[7px] pr-[14px]"
							onclick={() => toggleMetric(m.id)}
						>
							{#if isExpanded}
								<span
									class="rounded-full px-[8px] py-[2px] text-[10px] font-semibold"
									style={scorePillStyle(m.score)}>{stepLabel(m.score)}</span
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
								class="fa-solid {isExpanded
									? 'fa-chevron-up'
									: 'fa-chevron-down'} text-[9px] text-[#9ca3af]"
							></i>
						</button>
					</div>

					{#if isExpanded}
						<div class="bg-white pb-1">
							{#if expandedScenarios.length === 0}
								<p class="px-[28px] py-2 text-[11px] text-[#9ca3af]">No scenarios available.</p>
							{:else}
								{#each expandedScenarios as sc (sc.scenario_id)}
									{@const rawResult = sc.verdicts?.[appState.filters.model]}
									{@const _isHarmful = m.type === 'negative_behavior'}
									{@const pass =
										rawResult === undefined
											? null
											: _isHarmful
												? rawResult === 'no'
												: rawResult === 'yes'}
									{@const isActive =
										scenarioPanelState.open &&
										scenarioPanelState.scenarioMeta?.scenario_id === sc.scenario_id}
									<button
										class="flex w-full items-center gap-[8px] px-[28px] py-[9px] text-left transition-colors duration-150 hover:bg-[#f3f4f6] {isActive
											? 'bg-[#f0fafa]'
											: ''}"
										onclick={() => openScenarioPanel(m.id, sc)}
									>
										<BadgeIcon type={pass === null ? 'empty' : pass ? 'pass' : 'fail'} />
										<span
											class="min-w-0 flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[#374151]"
											>{sc.title}</span
										>
										<i class="fa-solid fa-chevron-right flex-shrink-0 text-[9px] text-[#9ca3af]"
										></i>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<!-- Default: mitigation tips -->
		<div class="flex-shrink-0 border-b border-[#e5e7eb] px-5 py-[20px]">
			<h2
				class="mb-1 font-['Source_Serif_Pro',Georgia,serif] text-[18px] font-semibold tracking-[-0.01em] text-[#0f172a]"
			>
				Mitigation tips
			</h2>
			<p class="m-0 text-[12px] leading-[1.5] text-[#6b7280]">
				Built-in model-specific guidance for the worst-performing areas.
			</p>
		</div>
		<div class="sidebar-scroll flex-1 overflow-y-auto px-[18px] py-[14px]">
			{#if tips.length > 0}
				<div class="flex flex-col gap-3">
					{#each tips as t, i (i + t.area)}
						<article
							class="rounded-[10px] border border-[#e5e7eb] bg-white px-[14px] py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
						>
							<div
								class="mb-[6px] flex items-center gap-[6px] text-[11.5px] font-[700] tracking-[0.06em] text-[#b45309] uppercase"
							>
								<i class="fa-solid fa-triangle-exclamation text-[#d97706]"></i>
								{t.area}
							</div>
							<p class="m-0 text-[13px] leading-[1.5] text-[#1f2937]">{t.tip}</p>
						</article>
					{/each}
				</div>
			{:else}
				<p class="text-[12px] leading-[1.5] text-[#6b7280]">
					No mitigation tips for this model yet.
				</p>
			{/if}
		</div>
	{/if}
</div>
