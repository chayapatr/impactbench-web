<script lang="ts">
	import { appState, sidebarPush } from '$lib/store.svelte';
	import { scoreInterpretation } from '$lib/scores';
	import { getScores } from '$lib/utils';
	import type { ThemeMetricItem, SmartTheme } from '$lib/store.svelte';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';

	interface Props {
		themes: SmartTheme[];
		userText?: string;
	}

	let { themes, userText }: Props = $props();

	const scores = $derived(getScores(appState));
</script>

<div
	class="mt-4 flex items-center justify-between gap-2 px-[14px] pt-[10px] pb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
>
	<span><i class="fa-solid fa-wand-magic-sparkles mr-1 text-[9px]"></i> Your Focus Areas</span>
</div>
{#if userText}
	<p class="truncate px-[14px] pb-2 text-[11px] leading-[1.4] text-[#9ca3af] italic">
		"{userText}"
	</p>
{/if}
<div class="flex flex-col gap-[6px] px-[14px] pb-4">
	{#each themes as theme (theme.name)}
		{@const themeMetrics: ThemeMetricItem[] = theme.metrics}
		{@const withScores = themeMetrics.filter((m) => scores[m.id] !== undefined)}
		{@const avgScore = withScores.length
			? withScores.reduce((s, m) => s + (scores[m.id] ?? 0), 0) / withScores.length
			: theme.avg_score}
		{@const interp = scoreInterpretation(avgScore)}
		<button
			class="flex w-full cursor-pointer flex-col rounded-[10px] border-[1.5px] border-[#e5e7eb] bg-white px-4 py-[10px] text-left transition-[border-color] duration-150 hover:border-[#00b3b0]"
			onclick={() =>
				sidebarPush({
					type: 'theme-metrics',
					themeName: theme.name,
					themeDesc: theme.description,
					metrics: themeMetrics
				})}
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<i class="fa-solid {theme.icon} flex-shrink-0 text-[15px]"></i>
					<span class="text-[13px] font-semibold text-[#1a1a1a]">{theme.name}</span>
				</div>
				<ScorePill score={avgScore} />
			</div>
			<div class="mt-[5px] text-[11px] leading-[1.35] text-balance text-[#9ca3af]">
				{interp}
			</div>
		</button>
	{/each}
</div>
