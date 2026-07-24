<script lang="ts">
	import type { GenerationRun } from '$lib/metrics-admin/types';

	// Entirely illustrative. generation_runs has zero rows today and is
	// intentionally locked down (no public-read policy, no admin-key RPC) —
	// this table shows the shape of what it would look like once a job
	// runner exists to actually write rows into it (see backend gaps).

	const exampleRuns: (GenerationRun & { metric_slug: string; model_label: string })[] = [
		{
			id: 'demo-1',
			metric_id: '',
			model_id: null,
			metric_slug: 'm04',
			model_label: '(all models)',
			phase: 'gen_scenarios',
			status: 'done',
			cost: 0.14,
			input_tokens: 3210,
			output_tokens: 980,
			error_message: null,
			started_at: null,
			finished_at: null,
			created_at: new Date().toISOString()
		},
		{
			id: 'demo-2',
			metric_id: '',
			model_id: null,
			metric_slug: 'm04',
			model_label: 'claude-haiku-4-5',
			phase: 'simulate',
			status: 'running',
			cost: 0.06,
			input_tokens: 1500,
			output_tokens: 640,
			error_message: null,
			started_at: null,
			finished_at: null,
			created_at: new Date().toISOString()
		},
		{
			id: 'demo-3',
			metric_id: '',
			model_id: null,
			metric_slug: 'm05',
			model_label: 'gpt-4o',
			phase: 'evaluate',
			status: 'error',
			cost: 0.02,
			input_tokens: 800,
			output_tokens: 120,
			error_message: 'Evaluator rate-limited after 3 retries',
			started_at: null,
			finished_at: null,
			created_at: new Date().toISOString()
		}
	];

	function statusStyle(status: GenerationRun['status']): string {
		if (status === 'done') return 'background:#dcfce7;color:#16a34a';
		if (status === 'running') return 'background:#e0f7f7;color:#038d8f';
		if (status === 'error') return 'background:#fee2e2;color:#dc2626';
		return 'background:#f3f4f6;color:#6b7280';
	}

	const totalCost = exampleRuns.reduce((sum, r) => sum + (r.cost ?? 0), 0);
</script>

<div class="mx-auto w-full max-w-[760px] px-6 py-8">
	<div class="mb-2 flex items-center gap-2">
		<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">Generation runs & cost</h2>
		<span class="rounded-full bg-[#fff7ed] px-2 py-[1px] text-[9px] font-bold text-[#c2410c]"
			>Illustrative</span
		>
	</div>
	<p class="mb-4 text-[11px] text-[#9ca3af]">
		Example rows — generation_runs is empty and admin-locked today; a job runner and a read RPC are
		both needed before this can show real data (see backend gaps).
	</p>

	<div class="mb-4 grid grid-cols-3 gap-3">
		<div class="rounded-[10px] border border-[#e5e7eb] p-3">
			<div class="text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
				Runs shown
			</div>
			<div class="mt-1 text-[18px] font-[800] text-[#1a1a1a]">{exampleRuns.length}</div>
		</div>
		<div class="rounded-[10px] border border-[#e5e7eb] p-3">
			<div class="text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
				Example cost
			</div>
			<div class="mt-1 text-[18px] font-[800] text-[#1a1a1a]">${totalCost.toFixed(2)}</div>
		</div>
		<div class="rounded-[10px] border border-[#e5e7eb] p-3">
			<div class="text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">Errors</div>
			<div class="mt-1 text-[18px] font-[800] text-[#dc2626]">
				{exampleRuns.filter((r) => r.status === 'error').length}
			</div>
		</div>
	</div>

	<div class="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
		<table class="w-full text-left text-[12px]">
			<thead>
				<tr
					class="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] tracking-[0.06em] text-[#9ca3af] uppercase"
				>
					<th class="px-4 py-[8px] font-semibold">Metric</th>
					<th class="px-4 py-[8px] font-semibold">Model</th>
					<th class="px-4 py-[8px] font-semibold">Phase</th>
					<th class="px-4 py-[8px] font-semibold">Status</th>
					<th class="px-4 py-[8px] font-semibold">Tokens</th>
					<th class="px-4 py-[8px] font-semibold">Cost</th>
				</tr>
			</thead>
			<tbody>
				{#each exampleRuns as run (run.id)}
					<tr class="border-b border-[#f3f4f6] last:border-0">
						<td class="px-4 py-[8px] font-medium text-[#1a1a1a]">{run.metric_slug}</td>
						<td class="px-4 py-[8px] text-[#6b7280]">{run.model_label}</td>
						<td class="px-4 py-[8px] text-[#6b7280]">{run.phase}</td>
						<td class="px-4 py-[8px]">
							<span
								class="rounded-full px-2 py-[1px] text-[10px] font-bold"
								style={statusStyle(run.status)}>{run.status}</span
							>
							{#if run.error_message}
								<div class="mt-[2px] text-[10px] text-[#dc2626]">{run.error_message}</div>
							{/if}
						</td>
						<td class="px-4 py-[8px] text-[#6b7280] tabular-nums">
							{(run.input_tokens ?? 0) + (run.output_tokens ?? 0)}
						</td>
						<td class="px-4 py-[8px] text-[#6b7280] tabular-nums">${(run.cost ?? 0).toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
