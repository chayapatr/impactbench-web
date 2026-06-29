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
		<ColoredBanner color="#6b7280" background="#f9fafb" border="#e5e7eb" title={_metric?.name ?? metricId}>
			{#snippet children()}
				{#if _metric?.behavior_type}
					<div class="mb-[6px]">
						<span class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold" style="{_metric.behavior_type === 'restrain_harm' ? 'background:#ede9fe;color:#7c3aed' : 'background:#dbeafe;color:#2563eb'}">
							<i class="fa-solid {_metric.behavior_type === 'flourishing' ? 'fa-star' : 'fa-shield-halved'} text-[9px]"></i>
							{_metric.behavior_type === 'flourishing' ? 'Promoting good behavior' : 'Avoiding bad behavior'}
						</span>
					</div>
				{/if}
				<span class="text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]">{_metric?.name ?? metricId}</span>
				{@const criteria = appState.metricCriteria?.[metricId] ?? ''}
				{@const meta = appState.metricMeta?.[metricId]}
				{#if meta?.contributor}
					<div class="mt-[6px] mb-[10px] text-[12px] font-semibold text-[#1a1a1a]">Part of: {meta.contributor}</div>
				{/if}
				{#if criteria}
					<div class="mb-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Description</div>
					<div class="text-[12px] leading-relaxed text-[#4b5563] whitespace-pre-line">{criteria}</div>
				{/if}
				{#if meta?.mattersBecause}
					<div class="mt-[10px] mb-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Why this matters</div>
					<div class="text-[12px] leading-relaxed text-[#4b5563] whitespace-pre-line">{meta.mattersBecause}</div>
				{/if}
			{/snippet}
		</ColoredBanner>
	{/snippet}
</StickyHeader>

<div class="px-6 py-4">
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
