<script lang="ts">
	import { metricsAdminState } from '$lib/store/metrics-admin.svelte';
	import {
		parseImportPlan,
		toImportPayload,
		buildTemplateCsv,
		type ImportPlan
	} from '$lib/metrics-admin/csv-import';
	import { importMetricsCsv, type ImportSummary } from '$lib/metrics-admin/db';

	// The one REAL (non-demo) write path in /metrics-admin: parsing happens
	// entirely in the browser, then admin_import_metrics_csv (a SECURITY
	// DEFINER RPC, see supabase/metrics_schema.sql) merges it in. Never
	// deletes: a metric already in the database that isn't in this CSV is
	// left untouched; a matching metric only gets a new version if its
	// content actually changed.

	interface Props {
		onImported: () => void;
	}

	let { onImported }: Props = $props();

	let dragging = $state(false);
	let fileName = $state('');
	let parsing = $state(false);
	let parseError = $state('');
	let plan = $state<ImportPlan | null>(null);
	let showAllSkipped = $state(false);

	let importing = $state(false);
	let importError = $state('');
	let importResult = $state<ImportSummary | null>(null);

	async function loadFile(file: File) {
		fileName = file.name;
		parsing = true;
		parseError = '';
		plan = null;
		importResult = null;
		importError = '';
		try {
			const text = await file.text();
			plan = await parseImportPlan(text);
		} catch (e) {
			parseError = e instanceof Error ? e.message : String(e);
		} finally {
			parsing = false;
		}
	}

	function handleFileInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) loadFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) loadFile(file);
	}

	function reset() {
		fileName = '';
		parseError = '';
		plan = null;
		importResult = null;
		importError = '';
	}

	function downloadTemplate() {
		const blob = new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'impactbench-metrics-template.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function runImport() {
		if (!plan || plan.metrics.length === 0) return;
		const key = metricsAdminState.key;
		if (!key) {
			importError = 'Admin key missing — reload and re-enter it.';
			return;
		}
		importing = true;
		importError = '';
		try {
			importResult = await importMetricsCsv(key, toImportPayload(plan));
			plan = null;
			fileName = '';
			onImported();
		} catch (e) {
			importError = e instanceof Error ? e.message : String(e);
		} finally {
			importing = false;
		}
	}

	const visibleSkipped = $derived(
		plan ? (showAllSkipped ? plan.skipped : plan.skipped.slice(0, 10)) : []
	);
</script>

