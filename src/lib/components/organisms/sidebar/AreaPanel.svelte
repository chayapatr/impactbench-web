<script lang="ts">
	import { appState, sidebarBack, sidebarPush } from '$lib/store.svelte';
	import { scoreColors, scoreShortGrade } from '$lib/scores';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import {
		computeAreaScore,
		computeSubareaScore,
		areaPassFraction,
		subareaPassFraction
	} from '$lib/utils';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import SectionLabel from '$lib/components/atoms/SectionLabel.svelte';
	import StickyHeader from '$lib/components/molecules/StickyHeader.svelte';
	import ColoredBanner from '$lib/components/molecules/ColoredBanner.svelte';
	import ModelAgeChip from '$lib/components/molecules/ModelAgeChip.svelte';

	interface Props {
		areaId: string;
	}

	let { areaId }: Props = $props();

	const area = $derived(appState.taxonomy?.areas.find((a) => a.id === areaId));
	const areaScore = $derived(area ? computeAreaScore(appState, areaId) : 0);
	const areaFrac = $derived(areaPassFraction(appState, areaId));
	const areaColors = $derived(scoreColors(areaScore));
	const areaDesc = $derived(AREA_DESCRIPTIONS[areaId] ?? '');
</script>

{#if area}
	<!-- Description -->
	<div class="px-[14px] pt-[14px] pb-[12px]">
		{#if areaDesc}
			<div class="mb-[3px] text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
				Area Description
			</div>
			<p class="text-[12px] leading-[1.6] text-balance text-[#374151]">{areaDesc}</p>
		{/if}
	</div>

	<SectionLabel text="Subareas" />
	<div class="flex flex-col gap-[8px] px-[14px] pb-4">
		{#each area.subareas as sub (sub.id)}
			{@const subScore = computeSubareaScore(appState, sub.id)}
			{@const subFrac = subareaPassFraction(appState, sub.id)}
			{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
			{@const grade = scoreShortGrade(subScore)}
			<button
				class="flex w-full cursor-pointer flex-col rounded-[10px] bg-white px-4 py-[14px] text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-px"
				style="box-shadow: 0 1px 4px rgba(0,0,0,0.10);"
				onclick={() => sidebarPush({ type: 'subarea', subareaId: sub.id })}
			>
				<div class="flex items-center justify-between gap-2">
					<span class="truncate text-[13px] font-semibold text-[#1a1a1a]">{sub.name}</span>
					<ScorePill score={subScore} total={subFrac.total} neutral />
				</div>
				{#if subDesc}
					<div class="mt-[3px] text-[12px] leading-[1.45] text-balance text-[#6b7280]">
						{subDesc}
					</div>
				{/if}
				<div class="mt-[6px] text-[11px] font-medium text-[#9ca3af]">
					{grade}
				</div>
			</button>
		{/each}
	</div>
{/if}
