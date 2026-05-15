<script lang="ts">
	import { appState, sidebarBack, sidebarPush } from '$lib/store.svelte';
	import { scoreColors } from '$lib/scores';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import { getModelName, computeAreaScore, computeSubareaScore } from '$lib/utils';
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
	const areaColors = $derived(scoreColors(areaScore));
	const areaDesc = $derived(AREA_DESCRIPTIONS[areaId] ?? '');
</script>

{#if area}
	<StickyHeader backLabel="All Areas" onBack={sidebarBack}>
		{#snippet right()}
			<ModelAgeChip modelName={getModelName(appState)} age={appState.filters.age} />
		{/snippet}
		{#snippet banner()}
			<ColoredBanner color={areaColors.color} background={areaColors.light} border={areaColors.border} title={area.name} score={areaScore}>
				{#snippet children()}
					<div class="mb-[4px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">Well-being Area</div>
					<div class="flex items-center gap-2">
						<i class="fa-solid {area.icon} flex-shrink-0 text-[15px]"></i>
						<span class="min-w-0 flex-1 text-[15px] leading-[1.2] font-[800] tracking-[-0.02em] text-[#1a1a1a]">{area.name}</span>
						<ScorePill score={areaScore} />
					</div>
				{/snippet}
			</ColoredBanner>
		{/snippet}
	</StickyHeader>

	{#if areaDesc}
		<div class="px-[14px] pt-3 pb-2">
			<p class="text-[12px] leading-[1.6] text-balance text-[#6b7280]">{areaDesc}</p>
		</div>
	{/if}

	<SectionLabel text="Subareas" />
	<div class="flex flex-col gap-[6px] px-[14px] pb-4">
		{#each area.subareas as sub (sub.id)}
			{@const subScore = computeSubareaScore(appState, sub.id)}
			{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
			<button
				class="flex w-full cursor-pointer flex-col rounded-[10px] border-[1.5px] border-[#e5e7eb] bg-white px-4 py-[10px] text-left transition-[border-color] duration-150 hover:border-[#00b3b0]"
				onclick={() => sidebarPush({ type: 'subarea', subareaId: sub.id })}
			>
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<i class="fa-solid {sub.icon} flex-shrink-0 text-[15px]"></i>
						<span class="truncate text-[13px] font-semibold text-[#1a1a1a]">{sub.name}</span>
					</div>
					<ScorePill score={subScore} />
				</div>
				{#if subDesc}
					<div class="mt-[5px] text-[11px] leading-[1.35] text-balance text-[#9ca3af]">
						{subDesc}
					</div>
				{/if}
			</button>
		{/each}
	</div>
{/if}
