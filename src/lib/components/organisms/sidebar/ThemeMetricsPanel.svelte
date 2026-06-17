<script lang="ts">
	import { appState, sidebarBack, openScenarioPanel, scenarioPanelState } from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { getModelName, getScores, filterScenariosByAge, metricPassFraction } from '$lib/utils';
	import type { ThemeMetricItem } from '$lib/store.svelte';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import SectionLabel from '$lib/components/atoms/SectionLabel.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';
	import ModelAgeChip from '$lib/components/molecules/ModelAgeChip.svelte';

	interface Props {
		themeName: string;
		themeDesc?: string;
		metrics: ThemeMetricItem[];
	}

	let { themeName, themeDesc, metrics }: Props = $props();

	const scores = $derived(getScores(appState));
	const withScores = $derived(metrics.filter((m) => scores[m.id] !== undefined));
	const avgScore = $derived(withScores.length ? withScores.reduce((s, m) => s + (scores[m.id] ?? 0), 0) / withScores.length : 0);
	const themeColors = $derived(scoreColors(avgScore));
	const metricsWithScore = $derived(metrics.map((m) => ({ ...m, score: scores[m.id] ?? 0, harmful: false })));
	const sorted = $derived([...metricsWithScore].sort((a, b) => b.score - a.score));

	let expandedMetricId: string | null = $state(null);
	let expandedScenarios = $state<ReturnType<typeof filterScenariosByAge>>([]);

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

<StickyHeader backLabel="Your Focus Areas" onBack={sidebarBack}>
	{#snippet right()}
		<ModelAgeChip modelName={getModelName(appState)} age={appState.filters.age} />
	{/snippet}
	{#snippet banner()}
		<ColoredBanner color={themeColors.color} background={themeColors.light} border={themeColors.border} breadcrumb="Your Focus Areas" title={themeName} score={avgScore} />
	{/snippet}
</StickyHeader>

{#if themeDesc}
	<div class="px-[14px] pt-3 pb-2">
		<p class="text-[12px] leading-[1.6] text-balance text-[#6b7280]">{themeDesc}</p>
	</div>
{/if}

<SectionLabel text="Behaviors" spacing="compact" />
<div class="flex flex-col pb-4">
	{#each sorted as m (m.id)}
		{@const mFrac = metricPassFraction(appState, m.id)}
		<div>
			<button
				class="flex w-full items-center gap-[8px] border-l-[3px] px-[14px] py-[7px] text-left transition-colors duration-150 hover:bg-[#f3f4f6]
					{expandedMetricId === m.id ? 'border-l-[#00b3b0] bg-[#f3f4f6]' : 'border-l-transparent'}"
				onclick={() => toggleMetric(m.id)}
			>
				<span class="min-w-0 flex-1 overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-[#374151]">{m.name}</span>
				<ScorePill score={m.score} total={mFrac.total} />
				<i class="fa-solid {expandedMetricId === m.id ? 'fa-chevron-up' : 'fa-chevron-down'} flex-shrink-0 text-[9px] text-[#9ca3af]"></i>
			</button>
			{#if expandedMetricId === m.id}
				<div class="bg-[#f9fafb] pb-1">
					{#if expandedScenarios.length === 0}
						<p class="px-[28px] py-2 text-[11px] text-[#9ca3af]">No scenarios available.</p>
					{:else}
						{#each expandedScenarios as sc (sc.scenario_id)}
							{@const rawResult = sc.verdicts?.[appState.filters.model]}
							{@const pass = rawResult === undefined ? null : rawResult === 'yes'}
							{@const isActive = scenarioPanelState.open && scenarioPanelState.scenarioMeta?.scenario_id === sc.scenario_id}
							<button
								class="flex w-full items-center gap-[8px] px-[28px] py-[9px] text-left transition-colors duration-150 hover:bg-[#f3f4f6] {isActive ? 'bg-[#f0fafa]' : ''}"
								onclick={() => openScenarioPanel(m.id, sc)}
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
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
