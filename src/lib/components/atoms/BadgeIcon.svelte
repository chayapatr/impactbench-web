<script lang="ts">
	interface Props {
		type: 'pass' | 'fail' | 'empty';
		variant?: 'verdict' | 'metric';
	}

	let { type, variant = 'verdict' }: Props = $props();

	const isVerdict = variant === 'verdict';
</script>

{#if type === 'empty'}
	<span
		class="flex-shrink-0 rounded-full bg-[#f3f4f6]"
		class:h-[16px]={isVerdict}
		class:w-[16px]={isVerdict}
		class:h-[18px]={!isVerdict}
		class:w-[18px]={!isVerdict}
	></span>
{:else}
	<span
		class="inline-flex flex-shrink-0 items-center justify-center rounded-full leading-none font-[800]"
		class:h-[16px]={isVerdict}
		class:w-[16px]={isVerdict}
		class:text-[9px]={isVerdict}
		class:h-[18px]={!isVerdict}
		class:w-[18px]={!isVerdict}
		class:text-[11px]={!isVerdict}
		style={type === 'pass'
			? isVerdict ? 'background:#dcfce7;color:#16a34a' : 'background:#f3f4f6;color:#6b7280'
			: isVerdict ? 'background:#fee2e2;color:#dc2626' : 'background:#f3f4f6;color:#6b7280'}
	>
		{#if isVerdict}
			{type === 'pass' ? '✓' : '✗'}
		{:else}
			<i class="fa-solid {type === 'pass' ? 'fa-star' : 'fa-shield'}" style="font-size:8px"></i>
		{/if}
	</span>
{/if}
