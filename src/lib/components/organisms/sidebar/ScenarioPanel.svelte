<script lang="ts">
	import { appState, sidebarBack, scenarioPanelState } from '$lib/store.svelte';
	import { loadScenarioDetail } from '$lib/data';
	import { getModelName, findMetricInTaxonomy, filterScenariosByAge } from '$lib/utils';
	import type { ScenarioDetail, ScenarioMeta } from '$lib/types';
	import ConversationViewer from '$lib/components/organisms/ConversationViewer.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';

	interface Props {
		backLabel: string;
		onBack?: () => void;
	}

	let { backLabel, onBack }: Props = $props();
	const handleBack = $derived(onBack ?? sidebarBack);

	const metricId = $derived(scenarioPanelState.metricId!);
	const _metric = $derived(findMetricInTaxonomy(appState, metricId)?.metric);
	const isHarmful = $derived(_metric?.type === 'negative');
	const scenarios = $derived(filterScenariosByAge(appState, metricId));

	// Modal state – which scenario the user clicked
	let modalScenario: ScenarioMeta | null = $state(null);
	let modalDetail: ScenarioDetail | null = $state(null);
	let modalLoading = $state(false);
	let modalError = $state(false);

	$effect(() => {
		if (!modalScenario) return;
		modalDetail = null;
		modalLoading = true;
		modalError = false;
		loadScenarioDetail(
			modalScenario.benchmark,
			appState.filters.model,
			modalScenario.scenario_id
		)
			.then((d) => {
				modalDetail = d;
				modalLoading = false;
			})
			.catch(() => {
				modalLoading = false;
				modalError = true;
			});
	});

	function openModal(sc: ScenarioMeta) {
		modalScenario = sc;
	}
	function closeModal() {
		modalScenario = null;
		modalDetail = null;
	}

	function verdictPass(sc: ScenarioMeta): boolean | null {
		const raw = sc.verdicts?.[appState.filters.model];
		if (raw === undefined) return null;
		return isHarmful ? raw === 'no' : raw === 'yes';
	}
	function verdictLabel(sc: ScenarioMeta): string {
		const p = verdictPass(sc);
		if (p === null) return 'Unknown';
		return p ? 'Pass' : 'Fail';
	}
	function verdictStyle(sc: ScenarioMeta): string {
		const p = verdictPass(sc);
		if (p === null) return 'background:#f3f4f6;color:#9ca3af';
		return p ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626';
	}
</script>

<StickyHeader {backLabel} onBack={handleBack}>
	{#snippet right()}
		<span class="truncate text-[11px] font-semibold text-[#9ca3af]">{getModelName(appState)}</span>
	{/snippet}
	{#snippet banner()}
		<ColoredBanner color="#6b7280" title={_metric?.name ?? metricId}>
			{#if _metric?.type}
				<div class="mb-[6px]">
					<span
						class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
						style={_metric.type === 'negative'
					? 'background:#f3f4f6;color:#c4b5fd'
					: 'background:#f3f4f6;color:#93c5fd'}
					>
						<i
							class="fa-solid {_metric.type === 'negative'
								? 'fa-shield-halved'
								: 'fa-star'} text-[9px]"
						></i>
						{_metric.type === 'negative' ? 'Avoiding bad behavior' : 'Promoting good behavior'}
					</span>
				</div>
			{/if}
			<span class="text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]"
				>{_metric?.name ?? metricId}</span
			>
			{@const criteria = appState.metricCriteria?.[metricId] ?? ''}
			{@const meta = appState.metricMeta?.[metricId]}
			{#if meta?.contributor}
				<div class="mt-[6px] mb-[10px] text-[12px] font-semibold text-[#1a1a1a]">
					Part of: {meta.contributor}
				</div>
			{/if}
			{#if criteria}
				<div class="mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
					Description
				</div>
				<div class="text-[12px] leading-relaxed whitespace-pre-line text-[#4b5563]">
					{criteria}
				</div>
			{/if}
			{#if meta?.mattersBecause}
				<div
					class="mt-[10px] mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
				>
					Why this matters
				</div>
				<div class="text-[12px] leading-relaxed whitespace-pre-line text-[#4b5563]">
					{meta.mattersBecause}
				</div>
			{/if}
		</ColoredBanner>
	{/snippet}
</StickyHeader>

<!-- Scenario picker -->
<div class="px-5 py-4">
	{#if scenarios.length === 0}
		<p class="text-[12px] text-[#9ca3af]">No scenarios available for this metric.</p>
	{:else}
		<div class="mb-3 text-[11px] font-[700] tracking-[0.06em] text-[#9ca3af] uppercase">Scenarios</div>
		<div class="flex flex-col gap-[8px]">
			{#each scenarios as sc (sc.scenario_id)}
				<button
					class="flex w-full cursor-pointer items-start gap-[10px] rounded-[10px] bg-white p-[12px] text-left transition-all duration-150"
					style="box-shadow: 0 1px 4px {verdictPass(sc) === null ? 'rgba(0,0,0,0.06)' : verdictPass(sc) ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)'}"
					onclick={() => openModal(sc)}
				>
					<span class="min-w-0 flex-1 text-[12px] leading-[1.45] text-[#374151]">{sc.title}</span>
					<span
						class="flex-shrink-0 rounded-full px-[8px] py-[2px] text-[10px] font-bold"
						style={verdictStyle(sc)}
					>{verdictLabel(sc)}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Scenario detail modal -->
{#if modalScenario}
	<div
		class="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
		role="dialog"
		aria-modal="true"
		onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
	>
		<div
			class="relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
		>
			<!-- Modal header -->
			<div class="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[#e5e7eb] px-6 py-4">
				<div class="min-w-0">
					<div class="mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">Scenario</div>
					<div class="text-[13px] font-[600] leading-[1.4] text-[#111827]">{modalScenario.title}</div>
				</div>
				<div class="flex flex-shrink-0 items-center gap-2">
					<span
						class="rounded-full px-[8px] py-[2px] text-[10px] font-bold"
						style={verdictStyle(modalScenario)}
					>{verdictLabel(modalScenario)}</span>
					<button
						type="button"
						class="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]"
						aria-label="Close"
						onclick={closeModal}
					>
						<i class="fa-solid fa-xmark text-[13px]"></i>
					</button>
				</div>
			</div>
			<!-- Modal body (scrollable) -->
			<div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
				<ConversationViewer
					{metricId}
					metricName={modalScenario.title}
					metricType={_metric?.type}
					scenarioDetail={modalDetail}
					loading={modalLoading}
					error={modalError}
					verdictOverride={modalScenario.verdicts?.[appState.filters.model] ?? null}
				/>
			</div>
		</div>
	</div>
{/if}
