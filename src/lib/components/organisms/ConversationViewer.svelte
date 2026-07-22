<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { safeMarkdownHtml } from '$lib/safe-markdown';
	import { modelsForSurface } from '$lib/utils';
	import type { ScenarioDetail } from '$lib/types';

	interface Props {
		metricId: string;
		metricName: string;
		metricType?: 'positive' | 'negative';
		scenarioDetail: ScenarioDetail | null;
		loading: boolean;
		error: boolean;
		verdictOverride?: string | null;
		showModelSwitcher?: boolean;
		viewingModelId?: string;
		scenarioId?: string;
		onSwitchModel?: (modelId: string) => void;
	}

	let {
		metricId,
		metricName,
		metricType = 'positive',
		scenarioDetail,
		loading,
		error,
		showModelSwitcher = false,
		viewingModelId = '',
		scenarioId = '',
		onSwitchModel,
		verdictOverride = null
	}: Props = $props();

	const isHarmful = $derived(metricType === 'negative');
</script>

{#if loading}
	<div class="mt-4 flex items-center gap-2 text-[#9ca3af]">
		<div
			class="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#00b3b0]"
		></div>
		<span class="text-[13px]">Loading conversation…</span>
	</div>
{:else if error}
	<p class="mt-4 text-[13px] text-[#dc2626]">Failed to load conversation.</p>
{:else if scenarioDetail}
	{@const rawResult = verdictOverride}
	{@const pass = rawResult == null ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
	{@const turns = scenarioDetail.transcript ?? []}

	<!-- Scenario title -->
	{#if metricName}
		<div class="mb-4">
			<div class="mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
				Scenario
			</div>
			<div class="flex items-start gap-[8px]">
				<div class="min-w-0 flex-1 text-[12px] font-[600] text-[#374151]">{metricName}</div>
				{#if pass !== null}
					<span
						class="mt-[1px] flex-shrink-0 rounded-full px-[8px] py-[2px] text-[10px] font-bold"
						style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
						>{pass ? 'Pass' : 'Fail'}</span
					>
				{/if}
			</div>
		</div>

		{#if scenarioDetail.persona}
			<div class="-mt-2 mb-4 text-[12px] leading-relaxed text-[#374151]">
				{scenarioDetail.persona}
			</div>
		{/if}
		<div class="-mx-6 mb-4 border-t border-[#e5e7eb]"></div>
	{/if}

	<!-- Persona -->
	<!-- {#if scenarioDetail.persona}
		<div class="mb-4">
			<div class="mb-[6px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
				Persona
			</div>
			<div class="text-[12px] leading-relaxed text-[#374151]">{scenarioDetail.persona}</div>
		</div>
		<div class="-mx-6 mb-4 border-t border-[#e5e7eb]"></div>
	{/if} -->

	<!-- Model switcher -->
	{#if showModelSwitcher}
		<div class="mb-4 flex flex-wrap gap-[5px]">
			{#each modelsForSurface(appState, 'full') as model (model.id)}
				{@const verdict2 = appState.scenarioIndex?.[metricId]?.find(
					(sc) => sc.scenario_id === scenarioId
				)?.verdicts?.[model.id]}
				{@const pass2 =
					verdict2 === undefined ? null : isHarmful ? verdict2 === 'no' : verdict2 === 'yes'}
				<button
					class="inline-flex cursor-pointer items-center gap-[5px] rounded-[6px] border-[1.5px] px-[8px] py-[3px] text-[11px] font-medium transition-all duration-150
						{viewingModelId === model.id
						? 'border-[#00b3b0] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
						: 'border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
					onclick={() => onSwitchModel?.(model.id)}
				>
					{#if pass2 !== null}
						<span
							class="inline-flex h-[12px] w-[12px] flex-shrink-0 items-center justify-center rounded-full text-[7px] font-[800]"
							style={pass2
								? 'background:#dcfce7;color:#16a34a'
								: 'background:#fee2e2;color:#dc2626'}>{pass2 ? '✓' : '✗'}</span
						>
					{/if}
					{model.name}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Verdict — badge and reasoning always visible -->
	{#if pass !== null}
		<div class="mb-4">
			<div class="flex items-center gap-2">
				<div class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">Verdict</div>
				<span
					class="rounded-full px-2 py-0.5 text-[10px] font-bold"
					style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
					>{pass ? 'Pass' : 'Fail'}</span
				>
			</div>
			{#if scenarioDetail.justification}
				<div class="prose prose-sm mt-2 max-w-none text-[12px] leading-loose text-[#6b7280]">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized markdown -->
					{@html safeMarkdownHtml(scenarioDetail.justification)}
				</div>
			{/if}
		</div>
		<div class="-mx-6 mb-4 border-t border-[#e5e7eb]"></div>
	{/if}

	<!-- Conversation -->
	<div class="mb-3 text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
		Conversation
	</div>
	{#each turns as turn, i (i)}
		<div class="mb-3 {turn.role === 'user' ? 'text-right' : 'text-left'}">
			<div
				class="mb-1 text-[9px] font-semibold tracking-wide uppercase {turn.role === 'user'
					? 'text-[#00b3b0]'
					: 'text-[#9ca3af]'}"
			>
				{turn.role === 'user' ? 'User' : 'AI'}
			</div>
			<div
				class="prose prose-sm inline-block max-w-[88%] max-w-none rounded-xl px-3 py-2 text-left text-[12px] {turn.role ===
				'user'
					? 'bg-[#e0f7f7] text-[#1a1a1a] prose-invert'
					: 'bg-[#f3f4f6] text-[#374151]'}"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized markdown -->
				{@html safeMarkdownHtml(turn.content)}
			</div>
		</div>
	{/each}
{/if}
