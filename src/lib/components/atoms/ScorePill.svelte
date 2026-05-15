<script lang="ts">
	import { formatScore, scorePillStyle } from '$lib/scores';

	interface Props {
		score: number;
		size?: 'sm' | 'md';
	}

	let { score, size = 'md' }: Props = $props();
</script>

<span
	class="inline-block flex-shrink-0 rounded-[6px] py-[1px] text-center font-semibold
		{size === 'sm' ? 'px-[5px] text-[10px] min-w-[26px]' : 'px-[6px] text-[11px] min-w-[30px]'}"
	style={scorePillStyle(score)}
>{formatScore(score)}</span>
