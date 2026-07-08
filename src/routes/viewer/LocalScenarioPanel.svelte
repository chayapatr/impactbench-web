<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import type { ScenarioMeta, ScenarioDetail } from '$lib/types';
	import ConversationViewer from '$lib/components/organisms/ConversationViewer.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';
	import { METRIC_MAP } from './metric-map';

	interface Props {
		metricId: string;
		scenarioMeta: ScenarioMeta;
		scenarioDetail: ScenarioDetail | null;
		backLabel: string;
		onBack?: () => void;
	}

	let { metricId, scenarioMeta, scenarioDetail, backLabel, onBack }: Props = $props();

	const mapped = $derived(METRIC_MAP[metricId]);
	const metricName = $derived(mapped?.name ?? metricId);
	const behaviorType = $derived<'flourishing' | 'restrain_harm' | undefined>(
		mapped ? (mapped.type === 'negative' ? 'restrain_harm' : 'flourishing') : undefined
	);
</script>

<StickyHeader {backLabel} onBack={onBack ?? (() => {})}>
	{#snippet right()}
		<span class="truncate text-[11px] font-semibold text-[#9ca3af]">
			{appState.models.find((m) => m.id === appState.filters.model)?.name ?? ''}
		</span>
	{/snippet}
	{#snippet banner()}
		<ColoredBanner color="#6b7280" title={metricName}>
			{#if behaviorType}
				<div class="mb-[6px]">
					<span
						class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
						style={behaviorType === 'restrain_harm'
							? 'background:#ede9fe;color:#7c3aed'
							: 'background:#dbeafe;color:#2563eb'}
					>
						<i
							class="fa-solid {behaviorType === 'flourishing'
								? 'fa-star'
								: 'fa-shield-halved'} text-[9px]"
						></i>
						{behaviorType === 'flourishing' ? 'Promoting good behavior' : 'Avoiding bad behavior'}
					</span>
				</div>
			{/if}
			<span class="text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]"
				>{metricName}</span
			>
		</ColoredBanner>
	{/snippet}
</StickyHeader>

<div class="px-6 py-4">
	<ConversationViewer
		{metricId}
		metricName={scenarioMeta.title}
		metricType={mapped?.type ?? 'positive'}
		{scenarioDetail}
		loading={false}
		error={!scenarioDetail}
		verdictOverride={scenarioMeta.verdicts?.[appState.filters.model] ?? null}
	/>
</div>
