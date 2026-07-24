<script lang="ts">
	import type { Metric } from '$lib/metrics-admin/types';

	// DEMO ONLY. The diff below is a hand-written example, not a real
	// comparison against what's live on R2 — that needs a publish RPC that
	// projects metrics/scenarios into the same 6 data.json files
	// impactbench-data's tools/publish.py builds today (see backend gaps).
	// Publish doesn't upload anything.

	interface Props {
		open: boolean;
		metric: Metric;
		benchmarkName: string;
		onClose: () => void;
	}

	let { open, metric, benchmarkName, onClose }: Props = $props();

	let publishing = $state(false);
	let publishedNote = $state('');

	async function publish() {
		publishing = true;
		publishedNote = '';
		await new Promise((r) => setTimeout(r, 800));
		publishing = false;
		publishedNote =
			'Demo only — nothing was uploaded to R2. Needs a publish RPC + projection query.';
	}
</script>

{#if open}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-6">
		<div
			class="flex max-h-[80vh] w-full max-w-[560px] flex-col rounded-[16px] border border-[#e5e7eb] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.15)]"
		>
			<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 py-4">
				<div class="flex items-center gap-2">
					<i class="fa-solid fa-code-compare text-[#00b3b0]"></i>
					<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
						Publish preview — {benchmarkName}
					</h2>
				</div>
				<p class="mt-1 text-[11px] text-[#9ca3af]">Example diff, not computed from real data.</p>
			</div>

			<div class="flex-1 overflow-y-auto px-6 py-4">
				<pre class="overflow-x-auto rounded-[8px] bg-[#0d1117] p-3 text-[11px] leading-[1.6]"><code
						><span class="text-[#7ee787]">+ "metrics.{metric.id}"</span>: {'{'}
  <span class="text-[#7ee787]">+ "name"</span>: "{metric.name}",
  <span class="text-[#7ee787]">+ "type"</span>: "{metric.type}",
  <span class="text-[#7ee787]">+ "content_hash"</span>: "{metric.content_hash.slice(0, 12)}…"
}
<span class="text-[#8b949e]">  "scenario-index.json"</span>: <span class="text-[#8b949e]"
							>unchanged (0 rows affected)</span
						></code
					></pre>
			</div>

			{#if publishedNote}
				<div
					class="mx-6 mb-3 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[11px] text-[#6b7280]"
				>
					{publishedNote}
				</div>
			{/if}

			<div class="flex flex-shrink-0 justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
				<button
					class="rounded-[8px] border border-[#e5e7eb] px-4 py-[7px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af]"
					onclick={onClose}>Close</button
				>
				<button
					class="rounded-[8px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[7px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter] hover:brightness-105 disabled:opacity-60"
					disabled={publishing}
					onclick={publish}
				>
					{#if publishing}<i class="fa-solid fa-spinner fa-spin"></i> Publishing…{:else}Publish to
						R2{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
