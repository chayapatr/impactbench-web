<script lang="ts">
	import BackButton from '$lib/components/atoms/BackButton.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		backLabel: string;
		onBack: () => void;
		right?: Snippet;
		banner?: Snippet;
	}

	let { backLabel, onBack, right, banner }: Props = $props();
</script>

<div class="sticky top-0 z-10 border-b border-[#f3f4f6] bg-white">
	<div class="flex items-center justify-between gap-2 px-[14px] pt-[10px] pb-[8px]">
		<BackButton label={backLabel} onclick={onBack} />
		{#if right}
			{@render right()}
		{/if}
	</div>
	{#if banner}
		{@render banner()}
	{/if}
</div>
