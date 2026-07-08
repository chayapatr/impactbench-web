<script lang="ts">
	interface Props {
		label: string;
		onclick: () => void;
	}

	let { label, onclick }: Props = $props();
</script>

<button
	class="flex max-w-full min-w-0 cursor-pointer items-center gap-[5px] rounded-[6px] border-[1.5px] border-[#e5e7eb] px-[10px] py-[4px] text-[12px] font-semibold text-[#6b7280] transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:bg-[#e0f7f7] hover:text-[#00b3b0]"
	{onclick}
>
	<i class="fa-solid fa-arrow-left flex-shrink-0 text-[10px]"></i>
	<span class="truncate">{label}</span>
</button>
