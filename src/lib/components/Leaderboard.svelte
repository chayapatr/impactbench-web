<script lang="ts">
	import { appState, leaderboardState, setFilters } from '$lib/store.svelte';
	import { makeBenchmarkKey } from '$lib/data';
	import { formatScore } from '$lib/scores';

	const AGE_OPTIONS = [
		{ value: 'adult', label: 'Adult (18+)' },
		{ value: 'child', label: 'Child / Teen (6–17)' }
	];

	interface Props {
		onModelSelect: (modelId: string) => void;
	}

	let { onModelSelect }: Props = $props();

	function computeSplitScore(modelId: string, areaId: string | null, subareaId: string | null) {
		const key = makeBenchmarkKey(modelId, appState.filters.age);
		const scores = appState.benchmarkData[key];
		if (!scores) return { avg: 0.5, pos: 0.5, neg: 0.5 };

		const posIds: string[] = [];
		const negIds: string[] = [];

		for (const area of appState.taxonomy?.areas ?? []) {
			if (areaId && area.id !== areaId) continue;
			for (const sub of area.subareas) {
				if (subareaId && sub.id !== subareaId) continue;
				for (const m of sub.metrics) {
					if (m.harmful) negIds.push(m.id);
					else posIds.push(m.id);
				}
			}
		}

		if (posIds.length + negIds.length === 0) return { avg: 0.5, pos: 0.5, neg: 0.5 };

		const posVals = posIds.map((id) => scores[id] ?? 0);
		const negVals = negIds.map((id) => scores[id] ?? 0);
		const allVals = [...posVals, ...negVals];
		const pos = posVals.length ? posVals.reduce((a, b) => a + b, 0) / posVals.length : 0.5;
		const neg = negVals.length ? negVals.reduce((a, b) => a + b, 0) / negVals.length : 0.5;
		const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
		return { avg, pos, neg };
	}

	const ranked = $derived(
		appState.models
			.map((m) => ({
				model: m,
				split: computeSplitScore(
					m.id,
					leaderboardState.selectedAreaId,
					leaderboardState.selectedSubareaId
				)
			}))
			.sort((a, b) => b.split.avg - a.split.avg)
	);

	const isSmartMode = $derived(leaderboardState.smartRanked.length > 0);

	function selectModel(modelId: string) {
		onModelSelect(modelId);
	}
	function selectArea(areaId: string | null) {
		leaderboardState.selectedAreaId = areaId;
		leaderboardState.selectedSubareaId = null;
	}
	function selectSubarea(subareaId: string | null) {
		leaderboardState.selectedSubareaId = subareaId;
	}

	const subtitle = $derived(() => {
		if (!leaderboardState.selectedAreaId)
			return 'Rankings reflect average impact across all 260 behavioral indicators.';
		const area = appState.taxonomy?.areas.find((a) => a.id === leaderboardState.selectedAreaId);
		if (!leaderboardState.selectedSubareaId) return `Rankings filtered to the ${area?.name} area.`;
		const sub = area?.subareas.find((s) => s.id === leaderboardState.selectedSubareaId);
		return `Rankings filtered to ${sub?.name} (${area?.name}).`;
	});
</script>

