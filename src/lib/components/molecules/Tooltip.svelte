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
	<div
		class="fixed z-[2000] pointer-events-none max-w-[260px] rounded-[10px] bg-[#1a1a1a] text-white shadow-[0_10px_30px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] px-[14px] py-[12px] text-[13px] leading-[1.5]"
		style="left:{d.x}px;top:{d.y}px"
	>
		{#if tooltipState.gateMode}
			<!-- Gate mode: describe the area/subarea, no scores -->
			{#if d.type === 'area'}
				{@const desc = AREA_DESCRIPTIONS[d.id] ?? ''}
				{@const subareas = (d.children ?? []).slice(0, 4)}
				<div class="text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase mb-[5px]">Well-being area</div>
				<div class="text-[16px] font-[700] text-white leading-[1.2] mb-[6px]" style="font-family:'Source Serif Pro',Georgia,serif">{d.name}</div>
				{#if desc}<div class="text-[11.5px] text-[#d1d5db] leading-relaxed mb-[8px]">{desc}</div>{/if}
				{#if subareas.length}
					<div class="text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase mb-[5px]">Includes</div>
					<div class="flex flex-wrap gap-[4px_6px]">
						{#each subareas as sub (sub.id)}
							<span class="inline-block rounded-[10px] bg-white/10 px-[9px] py-[3px] text-[11px] text-[#e5e7eb]">{sub.name}</span>
						{/each}
					</div>
				{/if}
			{:else if d.type === 'subarea'}
				{@const desc = SUBAREA_DESCRIPTIONS[d.id] ?? ''}
				<div class="text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase mb-[5px]">Behavioral sub-area</div>
				<div class="text-[16px] font-[700] text-white leading-[1.2] mb-[6px]" style="font-family:'Source Serif Pro',Georgia,serif">{d.name}</div>
				{#if desc}<div class="text-[11.5px] text-[#d1d5db] leading-relaxed">{desc}</div>{/if}
			{:else if d.type === 'metric'}
				<div class="text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase mb-[5px]">Behavioral metric</div>
				<div class="text-[14px] font-[600] text-white leading-[1.3] mb-[5px]">{d.name}</div>
				<div class="text-[11px] text-[#9ca3af]">
					<i class="fa-solid {d.behavior_type === 'restrain_harm' ? 'fa-shield' : 'fa-star'} mr-1"></i>{d.behavior_type === 'restrain_harm' ? 'Harm restraint' : 'Flourishing'}
				</div>
			{/if}
		{:else}
			<!-- Explore mode: show scores -->
			{@const scoreClass = scoreToClass(d.score)}
			{@const scoreStr = formatScore(d.score)}
			{@const pct = Math.round(d.score * 100)}
			<div class="font-bold text-[13px] text-white mb-1">{d.name}</div>
			<div
				class="text-[15px] font-bold mb-1"
				class:text-[#4ade80]={scoreClass === 'positive'}
				class:text-[#f87171]={scoreClass === 'negative'}
				class:text-[#d1d5db]={scoreClass === 'neutral'}
			>
				{scoreStr}
			</div>
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
					<i class="fa-solid {d.behavior_type === 'restrain_harm' ? 'fa-shield' : 'fa-star'} mr-1"></i>{d.behavior_type === 'restrain_harm' ? 'Harm restraint' : 'Flourishing'}
				</div>
			{/if}
		{/if}
	</div>
{/if}
