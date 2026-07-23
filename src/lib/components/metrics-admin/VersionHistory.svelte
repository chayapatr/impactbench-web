<script lang="ts">
	import type { MetricVersion } from '$lib/metrics-admin/types';

	// The current version entry is real. Every metric today has exactly one
	// version — nothing has created a second yet, since that needs the
	// update_metric_draft RPC (see backend gaps) — so a second, illustrative
	// entry is shown to demonstrate what the timeline looks like once edits
	// exist. It's visually distinguished (dashed border, "(illustrative)")
	// rather than presented as real history.

	interface Props {
		current: MetricVersion;
	}

	let { current }: Props = $props();
</script>

<div class="mb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
	Version history
</div>
<ul class="mb-5 space-y-2">
	<li class="flex items-start gap-3 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-[8px]">
		<span
			class="mt-[2px] flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#e0f7f7] text-[9px] font-bold text-[#00b3b0]"
			>v{current.version_number}</span
		>
		<div class="min-w-0 flex-1">
			<div class="text-[12px] font-medium text-[#1a1a1a]">Current</div>
			<div class="text-[10px] text-[#9ca3af]">
				{new Date(current.created_at).toLocaleString()}
				{#if current.created_by}· {current.created_by}{/if}
			</div>
		</div>
	</li>
	<li
		class="flex items-start gap-3 rounded-[8px] border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-3 py-[8px] opacity-70"
	>
		<span
			class="mt-[2px] flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[9px] font-bold text-[#9ca3af]"
			>v{current.version_number + 1}</span
		>
		<div class="min-w-0 flex-1">
			<div class="text-[12px] font-medium text-[#6b7280]">
				Example future edit <span class="font-normal">(illustrative)</span>
			</div>
			<div class="text-[10px] text-[#9ca3af]">
				This is where the next edit will appear once update_metric_draft exists.
			</div>
		</div>
	</li>
</ul>
