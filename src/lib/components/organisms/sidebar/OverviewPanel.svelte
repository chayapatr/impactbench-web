<script lang="ts">
	import { appState, sidebarPush } from '$lib/store.svelte';
	import { scoreInterpretation } from '$lib/scores';
	import { computeAreaScore } from '$lib/utils';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import SectionLabel from '$lib/components/atoms/SectionLabel.svelte';
</script>

<SectionLabel text="Well-being Areas" />
<div class="flex flex-col gap-[6px] px-[14px] pb-1">
	{#each appState.taxonomy?.areas ?? [] as area (area.id)}
		{@const areaScore = computeAreaScore(appState, area.id)}
		{@const interp = scoreInterpretation(areaScore)}
		<button
			class="flex w-full cursor-pointer flex-col rounded-[10px] border-[1.5px] border-[#e5e7eb] bg-white px-4 py-[10px] text-left transition-[border-color] duration-150 hover:border-[#00b3b0]"
			onclick={() => sidebarPush({ type: 'area', areaId: area.id })}
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<i class="fa-solid {area.icon} flex-shrink-0 text-[15px]"></i>
					<span class="text-[13px] font-semibold text-[#1a1a1a]">{area.name}</span>
				</div>
				<ScorePill score={areaScore} />
			</div>
			<div class="mt-[5px] text-[11px] leading-[1.35] text-balance text-[#9ca3af]">
				{interp}
			</div>
		</button>
	{/each}
</div>

<SectionLabel text="Score Scale" />
<div class="flex flex-col gap-[6px] px-[14px] pb-4">
	{#each [{ pill: '−1', label: 'AI consistently harms this dimension', cls: 'negative' }, { pill: '0', label: 'No net effect on well-being', cls: 'neutral' }, { pill: '+1', label: 'AI consistently benefits this dimension', cls: 'positive' }] as row (row.cls)}
		<div class="flex items-center gap-2">
			<span
				class="inline-block min-w-[34px] flex-shrink-0 rounded-[12px] px-[9px] py-0.5 text-center text-[12px] font-semibold"
				class:bg-[#dcfce7]={row.cls === 'positive'}
				class:text-[#16a34a]={row.cls === 'positive'}
				class:bg-[#fee2e2]={row.cls === 'negative'}
				class:text-[#dc2626]={row.cls === 'negative'}
				class:bg-[#f3f4f6]={row.cls === 'neutral'}
				class:text-[#6b7280]={row.cls === 'neutral'}>{row.pill}</span
			>
			<span class="text-[12px] leading-[1.4] text-[#6b7280]">{row.label}</span>
		</div>
	{/each}
</div>
