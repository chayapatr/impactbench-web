<script lang="ts">
	import { tooltipState } from '$lib/store.svelte';
	import { scoreToClass, formatScore } from '$lib/scores';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';

	function metricBreakdown(children: { score?: number; children?: { score?: number }[] }[]) {
		const total = children.length;
		const passing = children.filter((m) => (m.score ?? 0) >= 0.55).length;
		const failing = children.filter((m) => (m.score ?? 0) < 0.45).length;
		const neutral = total - passing - failing;
		return {
			total,
			passing,
			failing,
			neutral,
			passPct: Math.round((passing / total) * 100),
			failPct: Math.round((failing / total) * 100),
			neutPct: 100 - Math.round((passing / total) * 100) - Math.round((failing / total) * 100)
		};
	}
</script>

{#if tooltipState.visible && tooltipState.data}
	{@const d = tooltipState.data}
	{@const scoreClass = scoreToClass(d.score)}
	{@const scoreStr = formatScore(d.score)}
	{@const pct = Math.round(d.score * 100)}
	<div
		class="fixed z-[2000] pointer-events-none max-w-[240px] rounded-[10px] bg-[#1a1a1a] text-white shadow-[0_10px_30px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] px-[14px] py-[10px] text-[13px] leading-[1.5]"
		style="left:{d.x}px;top:{d.y}px"
	>
		<div class="font-bold text-[13px] text-white mb-1">{d.name}</div>
		<div
			class="text-[15px] font-bold mb-1"
			class:text-[#4ade80]={scoreClass === 'positive'}
			class:text-[#f87171]={scoreClass === 'negative'}
			class:text-[#d1d5db]={scoreClass === 'neutral'}
		>
			{scoreStr}
		</div>

		<!-- Score bar -->
		<div class="w-full h-[5px] bg-white/15 rounded-[3px] overflow-hidden mb-0.5 mt-1">
			<div
				class="h-full rounded-[3px] transition-[width] duration-300"
				class:bg-[#4ade80]={scoreClass === 'positive'}
				class:bg-[#f87171]={scoreClass === 'negative'}
				class:bg-[#9ca3af]={scoreClass === 'neutral'}
				style="width:{pct}%"
			></div>
		</div>

		<div class="text-[11px] text-[#9ca3af] mt-0.5 mb-1 uppercase tracking-wide">{d.type}</div>

		{#if d.type === 'area'}
			{@const desc = AREA_DESCRIPTIONS[d.id] ?? ''}
			{#if desc}<div class="text-[11px] text-[#d1d5db] mb-2 leading-relaxed border-t border-white/10 pt-1 mt-1">{desc}</div>{/if}
			{#if d.children}
				{@const allMetrics = d.children.flatMap((s) => (s as { children?: { score?: number }[] }).children ?? [])}
				{#if allMetrics.length}
					{@const bd = metricBreakdown(allMetrics)}
					<div class="flex h-1.5 rounded-[3px] overflow-hidden mb-1 gap-px">
						{#if bd.passPct > 0}<div class="bg-[#4ade80]" style="width:{bd.passPct}%"></div>{/if}
						{#if bd.neutPct > 0}<div class="bg-[#6b7280]" style="width:{bd.neutPct}%"></div>{/if}
						{#if bd.failPct > 0}<div class="bg-[#f87171]" style="width:{bd.failPct}%"></div>{/if}
					</div>
					<div class="text-[11px] text-[#d1d5db] flex gap-2 flex-wrap">
						{#if bd.passing > 0}<span class="text-[#4ade80]">{bd.passing} passing</span>{/if}
						{#if bd.neutral > 0}<span>{bd.neutral} neutral</span>{/if}
						{#if bd.failing > 0}<span class="text-[#f87171]">{bd.failing} failing</span>{/if}
						<span class="text-[#6b7280]">({bd.total} metrics)</span>
					</div>
				{/if}
			{/if}
		{:else if d.type === 'subarea'}
			{@const desc = SUBAREA_DESCRIPTIONS[d.id] ?? ''}
			{#if desc}<div class="text-[11px] text-[#d1d5db] mb-2 leading-relaxed border-t border-white/10 pt-1 mt-1">{desc}</div>{/if}
			{#if d.children && d.children.length}
				{@const bd = metricBreakdown(d.children)}
				<div class="flex h-1.5 rounded-[3px] overflow-hidden mb-1 gap-px">
					{#if bd.passPct > 0}<div class="bg-[#4ade80]" style="width:{bd.passPct}%"></div>{/if}
					{#if bd.neutPct > 0}<div class="bg-[#6b7280]" style="width:{bd.neutPct}%"></div>{/if}
					{#if bd.failPct > 0}<div class="bg-[#f87171]" style="width:{bd.failPct}%"></div>{/if}
				</div>
				<div class="text-[11px] text-[#d1d5db]">
					{bd.passing} passing · {bd.neutral} neutral · {bd.failing} failing ({bd.total} metrics)
				</div>
			{/if}
		{:else if d.type === 'metric'}
			<div class="text-[11px] text-[#9ca3af]">
				{d.harmful ? '↓ Harmful behaviour metric' : '↑ Beneficial behaviour metric'}
			</div>
		{/if}
	</div>
{/if}
