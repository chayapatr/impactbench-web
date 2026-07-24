<script lang="ts">
	// Real counterpart to RegenerateModal's fake timer: starts an actual
	// bench-py subprocess via the /metrics-admin/api/pipeline/* routes and
	// polls for its status, showing the real stdout/stderr tail instead of a
	// simulated progress bar. Only used when the local pipeline bridge is
	// configured (see PipelineNotConfiguredError / checkPipelineHealth) —
	// otherwise the caller falls back to RegenerateModal's demo simulation.

	import { startScenarioGeneration, pollPipelineJob } from '$lib/metrics-admin/pipeline';

	interface Props {
		open: boolean;
		benchmarkSlug: string;
		benchmarkName: string;
		adminKey: string;
		seedTitles?: string[];
		onClose: () => void;
		/** Fires once, the moment the real run finishes successfully. */
		onDone?: () => void;
	}

	let { open, benchmarkSlug, benchmarkName, adminKey, seedTitles = [], onClose, onDone }: Props =
		$props();

	let phase = $state<'starting' | 'running' | 'done' | 'error'>('starting');
	let errorMessage = $state('');
	let logTail = $state('');
	let seedCount = $state(0);
	let metricCount = $state(0);
	let scenariosUpserted = $state(0);
	let poll: ReturnType<typeof setInterval> | undefined;
	let doneNotified = false;

	async function start() {
		phase = 'starting';
		errorMessage = '';
		logTail = '';
		doneNotified = false;
		try {
			const started = await startScenarioGeneration(adminKey, benchmarkSlug);
			metricCount = started.metric_count;
			seedCount = started.seed_count;
			phase = 'running';

			poll = setInterval(async () => {
				try {
					const status = await pollPipelineJob(adminKey, started.job_id);
					logTail = status.log_tail;
					if (status.status === 'done') {
						scenariosUpserted = status.scenarios_upserted ?? 0;
						phase = 'done';
						clearInterval(poll);
						if (!doneNotified) {
							doneNotified = true;
							onDone?.();
						}
					} else if (status.status === 'error') {
						errorMessage = status.error ?? 'Unknown error.';
						phase = 'error';
						clearInterval(poll);
					}
				} catch (e) {
					errorMessage = e instanceof Error ? e.message : String(e);
					phase = 'error';
					clearInterval(poll);
				}
			}, 1500);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
			phase = 'error';
		}
	}

	$effect(() => {
		if (open) start();
		return () => clearInterval(poll);
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-6">
		<div
			class="flex max-h-[80vh] w-full max-w-[520px] flex-col rounded-[16px] border border-[#e5e7eb] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.15)]"
		>
			<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 py-4">
				<div class="flex items-center gap-2">
					<i
						class="fa-solid {phase === 'error'
							? 'fa-triangle-exclamation text-[#dc2626]'
							: phase === 'done'
								? 'fa-circle-check text-[#16a34a]'
								: 'fa-wand-magic-sparkles text-[#00b3b0]'}"
					></i>
					<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
						{#if phase === 'error'}
							Run failed
						{:else if phase === 'done'}
							Scenarios generated
						{:else}
							Generating scenarios — {benchmarkName}
						{/if}
					</h2>
					<span class="rounded-full bg-[#e0f7f7] px-2 py-[1px] text-[9px] font-bold text-[#038d8f]"
						>Real run</span
					>
				</div>
				<p class="mt-1 text-[11px] text-[#9ca3af]">
					Runs <code>gen_scenarios_from_seeds</code> against the real bench-py pipeline for every metric
					in this benchmark ({metricCount || '…'} metrics, {seedCount || '…'} seed titles). Metrics
					with no submitted seed scenarios are skipped.
				</p>
			</div>

			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if seedTitles.length}
					<div class="mb-3 rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] p-2.5">
						<div class="mb-1.5 text-[9px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase">
							Seed input for this metric
						</div>
						<ul class="space-y-1">
							{#each seedTitles as t (t)}
								<li class="flex items-start gap-1.5 text-[11px] leading-[1.5] text-[#4b5563]">
									<i class="fa-solid fa-file-lines mt-[3px] flex-shrink-0 text-[8px] text-[#c4c9d1]"
									></i>
									<span class="truncate">{t}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if phase === 'starting'}
					<p class="flex items-center gap-2 text-[12px] text-[#9ca3af]">
						<i class="fa-solid fa-spinner fa-spin"></i> Syncing benchmark to the pipeline and starting…
					</p>
				{:else if phase === 'running'}
					<p class="mb-2 flex items-center gap-2 text-[12px] text-[#00b3b0]">
						<i class="fa-solid fa-spinner fa-spin"></i> Running…
					</p>
				{:else if phase === 'done'}
					<p class="mb-2 text-[12px] text-[#16a34a]">
						{scenariosUpserted} scenario{scenariosUpserted === 1 ? '' : 's'} synced back into Supabase.
					</p>
				{:else if phase === 'error'}
					<div
						class="mb-2 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]"
					>
						{errorMessage}
					</div>
				{/if}

				{#if logTail}
					<pre
						class="max-h-[220px] overflow-auto rounded-[8px] bg-[#0d1117] p-3 text-[10px] leading-[1.6] text-[#c9d1d9]">{logTail}</pre>
				{/if}
			</div>

			<div class="flex flex-shrink-0 justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4">
				{#if phase === 'error'}
					<button
						class="rounded-[8px] border border-[#e5e7eb] px-4 py-[7px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af]"
						onclick={start}
					>
						Retry
					</button>
				{/if}
				<button
					class="rounded-[8px] border border-[#e5e7eb] px-4 py-[7px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af] disabled:opacity-40"
					disabled={phase === 'starting' || phase === 'running'}
					onclick={onClose}
				>
					{phase === 'running' || phase === 'starting' ? 'Running…' : 'Close'}
				</button>
			</div>
		</div>
	</div>
{/if}