<!-- Leaderboard header (sticky) -->
<div class="sticky top-0 z-[1] flex-shrink-0 bg-white border-b border-[#f3f4f6]">
	<!-- Title row -->
	<div class="px-5 pt-[14px] pb-[10px]">
		<div class="flex items-center justify-between gap-2">
			<h2 class="flex items-center gap-2 text-[15px] font-[800] text-[#1a1a1a] tracking-[-0.01em]">
				<i class="fa-solid fa-trophy text-[12px] text-[#f59e0b]"></i>
				Model Rankings
			</h2>
			<span class="inline-block rounded bg-[#e5e7eb] px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-[0.5px] text-[#6b7280] uppercase">beta</span>
		</div>
		<p class="mt-[4px] text-[11px] leading-[1.4] text-[#9ca3af]">{subtitle()}</p>
	</div>

	<!-- Age group -->
	<div class="px-5 pb-[10px] flex flex-col gap-[5px]">
		<div class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Age Group</div>
		<div class="flex gap-[6px]">
			{#each AGE_OPTIONS as opt (opt.value)}
				<button
					class="flex-1 py-[4px] rounded-[6px] text-[11px] font-semibold border-[1.5px] transition-all duration-150 cursor-pointer
						{appState.filters.age === opt.value
							? 'bg-[#e0f7f7] border-[#00b3b0] text-[#00b3b0]'
							: 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
					onclick={() => setFilters({ ...appState.filters, age: opt.value })}
				>{opt.label}</button>
			{/each}
		</div>
	</div>

	<!-- Area filter -->
	<div class="px-5 pb-[8px] flex flex-col gap-[5px] border-t border-[#f3f4f6] pt-[8px]">
		<div class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Filter by Area</div>
		<div class="flex flex-wrap gap-1">
			<button
				class="cursor-pointer rounded-[12px] border-[1.5px] px-[10px] py-[3px] text-[11px] font-medium whitespace-nowrap transition-all duration-150
					{leaderboardState.selectedAreaId === null
					? 'border-[#80d8d7] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
					: 'border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a]'}"
				onclick={() => selectArea(null)}>All</button>
			{#each appState.taxonomy?.areas ?? [] as area (area.id)}
				<button
					class="cursor-pointer rounded-[12px] border-[1.5px] px-[10px] py-[3px] text-[11px] font-medium whitespace-nowrap transition-all duration-150
						{leaderboardState.selectedAreaId === area.id
						? 'border-[#80d8d7] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
						: 'border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a]'}"
					onclick={() => selectArea(area.id)}>{area.name}</button>
			{/each}
		</div>
	</div>
</div>

<!-- Subarea filter -->
{#if leaderboardState.selectedAreaId}
	{@const area = appState.taxonomy?.areas.find((a) => a.id === leaderboardState.selectedAreaId)}
	{#if area && area.subareas.length}
		<div class="flex flex-wrap gap-1 border-b border-[#f3f4f6] bg-[#f0fafa] px-5 py-1.5">
			<button
				class="cursor-pointer rounded-[10px] border px-[9px] py-[3px] text-[11px] font-medium whitespace-nowrap transition-all duration-150
					{leaderboardState.selectedSubareaId === null
					? 'border-[#00b3b0] bg-[#00b3b0] font-semibold text-white'
					: 'border-[#80d8d7] bg-white text-[#00b3b0] hover:bg-[#e0f7f7]'}"
				onclick={() => selectSubarea(null)}>All</button
			>
			{#each area.subareas as sub (sub.id)}
				<button
					class="cursor-pointer rounded-[10px] border px-[9px] py-[3px] text-[11px] font-medium whitespace-nowrap transition-all duration-150
						{leaderboardState.selectedSubareaId === sub.id
						? 'border-[#00b3b0] bg-[#00b3b0] font-semibold text-white'
						: 'border-[#80d8d7] bg-white text-[#00b3b0] hover:bg-[#e0f7f7]'}"
					onclick={() => selectSubarea(sub.id)}>{sub.name}</button
				>
			{/each}
		</div>
	{/if}
{/if}

<!-- Rankings list -->
<div class="flex-1 overflow-y-auto py-[6px] pb-0">
	{#if isSmartMode}
		<div
			class="mx-3 my-2.5 rounded-[8px] bg-[#e0f7f7] px-[10px] py-2 text-center text-[11px] font-semibold tracking-[0.06em] text-[#00b3b0] uppercase"
		>
			<i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Smart Rankings — Your Focus Areas
		</div>
		{#each leaderboardState.smartRanked as entry, idx (entry.id)}
			{@const rank = idx + 1}
			{@const pct = Math.round(entry.score * 100)}
			{@const cls = entry.score > 0.55 ? 'positive' : entry.score < 0.45 ? 'negative' : 'neutral'}
			<button
				class="flex w-full cursor-pointer items-center gap-[8px] border-l-[3px] px-[14px] py-[8px] text-left transition-colors duration-150
					{appState.filters.model === entry.id
					? 'border-l-[#00b3b0] bg-[#e0f7f7]'
					: 'border-l-transparent hover:bg-[#f3f4f6]'}"
				onclick={() => selectModel(entry.id)}
			>
				<span
					class="w-5 flex-shrink-0 text-center text-[13px] font-bold {rank <= 3
						? 'text-[#f59e0b]'
						: 'text-[#9ca3af]'}">{rank}</span
				>
				<div class="min-w-0 flex-1">
					<div class="truncate text-[13px] font-semibold text-[#1a1a1a]">{entry.name}</div>
					<div class="text-[11px] text-[#9ca3af]">{entry.provider}</div>
				</div>
				<div class="flex w-[90px] flex-shrink-0 items-center gap-1">
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-[#f3f4f6]">
						<div
							class="h-full rounded-full"
							class:bg-green-500={cls === 'positive'}
							class:bg-red-500={cls === 'negative'}
							class:bg-gray-400={cls === 'neutral'}
							style="width:{pct}%"
						></div>
					</div>
					<span class="w-10 text-right text-[12px] font-bold text-[#6b7280]"
						>{entry.score.toFixed(2)}</span
					>
				</div>
			</button>
		{/each}
	{:else}
		{#each ranked as { model, split }, idx (model.id)}
			{@const rank = idx + 1}
			{@const posPct = Math.round(split.pos * 100)}
			{@const negPct = Math.round((1 - split.neg) * 100)}
			<button
				class="flex w-full cursor-pointer items-center gap-2 border-l-[3px] px-[14px] py-2 text-left transition-colors duration-150
					{appState.filters.model === model.id
					? 'border-l-[#00b3b0] bg-[#e0f7f7]'
					: 'border-l-transparent hover:bg-[#f3f4f6]'}"
				onclick={() => selectModel(model.id)}
			>
				<span
					class="w-5 flex-shrink-0 text-center text-[13px] font-bold {rank <= 3
						? 'text-[#f59e0b]'
						: 'text-[#9ca3af]'}">{rank}</span
				>
				<div class="min-w-0 flex-1 pr-2">
					<div class="truncate text-[13px] font-semibold text-[#1a1a1a]">{model.name}</div>
					<div class="text-[11px] text-[#9ca3af]">{model.provider}</div>
				</div>
				<!-- Split pos/neg bar -->
				<div
					class="flex h-2 w-[90px] flex-shrink-0 items-center overflow-hidden rounded-full bg-[#f3f4f6]"
					title="Harm avoidance: {formatScore(split.neg)} | Promotes good: {formatScore(split.pos)}"
				>
					<!-- Negative half: fills from right toward center -->
					<div
						class="flex h-full flex-1 items-center justify-end overflow-hidden rounded-l-full bg-[#fee2e2]"
					>
						<div
							class="h-full rounded-l-full bg-gradient-to-l from-[#f87171] to-[#dc2626]"
							style="width:{negPct}%"
						></div>
					</div>
					<!-- Center divider -->
					<div class="h-full w-[2px] flex-shrink-0 bg-white"></div>
					<!-- Positive half: fills from left toward right -->
					<div
						class="flex h-full flex-1 items-center justify-start overflow-hidden rounded-r-full bg-[#dcfce7]"
					>
						<div
							class="h-full rounded-r-full bg-gradient-to-r from-[#4ade80] to-[#16a34a]"
							style="width:{posPct}%"
						></div>
					</div>
				</div>
				<span class="w-10 text-right text-[12px] font-bold text-[#6b7280]"
					>{formatScore(split.avg)}</span
				>
			</button>
		{/each}
	{/if}
</div>
