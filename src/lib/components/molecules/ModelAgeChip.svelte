<script lang="ts">
	interface Props {
		modelName: string;
		age?: string | null;
	}

	let { modelName, age = null }: Props = $props();
</script>

<div class="flex flex-shrink-0 items-center gap-[5px]">
	<span class="max-w-[100px] truncate text-[11px] font-semibold text-[#6b7280]">{modelName}</span>
	{#if age}
		<span
			class="rounded-[5px] border border-[#d1d5db] px-[5px] py-[1px] text-[10px] font-medium text-[#6b7280]"
		>
			{age === 'adult' ? '18+' : '6–17'}
		</span>
	{/if}
</div>
