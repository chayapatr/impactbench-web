<script lang="ts">
	// Staleness itself is real: a scenario is stale when its metric_version_id
	// no longer matches the metric's current_version_id (see the review that
	// led to metric_versions.content_hash). Every scenario in this database
	// happens to always be fresh today, since no edit has ever created a
	// second version yet — the `simulate` toggle below exists purely so this
	// state can be seen in the demo before real edits produce it.

	interface Props {
		staleCount: number;
		totalCount: number;
		simulated: boolean;
		onToggleSimulate: () => void;
		onRegenerate: () => void;
	}

	let { staleCount, totalCount, simulated, onToggleSimulate, onRegenerate }: Props = $props();
</script>

{#if totalCount > 0}
	{#if staleCount > 0}
		<div class="mb-4 flex items-center justify-between gap-3 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-[10px]">
			<div class="flex items-center gap-2">
				<i class="fa-solid fa-triangle-exclamation text-[12px] text-[#c2410c]"></i>
				<span class="text-[12px] font-medium text-[#c2410c]">
					{staleCount} of {totalCount} scenarios were generated from an earlier version of this definition.
					{#if simulated}<span class="font-normal opacity-70">(simulated for this demo)</span>{/if}
				</span>
			</div>
			<button
				class="flex-shrink-0 rounded-[6px] bg-[#c2410c] px-3 py-[5px] text-[11px] font-semibold text-white hover:brightness-105"
				onclick={onRegenerate}
			>
				<i class="fa-solid fa-arrows-rotate text-[9px]"></i> Regenerate
			</button>
		</div>
	{:else}
		<div class="mb-4 flex items-center justify-between gap-3 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-[8px]">
			<span class="text-[11px] text-[#9ca3af]">
				<i class="fa-solid fa-circle-check text-[#16a34a]"></i> All scenarios match the current definition.
			</span>
			<button
				class="flex-shrink-0 text-[10px] font-medium text-[#9ca3af] underline decoration-dotted hover:text-[#6b7280]"
				onclick={onToggleSimulate}
			>
				Demo: simulate an edit
			</button>
		</div>
	{/if}
{/if}
