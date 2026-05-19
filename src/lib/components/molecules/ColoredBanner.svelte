<script lang="ts">
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import { scorePillColor } from '$lib/scores';
	import type { Snippet } from 'svelte';

	interface Props {
		color: string;
		background: string;
		border: string;
		breadcrumb?: string;
		icon?: string;
		title: string;
		score?: number | null;
		total?: number;
		children?: Snippet;
	}

	let { color, background, border, breadcrumb, icon, title, score = null, total, children }: Props = $props();
</script>

<div style="border-left: 5px solid {score !== null ? scorePillColor(score) : color}; background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 12px 16px;">
	{#if breadcrumb}
		<div class="mb-[4px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
			{breadcrumb} ›
		</div>
	{/if}
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center gap-2">
			{#if icon}
				<i class="fa-solid {icon} flex-shrink-0 text-[15px]"></i>
			{/if}
			<span class="min-w-0 flex-1 text-[15px] leading-[1.2] font-[700] tracking-[-0.02em] text-[#1a1a1a]">{title}</span>
			{#if score !== null}
				<ScorePill score={score} {total} />
			{/if}
		</div>
	{/if}
</div>
