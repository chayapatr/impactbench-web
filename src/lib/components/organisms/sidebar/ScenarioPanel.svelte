<script lang="ts">
	import { appState, sidebarBack } from '$lib/store.svelte';
	import { loadScenarioDetail } from '$lib/data';
	import { getModelName, findMetricInTaxonomy } from '$lib/utils';
	import type { ScenarioMeta, ScenarioDetail } from '$lib/types';
	import ConversationViewer from '$lib/components/organisms/ConversationViewer.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';

	interface Props {
		metricId: string;
		scenarioMeta: ScenarioMeta;
		backLabel: string;
		onBack?: () => void;
	}

	let { metricId, scenarioMeta, backLabel, onBack }: Props = $props();
	const handleBack = $derived(onBack ?? sidebarBack);

	const _metric = $derived(findMetricInTaxonomy(appState, metricId)?.metric);

	let scenarioDetail: ScenarioDetail | null = $state(null);
	let scenarioLoading = $state(false);
	let scenarioError = $state(false);

	$effect(() => {
		scenarioDetail = null;
		scenarioLoading = true;
		scenarioError = false;
		loadScenarioDetail(scenarioMeta.benchmark, appState.filters.model, scenarioMeta.scenario_id)
			.then((d) => { scenarioDetail = d; scenarioLoading = false; })
			.catch(() => { scenarioLoading = false; scenarioError = true; });
	});
</script>

<StickyHeader {backLabel} onBack={handleBack}>
	{#snippet right()}
		<span class="truncate text-[11px] font-semibold text-[#9ca3af]">{getModelName(appState)}</span>
	{/snippet}
	{#snippet banner()}
		<ColoredBanner color="#6b7280" background="#f9fafb" border="#e5e7eb" title={scenarioMeta.title}>
			{#snippet children()}
				<span class="text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]">{scenarioMeta.title}</span>
				{#if _metric}
					<div class="mt-[4px] text-[11px] text-[#9ca3af]">{_metric.name}</div>
				{/if}
			{/snippet}
		</ColoredBanner>
	{/snippet}
</StickyHeader>

<div class="px-6 py-4">
	{#if _metric?.behavior_type}
		<div class="mb-4">
			<span class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold" style="{_metric.behavior_type === 'restrain_harm' ? 'background:#ede9fe;color:#7c3aed' : 'background:#dbeafe;color:#2563eb'}">
				<i class="fa-solid {_metric.behavior_type === 'flourishing' ? 'fa-star' : 'fa-shield-halved'} text-[9px]"></i>
				{_metric.behavior_type === 'flourishing' ? 'Promoting good behavior' : 'Avoiding bad behavior'}
			</span>
		</div>
	{/if}
	<ConversationViewer
		{metricId}
		metricName={scenarioMeta.title}
		behaviorType={_metric?.behavior_type}
		measurement={_metric?.measurement}
		{scenarioDetail}
		loading={scenarioLoading}
		error={scenarioError}
		verdictOverride={scenarioMeta.verdicts?.[appState.filters.model] ?? null}
	/>
</div>
