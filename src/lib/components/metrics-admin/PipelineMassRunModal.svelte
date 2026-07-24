<script lang="ts">
	// Real counterpart to MassActionModal for "Generate Scenarios" — runs the
	// actual bench-py pipeline once per distinct benchmark represented in the
	// selection (a benchmark run always covers every metric in it with seed
	// scenarios, same as the single-metric button — see PipelineRunModal),
	// sequentially rather than in parallel, so a big multi-benchmark
	// selection doesn't fire off several real, paid runs at once. Only used
	// when the bridge is available; MassActionModal still covers "Run Test
	// Simulation" and the no-bridge fallback.

	import { startScenarioGeneration, pollPipelineJob } from '$lib/metrics-admin/pipeline';

	export interface BenchmarkGroup {
		slug: string;
		name: string;
		metricIds: string[];
	}

	type RowStatus = 'pending' | 'running' | 'done' | 'error';

	interface Props {
		open: boolean;
		groups: BenchmarkGroup[];
		adminKey: string;
		onClose: () => void;
		/** Fires once, after every benchmark has finished (successfully or
		 * not) — before the user clicks Close. */
		onDone?: () => void;
	}

	let { open, groups, adminKey, onClose, onDone }: Props = $props();

	let rowStatus = $state<Record<string, RowStatus>>({});
	let rowError = $state<Record<string, string>>({});
	let rowScenarios = $state<Record<string, number>>({});
	let running = $state(false);
	let doneNotified = false;

	function sleep(ms: number) {
		return new Promise((r) => setTimeout(r, ms));
	}

	async function runOne(group: BenchmarkGroup) {
		rowStatus[group.slug] = 'running';
		try {
			const started = await startScenarioGeneration(adminKey, group.slug);
			for (;;) {
				await sleep(1500);
				const status = await pollPipelineJob(adminKey, started.job_id);
				if (status.status === 'done') {
					rowScenarios[group.slug] = status.scenarios_upserted ?? 0;
					rowStatus[group.slug] = 'done';
					return;
				}
				if (status.status === 'error') {
					rowError[group.slug] = status.error ?? 'Unknown error.';
					rowStatus[group.slug] = 'error';
					return;
				}
			}
		} catch (e) {
			rowError[group.slug] = e instanceof Error ? e.message : String(e);
			rowStatus[group.slug] = 'error';
		}
	}

	async function runAll() {
		running = true;
		doneNotified = false;
		rowStatus = Object.fromEntries(groups.map((g) => [g.slug, 'pending']));
		rowError = {};
		rowScenarios = {};
		for (const group of groups) {
			await runOne(group);
		}
		running = false;
		if (!doneNotified) {
			doneNotified = true;
			onDone?.();
		}
	}

	const allDone = $derived(
		groups.length > 0 && groups.every((g) => rowStatus[g.slug] === 'done' || rowStatus[g.slug] === 'error')
	);

	$effect(() => {
		if (open) runAll();
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-6">
		<div
			class="flex max-h-[80vh] w-full max-w-[480px] flex-col rounded-[16px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_32px_rgba(15,23,42,0.15)]"
		>
			<div class="mb-3 flex items-center gap-2">
				<i class="fa-solid fa-layer-group text-[#00b3b0]"></i>
				<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
					{allDone ? 'Scenario generation complete' : 'Generating scenarios'}
				</h2>
				<span class="rounded-full bg-[#e0f7f7] px-2 py-[1px] text-[9px] font-bold text-[#038d8f]"
					>Real run</span
				>
			</div>
			<p class="mb-3 text-[11px] leading-[1.6] text-[#9ca3af]">
				Runs the real bench-py pipeline once per benchmark below — each run covers every metric in
				that benchmark with submitted seed scenarios, not just the ones you selected.
			</p>

			{#if groups.length === 0}
				<div
					class="mb-2 rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-3 text-[12px] text-[#9ca3af]"
				>
					No eligible metrics were selected.
				</div>
			{:else}
				<div class="flex-1 space-y-1.5 overflow-y-auto">
					{#each groups as group (group.slug)}
						{@const status = rowStatus[group.slug] ?? 'pending'}
						<div class="rounded-[8px] border border-[#f3f4f6] px-3 py-2">
							<div class="flex items-center gap-2.5">
								<span
									class="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[8px]"
									style={status === 'done'
										? 'background:#dcfce7;color:#16a34a'
										: status === 'error'
											? 'background:#fee2e2;color:#dc2626'
											: status === 'running'
												? 'background:#e0f7f7;color:#00b3b0'
												: 'background:#f3f4f6;color:#c4c9d1'}
								>
									{#if status === 'done'}
										<i class="fa-solid fa-check"></i>
									{:else if status === 'error'}
										<i class="fa-solid fa-xmark"></i>
									{:else if status === 'running'}
										<i class="fa-solid fa-spinner fa-spin"></i>
									{/if}
								</span>
								<span
									class="truncate text-[12px] font-medium {status === 'pending'
										? 'text-[#c4c9d1]'
										: 'text-[#1a1a1a]'}">{group.name}</span
								>
								<span class="ml-auto flex-shrink-0 text-[10px] text-[#9ca3af]"
									>{group.metricIds.length} selected</span
								>
							</div>
							{#if status === 'done'}
								<p class="mt-1 pl-[26px] text-[11px] text-[#16a34a]">
									{rowScenarios[group.slug] ?? 0} scenarios synced.
								</p>
							{:else if status === 'error'}
								<p class="mt-1 pl-[26px] text-[11px] font-medium text-[#dc2626]">
									{rowError[group.slug]}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-5 flex flex-shrink-0 justify-end">
				<button
					class="rounded-[8px] border border-[#e5e7eb] px-4 py-[7px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af] disabled:opacity-40"
					disabled={running}
					onclick={onClose}
				>
					{running ? 'Running…' : 'Close'}
				</button>
			</div>
		</div>
	</div>
{/if}