<div class="mx-auto w-full max-w-[760px] px-6 py-8">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">Import metrics CSV</h2>
				<span class="rounded-full bg-[#e0f7f7] px-2 py-[1px] text-[9px] font-bold text-[#038d8f]"
					>Real write</span
				>
			</div>
			<p class="text-[11px] text-[#9ca3af]">
				Parses a metrics CSV in your browser, then merges it in: new metrics are added, existing
				ones (matched by benchmark + metric name) get a new version only if their content changed,
				and anything not in this file is left alone.
			</p>
		</div>
		<button
			class="flex flex-shrink-0 items-center gap-[6px] rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-[6px] text-[11px] font-semibold whitespace-nowrap text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]"
			onclick={downloadTemplate}
		>
			<i class="fa-solid fa-download text-[10px]"></i> Download template CSV
		</button>
	</div>

	{#if importResult}
		<div class="mb-6 rounded-[10px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
			<div class="mb-2 flex items-center gap-2 text-[#16a34a]">
				<i class="fa-solid fa-circle-check"></i>
				<span class="text-[13px] font-[800]">Import complete</span>
			</div>
			<ul class="space-y-[2px] text-[12px] text-[#166534]">
				<li>
					{importResult.metrics_created} new metric{importResult.metrics_created === 1 ? '' : 's'}
					added, {importResult.metrics_updated} updated with a new version, {importResult.metrics_unchanged}
					already up to date.
				</li>
				<li>
					{importResult.scenarios_added} scenario{importResult.scenarios_added === 1 ? '' : 's'} added
					across {importResult.benchmarks_processed} benchmark{importResult.benchmarks_processed ===
					1
						? ''
						: 's'}. Nothing outside this file was touched.
				</li>
			</ul>
			<button
				class="mt-3 rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-[5px] text-[11px] font-semibold text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]"
				onclick={reset}
			>
				Import another file
			</button>
		</div>
	{/if}

	{#if !plan && !importResult}
		<label
			class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed p-8 transition-colors {dragging
				? 'border-[#00b3b0] bg-[#f0fafa]'
				: 'border-[#d1d5db] bg-[#fafaf9]'}"
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={handleDrop}
		>
			<i class="fa-solid fa-file-csv text-2xl text-[#9ca3af]"></i>
			<span class="text-[13px] font-semibold text-[#374151]"
				>Drop a CSV here, or click to browse</span
			>
			<span class="text-[10px] text-[#9ca3af]"
				>date, area, benchmark_name, internal_benchmark_category, metric_name, description,
				metric_polarity, examples, scen_1, scen_2, scen_3</span
			>
			<input type="file" accept=".csv,text/csv" class="hidden" onchange={handleFileInput} />
		</label>

		{#if parsing}
			<p class="mt-3 flex items-center gap-2 text-[12px] text-[#9ca3af]">
				<i class="fa-solid fa-spinner fa-spin"></i> Parsing {fileName}…
			</p>
		{/if}
		{#if parseError}
			<div
				class="mt-3 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]"
			>
				{parseError}
			</div>
		{/if}
	{/if}

	{#if plan}
		<div class="mb-4 rounded-[10px] border border-[#e5e7eb] bg-white p-4">
			<div class="mb-3 flex items-center justify-between">
				<span class="text-[12px] font-semibold text-[#1a1a1a]"
					><i class="fa-solid fa-file-csv mr-1 text-[#9ca3af]"></i>{fileName}</span
				>
				<button class="text-[11px] font-medium text-[#6b7280] hover:text-[#00b3b0]" onclick={reset}
					>Choose a different file</button
				>
			</div>

			<div class="mb-3 grid grid-cols-4 gap-2">
				<div class="rounded-[8px] bg-[#f9fafb] px-3 py-2 text-center">
					<div class="text-[16px] font-[800] text-[#1a1a1a]">{plan.benchmarks.length}</div>
					<div class="text-[9px] tracking-[0.06em] text-[#9ca3af] uppercase">Benchmarks</div>
				</div>
				<div class="rounded-[8px] bg-[#f9fafb] px-3 py-2 text-center">
					<div class="text-[16px] font-[800] text-[#1a1a1a]">{plan.metrics.length}</div>
					<div class="text-[9px] tracking-[0.06em] text-[#9ca3af] uppercase">Metrics</div>
				</div>
				<div class="rounded-[8px] bg-[#f9fafb] px-3 py-2 text-center">
					<div class="text-[16px] font-[800] text-[#1a1a1a]">{plan.scenarioCount}</div>
					<div class="text-[9px] tracking-[0.06em] text-[#9ca3af] uppercase">Scenarios</div>
				</div>
				<div class="rounded-[8px] bg-[#f9fafb] px-3 py-2 text-center">
					<div
						class="text-[16px] font-[800] {plan.skipped.length
							? 'text-[#c2410c]'
							: 'text-[#1a1a1a]'}"
					>
						{plan.skipped.length}
					</div>
					<div class="text-[9px] tracking-[0.06em] text-[#9ca3af] uppercase">Skipped rows</div>
				</div>
			</div>

			{#if plan.skipped.length > 0}
				<div class="mb-1 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-3">
					<div class="mb-1 text-[11px] font-semibold text-[#c2410c]">
						{plan.skipped.length} row{plan.skipped.length === 1 ? '' : 's'} will be skipped
					</div>
					<ul class="space-y-[2px] text-[11px] text-[#9a3412]">
						{#each visibleSkipped as s (s.row)}
							<li>Row {s.row}: {s.reason}</li>
						{/each}
					</ul>
					{#if plan.skipped.length > 10}
						<button
							class="mt-1 text-[10px] font-semibold text-[#c2410c] hover:underline"
							onclick={() => (showAllSkipped = !showAllSkipped)}
						>
							{showAllSkipped ? 'Show fewer' : `Show all ${plan.skipped.length}`}
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<div class="mb-4 rounded-[10px] border border-[#bae6fd] bg-[#f0f9ff] p-4">
			<div class="mb-1 flex items-center gap-2 text-[#0369a1]">
				<i class="fa-solid fa-circle-info"></i>
				<span class="text-[12px] font-[800]">This merges into the existing data</span>
			</div>
			<p class="text-[12px] leading-[1.6] text-[#075985]">
				Metrics here that already exist (matched by benchmark + metric name) get a new version only
				if their content changed — old scenarios stay put and get flagged stale, same as a manual
				edit. New metrics are added as drafts. Nothing already in the database is deleted, including
				anything not in this file.
			</p>
		</div>

		{#if importError}
			<div
				class="mb-4 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]"
			>
				{importError}
			</div>
		{/if}

		<button
			class="w-full rounded-[10px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[10px] text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={plan.metrics.length === 0 || importing}
			onclick={runImport}
		>
			{#if importing}
				<i class="fa-solid fa-spinner fa-spin"></i> Importing…
			{:else}
				<i class="fa-solid fa-upload"></i> Import {plan.metrics.length} metric{plan.metrics
					.length === 1
					? ''
					: 's'}
			{/if}
		</button>
	{/if}
</div>
