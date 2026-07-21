<script lang="ts">
	import { appState, sidebarPush } from '$lib/store.svelte';
	import { computeAreaScore, areaPassFraction } from '$lib/utils';
	import { scoreShortGrade } from '$lib/scores';
	import { AREA_DESCRIPTIONS } from '$lib/descriptions';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import SectionLabel from '$lib/components/atoms/SectionLabel.svelte';
</script>

<SectionLabel text="Well-being Areas" />
<div class="flex flex-col gap-[8px] px-[14px] pb-4">
	{#each appState.taxonomy?.areas ?? [] as area (area.id)}
		{@const areaScore = computeAreaScore(appState, area.id)}
		{@const areaFrac = areaPassFraction(appState, area.id)}
		{@const areaDesc = AREA_DESCRIPTIONS[area.id] ?? ''}
		{@const grade = scoreShortGrade(areaScore)}
		<button
			class="flex w-full cursor-pointer flex-col rounded-[10px] bg-white px-4 py-[14px] text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-px"
			style="box-shadow: 0 1px 4px rgba(0,0,0,0.10);"
			onclick={() => sidebarPush({ type: 'area', areaId: area.id })}
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-[13px] font-semibold text-[#1a1a1a]">{area.name}</span>
				<ScorePill score={areaScore} total={areaFrac.total} neutral />
			</div>
			{#if areaDesc}
				<div class="mt-[3px] text-[12px] leading-[1.45] text-balance text-[#6b7280]">
					{areaDesc}
				</div>
			{/if}
			<div class="mt-[6px] text-[11px] font-medium text-[#9ca3af]">
				{grade}
			</div>
		</button>
	{/each}
</div>
