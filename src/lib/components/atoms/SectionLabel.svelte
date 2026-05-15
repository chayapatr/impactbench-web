<script lang="ts">
	interface Props {
		text: string;
		spacing?: 'normal' | 'compact';
	}

	let { text, spacing = 'normal' }: Props = $props();
</script>

<div
	class="flex items-center justify-between gap-2 px-[14px] pt-[10px] pb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
	class:mt-4={spacing === 'normal'}
	class:mt-3={spacing === 'compact'}
>
	{text}
</div>
