<script lang="ts">
	import { tooltipState } from '$lib/store.svelte';
	import { scoreToClass, formatScore } from '$lib/scores';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import { metricBadge } from '$lib/utils';

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
		class="pointer-events-none fixed z-[2000] max-w-[260px] rounded-[10px] bg-[#1a1a1a] px-[14px] py-[12px] text-[13px] leading-[1.5] text-white shadow-[0_10px_30px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)]"
		style="left:{d.x}px;top:{d.y}px"
	>
		{#if tooltipState.gateMode}
			<!-- Gate mode: describe the area/subarea, no scores -->
			{#if d.type === 'area'}
				{@const desc = AREA_DESCRIPTIONS[d.id] ?? ''}
				{@const subareas = (d.children ?? []).slice(0, 4)}
				<div class="mb-[5px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
					Well-being area
				</div>
				<div
					class="mb-[6px] text-[16px] leading-[1.2] font-[700] text-white"
					style="font-family:'Source Serif Pro',Georgia,serif"
				>
					{d.name}
				</div>
				{#if desc}<div class="mb-[8px] text-[11.5px] leading-relaxed text-[#d1d5db]">
						{desc}
					</div>{/if}
				{#if subareas.length}
					<div
						class="mb-[5px] text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
					>
						Includes
					</div>
					<div class="flex flex-wrap gap-[4px_6px]">
						{#each subareas as sub (sub.id)}
							<span
								class="inline-block rounded-[10px] bg-white/10 px-[9px] py-[3px] text-[11px] text-[#e5e7eb]"
								>{sub.name}</span
							>
						{/each}
					</div>
				{/if}
			{:else if d.type === 'subarea'}
				{@const desc = SUBAREA_DESCRIPTIONS[d.id] ?? ''}
				<div class="mb-[5px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
					Behavioral sub-area
				</div>
				<div
					class="mb-[6px] text-[16px] leading-[1.2] font-[700] text-white"
					style="font-family:'Source Serif Pro',Georgia,serif"
				>
					{d.name}
				</div>
				{#if desc}<div class="text-[11.5px] leading-relaxed text-[#d1d5db]">{desc}</div>{/if}
			{:else if d.type === 'metric'}
				{@const badge = metricBadge(d.metricType)}
				<div class="mb-[5px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
					Behavioral metric
				</div>
				<div class="mb-[5px] text-[14px] leading-[1.3] font-[600] text-white">{d.name}</div>
				<div class="text-[11px] text-[#9ca3af]">
					<i class="fa-solid {badge.icon} mr-1"></i>{badge.label}
				</div>
			{/if}
		{:else}
			<!-- Explore mode: show scores -->
			{@const scoreClass = scoreToClass(d.score)}
			{@const scoreStr = formatScore(d.score)}
			{@const pct = Math.round(d.score * 100)}
			<div class="mb-1 text-[13px] font-bold text-white">{d.name}</div>
			<div
				class="mb-1 text-[15px] font-bold"
				class:text-[#4ade80]={scoreClass === 'positive'}
				class:text-[#f87171]={scoreClass === 'negative'}
				class:text-[#d1d5db]={scoreClass === 'neutral'}
			>
				{scoreStr}
			</div>
			<div class="mt-1 mb-0.5 h-[5px] w-full overflow-hidden rounded-[3px] bg-white/15">
				<div
					class="h-full rounded-[3px] transition-[width] duration-300"
					class:bg-[#4ade80]={scoreClass === 'positive'}
					class:bg-[#f87171]={scoreClass === 'negative'}
					class:bg-[#9ca3af]={scoreClass === 'neutral'}
					style="width:{pct}%"
				></div>
			</div>
			<div class="mt-0.5 mb-1 text-[11px] tracking-wide text-[#9ca3af] uppercase">{d.type}</div>
			{#if d.type === 'area'}
				{@const desc = AREA_DESCRIPTIONS[d.id] ?? ''}
				{#if desc}<div
						class="mt-1 mb-2 border-t border-white/10 pt-1 text-[11px] leading-relaxed text-[#d1d5db]"
					>
						{desc}
					</div>{/if}
				{#if d.children}
					{@const allMetrics = d.children.flatMap(
						(s) => (s as { children?: { score?: number }[] }).children ?? []
					)}
					{#if allMetrics.length}
						{@const bd = metricBreakdown(allMetrics)}
						<div class="mb-1 flex h-1.5 gap-px overflow-hidden rounded-[3px]">
							{#if bd.passPct > 0}<div class="bg-[#4ade80]" style="width:{bd.passPct}%"></div>{/if}
							{#if bd.neutPct > 0}<div class="bg-[#6b7280]" style="width:{bd.neutPct}%"></div>{/if}
							{#if bd.failPct > 0}<div class="bg-[#f87171]" style="width:{bd.failPct}%"></div>{/if}
						</div>
						<div class="flex flex-wrap gap-2 text-[11px] text-[#d1d5db]">
							{#if bd.passing > 0}<span class="text-[#4ade80]">{bd.passing} passing</span>{/if}
							{#if bd.neutral > 0}<span>{bd.neutral} neutral</span>{/if}
							{#if bd.failing > 0}<span class="text-[#f87171]">{bd.failing} failing</span>{/if}
							<span class="text-[#6b7280]">({bd.total} metrics)</span>
						</div>
					{/if}
				{/if}
			{:else if d.type === 'subarea'}
				{@const desc = SUBAREA_DESCRIPTIONS[d.id] ?? ''}
				{#if desc}<div
						class="mt-1 mb-2 border-t border-white/10 pt-1 text-[11px] leading-relaxed text-[#d1d5db]"
					>
						{desc}
					</div>{/if}
				{#if d.children && d.children.length}
					{@const bd = metricBreakdown(d.children)}
					<div class="mb-1 flex h-1.5 gap-px overflow-hidden rounded-[3px]">
						{#if bd.passPct > 0}<div class="bg-[#4ade80]" style="width:{bd.passPct}%"></div>{/if}
						{#if bd.neutPct > 0}<div class="bg-[#6b7280]" style="width:{bd.neutPct}%"></div>{/if}
						{#if bd.failPct > 0}<div class="bg-[#f87171]" style="width:{bd.failPct}%"></div>{/if}
					</div>
					<div class="text-[11px] text-[#d1d5db]">
						{bd.passing} passing · {bd.neutral} neutral · {bd.failing} failing ({bd.total} metrics)
					</div>
				{/if}
			{:else if d.type === 'metric'}
				{@const badge = metricBadge(d.metricType)}
				<div class="text-[11px] text-[#9ca3af]">
					<i class="fa-solid {badge.icon} mr-1"></i>{badge.label}
				</div>
			{/if}
		{/if}
	</div>
{/if}
