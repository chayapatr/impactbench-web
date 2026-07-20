<script lang="ts">
	import {
		appState,
		sidebarBack,
		scenarioPanelState,
		openScenarioPanel,
		closeScenarioPanel
	} from '$lib/store.svelte';
	import { loadScenarioDetail } from '$lib/data';
	import { findMetricInTaxonomy, filterScenariosByAge } from '$lib/utils';
	import type { ScenarioDetail } from '$lib/types';
	import ConversationViewer from '$lib/components/organisms/ConversationViewer.svelte';

	interface Props {
		backLabel: string;
		onBack?: () => void;
	}

	let { backLabel, onBack }: Props = $props();
	const handleBack = $derived(onBack ?? sidebarBack);

	const metricId = $derived(scenarioPanelState.metricId!);
	const scenarioMeta = $derived(scenarioPanelState.scenarioMeta);
	const _found = $derived(findMetricInTaxonomy(appState, metricId));
	const _metric = $derived(_found?.metric);
	const _criteria = $derived(appState.metricCriteria?.[metricId] ?? '');
	const _meta = $derived(appState.metricMeta?.[metricId]);
	const isHarmful = $derived(_metric?.type === 'negative');
	const scenarios = $derived(filterScenariosByAge(appState, metricId));

	let detail: ScenarioDetail | null = $state(null);
	let loading = $state(false);
	let error = $state(false);

	$effect(() => {
		if (!scenarioMeta) return;
		const sc = scenarioMeta;
		detail = null;
		loading = true;
		error = false;
		loadScenarioDetail(sc.benchmark, appState.filters.model, sc.scenario_id)
			.then((d) => {
				detail = d;
				loading = false;
			})
			.catch(() => {
				loading = false;
				error = true;
			});
	});

	function verdictPassOf(sc: (typeof scenarios)[number]): boolean | null {
		const raw = sc.verdicts?.[appState.filters.model];
		if (raw === undefined) return null;
		return isHarmful ? raw === 'no' : raw === 'yes';
	}
	function verdictLabelOf(sc: (typeof scenarios)[number]): string {
		const p = verdictPassOf(sc);
		if (p === null) return '—';
		return p ? 'Pass' : 'Fail';
	}
	function verdictStyleOf(sc: (typeof scenarios)[number]): string {
		const p = verdictPassOf(sc);
		if (p === null) return 'background:#f3f4f6;color:#9ca3af';
		return p ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626';
	}

	const headerTitle = $derived(scenarioMeta?.title ?? _metric?.name ?? metricId);
	const scenarioIndex = $derived(
		scenarioMeta ? scenarios.findIndex((s) => s.scenario_id === scenarioMeta.scenario_id) : -1
	);
</script>

{#if scenarioMeta}
	<!-- Conversation viewer -->
	<div class="flex-1 overflow-y-auto px-4 py-4">
		<ConversationViewer
			{metricId}
			metricName={scenarioMeta.title}
			metricType={_metric?.type}
			scenarioDetail={detail}
			{loading}
			{error}
			verdictOverride={scenarioMeta.verdicts?.[appState.filters.model] ?? null}
		/>
	</div>
{:else}
	<!-- Metric info + scenario picker -->
	<div class="border-b border-[#f3f4f6] px-[16px] pt-[12px] pb-[14px]">
		{#if _meta?.contributor}
			<div class="mb-[10px] text-[12px] font-semibold text-[#1a1a1a]">
				Part of: {_meta.contributor}
			</div>
		{/if}
		{#if _criteria}
			<div
				class="mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
			>
				Metric Description
			</div>
			<div class="text-[12px] leading-[1.6] whitespace-pre-line text-[#374151]">
				{_criteria}
			</div>
		{/if}
		{#if _meta?.mattersBecause}
			<div
				class="mt-[10px] mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
			>
				Why this matters
			</div>
			<div class="text-[12px] leading-[1.6] whitespace-pre-line text-[#374151]">
				{_meta.mattersBecause}
			</div>
		{/if}
	</div>

	<div class="px-4 py-4">
		{#if scenarios.length === 0}
			<p class="text-[12px] text-[#9ca3af]">No scenarios available for this metric.</p>
		{:else}
			<div class="mb-3 text-[11px] font-[700] tracking-[0.06em] text-[#9ca3af] uppercase">
				Scenarios
			</div>
			<div class="flex flex-col gap-[8px]">
				{#each scenarios as sc (sc.scenario_id)}
					<button
						class="flex w-full cursor-pointer items-center gap-[10px] rounded-[10px] bg-white px-[12px] py-[10px] text-left transition-all duration-150 hover:-translate-y-px"
						style="box-shadow: 0 1px 3px rgba(0,0,0,0.08);"
						onclick={() => openScenarioPanel(metricId, sc)}
					>
						<span class="min-w-0 flex-1 text-[12px] leading-[1.45] text-[#374151]"
							>{sc.title}</span
						>
						<span
							class="flex-shrink-0 rounded-full px-[8px] py-[2px] text-[10px] font-bold"
							style={verdictStyleOf(sc)}>{verdictLabelOf(sc)}</span
						>
						<i class="fa-solid fa-chevron-right flex-shrink-0 text-[9px] text-[#c4c8ce]"></i>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
