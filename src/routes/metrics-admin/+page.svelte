<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		metricsAdminState,
		setMetricsAdminKey,
		clearMetricsAdminKey
	} from '$lib/store/metrics-admin.svelte';
	import {
		listBenchmarks,
		listMetrics,
		listModels,
		listTaxonomyAreas,
		listTaxonomySubareas,
		listNutritionCategories,
		getMetricDetail,
		getMetricPlacements,
		getMetricsForExport,
		validateAdminKey
	} from '$lib/metrics-admin/db';
	import { buildMetricsCsv } from '$lib/metrics-admin/csv-import';
	import { safeMarkdownHtml } from '$lib/safe-markdown';
	import ScorePill from '$lib/components/atoms/ScorePill.svelte';
	import MetricEditForm from '$lib/components/metrics-admin/MetricEditForm.svelte';
	import StalenessBanner from '$lib/components/metrics-admin/StalenessBanner.svelte';
	import RegenerateModal from '$lib/components/metrics-admin/RegenerateModal.svelte';
	import VersionHistory from '$lib/components/metrics-admin/VersionHistory.svelte';
	import LiveRelationships from '$lib/components/metrics-admin/LiveRelationships.svelte';
	import PublishDiffModal from '$lib/components/metrics-admin/PublishDiffModal.svelte';
	import NewMetricWizard from '$lib/components/metrics-admin/NewMetricWizard.svelte';
	import ModelsPanel from '$lib/components/metrics-admin/ModelsPanel.svelte';
	import ImportCsvPanel from '$lib/components/metrics-admin/ImportCsvPanel.svelte';
	import OpsRunsPanel from '$lib/components/metrics-admin/OpsRunsPanel.svelte';
	import MassActionModal from '$lib/components/metrics-admin/MassActionModal.svelte';
	import {
		METRIC_STATUS_ORDER,
		type Benchmark,
		type MetricDetail,
		type MetricListItem,
		type MetricPlacements,
		type MetricStatus,
		type Model,
		type NutritionCategory,
		type TaxonomyArea,
		type TaxonomySubarea
	} from '$lib/metrics-admin/types';

	// The one test/smoke-test model a "Run Test Simulation" action uses —
	// intentionally a single fixed model, not the full model matrix (that's
	// the per-model evaluation phase, still undesigned — see the status
	// column comment in metrics_schema.sql).
	const TEST_SIMULATION_MODEL_LABEL = 'Claude Haiku 4.5';

	type Phase = 'need-key' | 'validating' | 'ready' | 'invalid' | 'error';
	type Tab = 'dashboard' | 'add' | 'ops';
	// Sub-mode within the merged "Add Metrics" tab. 'new' (the single-metric
	// wizard) is disabled for now — see the button below — so this never
	// actually changes yet, but the branch stays wired up for when it's
	// re-enabled.
	type AddMode = 'csv' | 'new';
	type SortMode = 'name' | 'status' | 'benchmark';

	let phase = $state<Phase>('need-key');
	let errorMessage = $state('');
	let keyInput = $state('');
	let activeTab = $state<Tab>('dashboard');
	let addMode = $state<AddMode>('csv');

	let benchmarks = $state<Benchmark[]>([]);
	let metrics = $state<MetricListItem[]>([]);
	let models = $state<Model[]>([]);
	let taxonomyAreas = $state<TaxonomyArea[]>([]);
	let taxonomySubareas = $state<TaxonomySubarea[]>([]);
	let nutritionCategories = $state<NutritionCategory[]>([]);
	let listError = $state('');

	let selectedBenchmarkSlug = $state<string | null>(null);
	let selectedStatus = $state<MetricStatus | null>(null);
	let selectedAreaId = $state<string | null>(null);
	let selectedSubareaId = $state<string | null>(null);
	let search = $state('');
	let sortMode = $state<SortMode>('status');

	let selectedMetricId = $state<string | null>(null);
	let metricDetail = $state<MetricDetail | null>(null);
	let detailLoading = $state(false);
	let detailError = $state('');
	let expandedScenarioId = $state<string | null>(null);
	let placements = $state<MetricPlacements>({ taxonomy: [], nutrition: [] });
	let editing = $state(false);
	let simulateStale = $state(false);
	let publishOpen = $state(false);

	// Which single-metric workflow-action modal is open, if any. One shared
	// modal component (RegenerateModal) covers Generate Scenarios / Run Test
	// Simulation / Regenerate — only phases/copy differ. Demo-only, but on
	// completion this DOES advance the metric's status in local state (see
	// applyStatusTransition) so the flow feels real even though nothing is
	// persisted — reload and it reverts.
	let actionModal = $state<null | 'generate' | 'simulate' | 'regenerate'>(null);

	// Mass selection, for running an action across many metrics at once.
	// Always reassigned wholesale (never mutated in place), so a plain Set
	// triggers Svelte reactivity the same way replacing an array would.
	let selectedMetricIds = $state<Set<string>>(new Set());
	let massAction = $state<null | { kind: 'generate' | 'simulate'; items: MetricListItem[] }>(null);

	const staleCount = $derived.by(() => {
		const detail = metricDetail;
		if (!detail) return 0;
		if (simulateStale) return detail.scenarios.length;
		return detail.scenarios.filter((s) => s.metric_version_id !== detail.current_version.id).length;
	});

	const submittedSeedTitles = $derived(
		(metricDetail?.scenarios ?? []).filter((s) => s.source === 'submitted').map((s) => s.title)
	);

	const actionModalConfig = $derived.by(() => {
		if (actionModal === 'generate') {
			return {
				title: 'Generating scenarios',
				doneTitle: 'Scenarios generated',
				description:
					submittedSeedTitles.length > 0
						? `Simulated for this demo — using ${submittedSeedTitles.length} submitted example scenario${submittedSeedTitles.length === 1 ? '' : 's'} as seed input. No pipeline was actually run.`
						: 'Simulated for this demo — no pipeline was actually run.',
				phases: [{ key: 'gen_scenarios', label: 'Generating scenarios' }],
				seedTitles: submittedSeedTitles
			};
		}
		if (actionModal === 'simulate') {
			return {
				title: 'Running test simulation',
				doneTitle: 'Test simulation complete',
				description: `Simulated for this demo — running one scenario pass with ${TEST_SIMULATION_MODEL_LABEL} as a smoke test. No model was actually called.`,
				phases: [{ key: 'simulate', label: `Simulating with ${TEST_SIMULATION_MODEL_LABEL}` }],
				seedTitles: []
			};
		}
		return {
			title: 'Regenerating scenarios',
			doneTitle: 'Regeneration complete',
			description: `Simulated for this demo — ${staleCount} scenario${staleCount === 1 ? '' : 's'} would be regenerated. No pipeline was actually run.`,
			phases: [
				{ key: 'gen_scenarios', label: 'Generating scenarios' },
				{ key: 'simulate', label: 'Simulating conversations' }
			],
			seedTitles: []
		};
	});

	/** Local-only status transition, so the demo flow feels real. Never
	 * persisted — a reload reverts to whatever's actually in the database. */
	function applyStatusTransition(ids: Set<string> | string[], newStatus: MetricStatus) {
		const idSet = ids instanceof Set ? ids : new Set(ids);
		metrics = metrics.map((m) => (idSet.has(m.id) ? { ...m, status: newStatus } : m));
		if (metricDetail && idSet.has(metricDetail.id)) {
			metricDetail = { ...metricDetail, status: newStatus };
		}
	}

	function toggleMetricSelection(id: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch copy, discarded after reassigning selectedMetricIds below
		const next = new Set(selectedMetricIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedMetricIds = next;
	}

	const currentSubareasForFilter = $derived(
		selectedAreaId ? taxonomySubareas.filter((s) => s.area_id === selectedAreaId) : []
	);

	const filteredMetrics = $derived.by(() => {
		const list = metrics.filter((m) => {
			if (selectedBenchmarkSlug && m.benchmark.slug !== selectedBenchmarkSlug) return false;
			if (selectedStatus && m.status !== selectedStatus) return false;
			if (selectedSubareaId && !m.subareas.some((s) => s.subarea_id === selectedSubareaId))
				return false;
			if (
				selectedAreaId &&
				!selectedSubareaId &&
				!m.subareas.some((s) => s.area_id === selectedAreaId)
			)
				return false;
			if (search.trim()) {
				const q = search.trim().toLowerCase();
				const name = m.current_version?.name ?? '';
				if (!name.toLowerCase().includes(q) && !m.slug.toLowerCase().includes(q)) return false;
			}
			return true;
		});
		const sorted = [...list];
		if (sortMode === 'name') {
			sorted.sort((a, b) =>
				(a.current_version?.name ?? a.slug).localeCompare(b.current_version?.name ?? b.slug)
			);
		} else if (sortMode === 'status') {
			sorted.sort(
				(a, b) => METRIC_STATUS_ORDER.indexOf(a.status) - METRIC_STATUS_ORDER.indexOf(b.status)
			);
		} else {
			sorted.sort((a, b) => a.benchmark.name.localeCompare(b.benchmark.name));
		}
		return sorted;
	});

	const allFilteredSelected = $derived(
		filteredMetrics.length > 0 && filteredMetrics.every((m) => selectedMetricIds.has(m.id))
	);
	const eligibleForGenerate = $derived(
		filteredMetrics.filter((m) => selectedMetricIds.has(m.id) && m.status === 'draft')
	);
	const eligibleForSimulate = $derived(
		filteredMetrics.filter((m) => selectedMetricIds.has(m.id) && m.status === 'ready_to_simulate')
	);

	function toggleSelectAllFiltered() {
		if (allFilteredSelected) {
			selectedMetricIds = new Set();
		} else {
			selectedMetricIds = new Set(filteredMetrics.map((m) => m.id));
		}
	}

	function metricLabel(m: MetricListItem): string {
		return m.current_version?.name ?? m.slug;
	}

	const massActionConfig = $derived.by(() => {
		if (!massAction) return null;
		const items = massAction.items.map((m) => ({ id: m.id, label: metricLabel(m) }));
		if (massAction.kind === 'generate') {
			return {
				title: 'Generating scenarios',
				doneTitle: 'Scenarios generated',
				description: `Simulated for this demo — generating scenarios for ${items.length} draft metric${items.length === 1 ? '' : 's'}, seeded from each metric's submitted examples. No pipeline was actually run.`,
				actionLabel: 'Generating scenarios',
				items,
				nextStatus: 'ready_to_simulate' as MetricStatus
			};
		}
		return {
			title: 'Running test simulations',
			doneTitle: 'Test simulations complete',
			description: `Simulated for this demo — running a ${TEST_SIMULATION_MODEL_LABEL} smoke test across ${items.length} metric${items.length === 1 ? '' : 's'}. No model was actually called.`,
			actionLabel: `Simulating with ${TEST_SIMULATION_MODEL_LABEL}`,
			items,
			nextStatus: 'ready_to_publish' as MetricStatus
		};
	});

	function startMassAction(kind: 'generate' | 'simulate') {
		const items = kind === 'generate' ? eligibleForGenerate : eligibleForSimulate;
		massAction = { kind, items };
	}

	function closeMassAction() {
		massAction = null;
		selectedMetricIds = new Set();
	}

	function statusLabel(status: MetricStatus): string {
		return status
			.split('_')
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(' ');
	}

	function statusStyle(status: MetricStatus): string {
		if (status === 'published') return 'background:#e0f7f7;color:#038d8f';
		if (status === 'draft') return 'background:#f3f4f6;color:#6b7280';
		return 'background:#fff7ed;color:#c2410c';
	}

	// Which single benchmark's export is in flight, if any (for that row's
	// spinner) — separate from exportingAll since they're different buttons,
	// but only one of the two ever runs at a time.
	let exportingBenchmarkId = $state<string | null>(null);
	let exportingAll = $state(false);
	let exportError = $state('');

	function downloadCsv(filename: string, contents: string) {
		const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	/** Exports one benchmark's current metrics in the same CSV column shape
	 * the Import tab expects (see $lib/metrics-admin/csv-import.ts), so it
	 * can be hand-edited and re-imported later. */
	async function exportBenchmarkCsv(bm: Benchmark) {
		exportError = '';
		exportingBenchmarkId = bm.id;
		try {
			const rows = await getMetricsForExport(bm.id);
			downloadCsv(`${bm.slug}-metrics-export.csv`, buildMetricsCsv(rows));
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			exportingBenchmarkId = null;
		}
	}

	/** Every benchmark's metrics in one combined CSV — unlike a per-benchmark
	 * YAML file, CSV rows naturally combine, so this is a single download
	 * rather than one-per-benchmark. */
	async function exportAllBenchmarksCsv() {
		exportError = '';
		exportingAll = true;
		try {
			const rows = await getMetricsForExport();
			downloadCsv('impactbench-metrics-export.csv', buildMetricsCsv(rows));
		} catch (e) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			exportingAll = false;
		}
	}

	async function loadDashboard() {
		listError = '';
		try {
			const [b, m, mo, ta, ts, nc] = await Promise.all([
				listBenchmarks(),
				listMetrics(),
				listModels(),
				listTaxonomyAreas(),
				listTaxonomySubareas(),
				listNutritionCategories()
			]);
			benchmarks = b;
			metrics = m;
			models = mo;
			taxonomyAreas = ta;
			taxonomySubareas = ts;
			nutritionCategories = nc;
		} catch (e) {
			listError = e instanceof Error ? e.message : String(e);
		}
	}

	async function validateAndLoad(key: string) {
		phase = 'validating';
		errorMessage = '';
		try {
			const valid = await validateAdminKey(key);
			if (!valid) {
				phase = 'invalid';
				return;
			}
			phase = 'ready';
			await loadDashboard();
		} catch (e) {
			phase = 'error';
			errorMessage = e instanceof Error ? e.message : String(e);
		}
	}

	function submitKey() {
		const k = keyInput.trim();
		if (!k) return;
		setMetricsAdminKey(k);
		keyInput = '';
		validateAndLoad(k);
	}

	function logout() {
		clearMetricsAdminKey();
		benchmarks = [];
		metrics = [];
		selectedMetricId = null;
		metricDetail = null;
		phase = 'need-key';
		goto('/');
	}

	async function selectMetric(id: string) {
		selectedMetricId = id;
		expandedScenarioId = null;
		metricDetail = null;
		detailError = '';
		detailLoading = true;
		editing = false;
		simulateStale = false;
		actionModal = null;
		publishOpen = false;
		placements = { taxonomy: [], nutrition: [] };
		try {
			metricDetail = await getMetricDetail(id);
			placements = await getMetricPlacements(id);
		} catch (e) {
			detailError = e instanceof Error ? e.message : String(e);
		} finally {
			detailLoading = false;
		}
	}

	onMount(() => {
		if (!browser) return;
		if (metricsAdminState.key) {
			validateAndLoad(metricsAdminState.key);
		}
	});
</script>

<svelte:head>
	<title>Metrics Admin · ImpactBench</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="flex h-screen flex-col overflow-hidden bg-[#fafaf9] font-[Inter,system-ui,sans-serif]">
	<!-- Header -->
	<header
		class="flex flex-shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-3"
	>
		<div class="flex items-center gap-2.5">
			<i class="fa-solid fa-list-check text-[#00b3b0]"></i>
			<span class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
				ImpactBench Metrics Admin
			</span>
			<span class="rounded-full bg-[#e0f7f7] px-2 py-[2px] text-[10px] font-bold text-[#038d8f]">
				Metrics
			</span>
		</div>
		{#if phase === 'ready'}
			<div class="flex items-center gap-4">
				<nav class="flex items-center gap-[3px]">
					{#each [['dashboard', 'Dashboard', 'fa-table-list'], ['add', 'Add Metrics', 'fa-square-plus'], ['ops', 'Models & Ops', 'fa-gears']] as [tab, label, icon] (tab)}
						<button
							class="inline-flex items-center gap-[6px] rounded-[6px] px-[12px] py-[6px] text-[12px] font-medium transition-colors duration-150
								{activeTab === tab
								? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
								: 'text-[#6b7280] hover:bg-[#f3f4f6]'}"
							onclick={() => (activeTab = tab as Tab)}
						>
							<i class="fa-solid {icon} text-[11px]"></i>
							{label}
						</button>
					{/each}
				</nav>
				<button
					class="flex items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] font-semibold text-[#6b7280] transition-colors hover:border-[#00b3b0] hover:text-[#00b3b0]"
					onclick={logout}
				>
					<i class="fa-solid fa-house text-[11px]"></i> Return home
				</button>
			</div>
		{/if}
	</header>

	{#if phase !== 'ready'}
		<!-- Key entry / status gate -->
		<div class="flex flex-1 items-center justify-center px-6">
			<div
				class="w-full max-w-[420px] rounded-[16px] border border-[#e5e7eb] bg-white p-8 shadow-[0_10px_32px_rgba(15,23,42,0.07)]"
			>
				<div class="mb-1 flex items-center gap-2 text-[#111827]">
					<i class="fa-solid fa-key text-[#00b3b0]"></i>
					<h1 class="text-[18px] font-[800] tracking-[-0.01em]">Admin key required</h1>
				</div>
				<p class="mb-5 text-[13px] leading-[1.6] text-[#6b7280]">
					Paste your admin capability key to view the metrics dashboard. The key is held in memory
					only — it is never saved, so you'll re-enter it after a reload.
				</p>

				{#if phase === 'invalid'}
					<div
						class="mb-4 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]"
					>
						That key is invalid or has been revoked.
					</div>
				{:else if phase === 'error'}
					<div
						class="mb-4 rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[12px] font-medium text-[#c2410c]"
					>
						Couldn't reach the server: {errorMessage}
					</div>
				{/if}

				<div class="flex gap-2">
					<input
						type="password"
						placeholder="Admin key (UUID)…"
						bind:value={keyInput}
						disabled={phase === 'validating'}
						onkeydown={(e) => {
							if (e.key === 'Enter') submitKey();
						}}
						class="flex-1 rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3 py-[10px] text-[14px] text-[#111827] transition-colors outline-none focus:border-[#00b3b0]"
					/>
					<button
						class="rounded-[10px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[10px] text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter] hover:brightness-105 disabled:opacity-60"
						disabled={phase === 'validating' || !keyInput.trim()}
						onclick={submitKey}
					>
						{#if phase === 'validating'}
							<i class="fa-solid fa-spinner fa-spin"></i>
						{:else}
							Enter
						{/if}
					</button>
				</div>
			</div>
		</div>
	{:else if activeTab === 'add'}
		<div class="flex-1 overflow-y-auto">
			<div class="mx-auto w-full max-w-[760px] px-6 pt-6">
				<div class="inline-flex rounded-[10px] border border-[#e5e7eb] bg-white p-[3px]">
					<button
						class="rounded-[7px] px-4 py-[6px] text-[12px] font-semibold transition-colors duration-150
							{addMode === 'csv' ? 'bg-[#e0f7f7] text-[#00b3b0]' : 'text-[#6b7280] hover:bg-[#f3f4f6]'}"
						onclick={() => (addMode = 'csv')}
					>
						<i class="fa-solid fa-file-csv text-[10px]"></i> Import CSV
					</button>
					<button
						class="cursor-not-allowed rounded-[7px] px-4 py-[6px] text-[12px] font-semibold text-[#c4c9d1]"
						disabled
						title="Coming soon — use Import CSV for now"
					>
						<i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i> New Metric
						<span
							class="ml-1 rounded-full bg-[#f3f4f6] px-[6px] py-[1px] text-[9px] font-bold text-[#9ca3af]"
							>Soon</span
						>
					</button>
				</div>
			</div>

			{#if addMode === 'csv'}
				<ImportCsvPanel onImported={loadDashboard} />
			{:else}
				<NewMetricWizard
					{benchmarks}
					areas={taxonomyAreas}
					subareas={taxonomySubareas}
					{nutritionCategories}
				/>
			{/if}
		</div>
	{:else if activeTab === 'ops'}
		<div class="flex-1 overflow-y-auto">
			<ModelsPanel {models} />
			<OpsRunsPanel />
		</div>
	{:else}
		<!-- Dashboard -->
		<div class="flex h-full w-full overflow-hidden bg-[#fafaf9]">
			<!-- COL 1: Filters -->
			<aside
				class="flex w-[220px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white"
			>
				<div class="border-b border-[#f3f4f6] px-4 pt-[14px] pb-[10px]">
					<div class="flex items-baseline justify-between">
						<h2 class="text-[13px] font-[800] tracking-[-0.01em] text-[#1a1a1a]">Filters</h2>
						<span class="text-[11px] text-[#9ca3af]"
							>{filteredMetrics.length}<span class="text-[#c4c9d1]"> / {metrics.length}</span></span
						>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto">
					<div class="pt-2 pb-1">
						<div
							class="px-4 pb-[5px] text-[10px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase"
						>
							Area
						</div>
						<button
							class="flex w-full items-center gap-[7px] px-4 py-[5px] text-left text-[12px] transition-colors duration-100
								{selectedAreaId === null
								? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
								: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
							onclick={() => {
								selectedAreaId = null;
								selectedSubareaId = null;
							}}
						>
							<i class="fa-solid fa-layer-group flex-shrink-0 text-[10px] opacity-60"></i>
							All Areas
						</button>
						{#each taxonomyAreas as area (area.id)}
							<button
								class="flex w-full items-center gap-[7px] px-4 py-[5px] text-left text-[12px] transition-colors duration-100
									{selectedAreaId === area.id
									? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
								onclick={() => {
									selectedAreaId = area.id;
									selectedSubareaId = null;
								}}
							>
								<i class="fa-solid {area.icon ?? 'fa-circle'} flex-shrink-0 text-[10px] opacity-60"
								></i>
								{area.name}
							</button>
						{/each}
					</div>

					{#if selectedAreaId && currentSubareasForFilter.length > 0}
						<div class="mt-1 border-t border-[#f3f4f6] pt-1 pb-1">
							<div
								class="px-4 py-[5px] text-[10px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase"
							>
								Subarea
							</div>
							<button
								class="w-full px-4 py-[5px] text-left text-[12px] transition-colors duration-100
									{selectedSubareaId === null
									? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
								onclick={() => (selectedSubareaId = null)}>All Subareas</button
							>
							{#each currentSubareasForFilter as sub (sub.id)}
								<button
									class="flex w-full items-center gap-[7px] px-4 py-[5px] text-left text-[12px] transition-colors duration-100
										{selectedSubareaId === sub.id
										? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
										: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
									onclick={() => (selectedSubareaId = sub.id)}
								>
									<i class="fa-solid {sub.icon ?? 'fa-circle'} flex-shrink-0 text-[10px] opacity-60"
									></i>
									<span class="truncate">{sub.name}</span>
								</button>
							{/each}
						</div>
					{/if}

					<div class="mt-2 border-t-[4px] border-[#f3f4f6] pt-2 pb-1">
						<div
							class="px-4 pb-[5px] text-[10px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase"
						>
							Status
						</div>
						<button
							class="flex w-full items-center gap-[7px] px-4 py-[5px] text-left text-[12px] transition-colors duration-100
								{selectedStatus === null
								? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
								: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
							onclick={() => (selectedStatus = null)}
						>
							All Statuses
						</button>
						{#each METRIC_STATUS_ORDER as status (status)}
							<button
								class="flex w-full items-center gap-[7px] px-4 py-[5px] text-left text-[12px] transition-colors duration-100
									{selectedStatus === status
									? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
								onclick={() => (selectedStatus = status)}
							>
								{statusLabel(status)}
							</button>
						{/each}
					</div>

					<div class="mt-2 border-t-[4px] border-[#f3f4f6] pt-2 pb-3">
						<div class="flex items-center justify-between px-4 pb-[5px]">
							<span class="text-[10px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase"
								>Benchmark</span
							>
							<button
								class="text-[9px] font-semibold text-[#9ca3af] hover:text-[#00b3b0] disabled:opacity-40"
								disabled={exportingBenchmarkId !== null || exportingAll || benchmarks.length === 0}
								onclick={exportAllBenchmarksCsv}
								title="Download every benchmark's metrics as one CSV"
							>
								{#if exportingAll}
									<i class="fa-solid fa-spinner fa-spin"></i>
								{:else}
									<i class="fa-solid fa-file-export"></i>
								{/if}
								Export all</button
							>
						</div>
						<button
							class="w-full px-4 py-[5px] text-left text-[12px] transition-colors duration-100
								{selectedBenchmarkSlug === null
								? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
								: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
							onclick={() => (selectedBenchmarkSlug = null)}>All Benchmarks</button
						>
						{#each benchmarks as bm (bm.id)}
							<div
								class="group flex items-center gap-[2px] px-4 transition-colors duration-100
									{selectedBenchmarkSlug === bm.slug ? 'bg-[#e0f7f7]' : 'hover:bg-[#f3f4f6]'}"
							>
								<button
									class="min-w-0 flex-1 truncate py-[5px] text-left text-[12px]
										{selectedBenchmarkSlug === bm.slug ? 'font-semibold text-[#00b3b0]' : 'text-[#4b5563]'}"
									title={bm.name}
									onclick={() => (selectedBenchmarkSlug = bm.slug)}>{bm.name}</button
								>
								<button
									class="flex-shrink-0 rounded-[4px] p-[4px] text-[10px] text-[#c4c9d1] opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:text-[#00b3b0] disabled:opacity-40
										{exportingBenchmarkId === bm.id ? '!opacity-100' : ''}"
									disabled={exportingBenchmarkId !== null || exportingAll}
									onclick={() => exportBenchmarkCsv(bm)}
									title="Download {bm.name}'s metrics as CSV"
								>
									{#if exportingBenchmarkId === bm.id}
										<i class="fa-solid fa-spinner fa-spin"></i>
									{:else}
										<i class="fa-solid fa-download"></i>
									{/if}
								</button>
							</div>
						{/each}
						{#if exportError}
							<p class="mt-1 px-4 text-[10px] font-medium text-[#dc2626]">{exportError}</p>
						{/if}
					</div>
				</div>
			</aside>

			<!-- COL 2: Metric list -->
			<div class="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white">
				<div
					class="flex flex-shrink-0 flex-col gap-[7px] border-b border-[#e5e7eb] bg-white px-4 py-[9px]"
				>
					<div class="relative">
						<i
							class="fa-solid fa-magnifying-glass absolute top-1/2 left-[8px] -translate-y-1/2 text-[10px] text-[#b0b8c4]"
						></i>
						<input
							type="text"
							placeholder="Search metrics…"
							bind:value={search}
							class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-[#fafaf9] py-[5px] pr-3 pl-[24px] text-[12px] text-[#1a1a1a] transition-[border-color] duration-150 outline-none placeholder:text-[#b0b8c4] focus:border-[#00b3b0] focus:bg-white"
						/>
					</div>
					<div class="flex items-center gap-[5px]">
						<span class="text-[10px] text-[#9ca3af]">Sort</span>
						{#each [['status', 'Status'], ['name', 'A–Z'], ['benchmark', 'Benchmark']] as [mode, label] (mode)}
							<button
								class="rounded-[10px] border-[1.5px] px-[8px] py-[2px] text-[10px] font-medium transition-all duration-150
									{sortMode === mode
									? 'border-[#80d8d7] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#9ca3af]'}"
								onclick={() => (sortMode = mode as SortMode)}>{label}</button
							>
						{/each}
						<span class="ml-auto flex items-center gap-[10px]">
							<span class="text-[10px] text-[#9ca3af]"
								>{filteredMetrics.length} metric{filteredMetrics.length === 1 ? '' : 's'}</span
							>
							<button
								class="flex items-center gap-[5px] text-[10px] font-medium text-[#6b7280] hover:text-[#00b3b0]"
								onclick={toggleSelectAllFiltered}
							>
								<span
									class="flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border-[1.5px]
										{allFilteredSelected ? 'border-[#00b3b0] bg-[#00b3b0]' : 'border-[#d1d5db] bg-white'}"
								>
									{#if allFilteredSelected}<i class="fa-solid fa-check text-[8px] text-white"
										></i>{/if}
								</span>
								Select all
							</button>
						</span>
					</div>

					{#if selectedMetricIds.size > 0}
						<div
							class="flex flex-wrap items-center gap-[6px] rounded-[8px] border border-[#80d8d7] bg-[#e0f7f7] px-[10px] py-[6px]"
						>
							<span class="text-[11px] font-semibold text-[#038d8f]"
								>{selectedMetricIds.size} selected</span
							>
							<button
								class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-[8px] py-[3px] text-[10px] font-semibold text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
								disabled={eligibleForGenerate.length === 0}
								onclick={() => startMassAction('generate')}
							>
								<i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i> Generate Scenarios ({eligibleForGenerate.length})
							</button>
							<button
								class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-[8px] py-[3px] text-[10px] font-semibold text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
								disabled={eligibleForSimulate.length === 0}
								onclick={() => startMassAction('simulate')}
							>
								<i class="fa-solid fa-play text-[9px]"></i> Run Test Simulation ({eligibleForSimulate.length})
							</button>
							<button
								class="ml-auto text-[10px] font-medium text-[#038d8f] hover:underline"
								onclick={() => (selectedMetricIds = new Set())}>Clear</button
							>
						</div>
					{/if}
				</div>

				<div class="flex-1 overflow-y-auto">
					{#if listError}
						<p class="px-4 py-3 text-[12px] text-[#dc2626]">{listError}</p>
					{:else if filteredMetrics.length === 0}
						<div class="flex h-full flex-col items-center justify-center gap-2 text-[#9ca3af]">
							<i class="fa-solid fa-magnifying-glass text-xl opacity-30"></i>
							<p class="text-[12px]">No metrics match your filters.</p>
						</div>
					{:else}
						{#each filteredMetrics as m (m.id)}
							<div
								class="flex w-full items-center gap-[10px] border-b border-[#f3f4f6] px-4 py-[9px] text-left
									{selectedMetricId === m.id ? 'bg-[#f3f4f6]' : 'hover:bg-[#f9fafb]'}"
							>
								<button
									class="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[3px] border-[1.5px]
										{selectedMetricIds.has(m.id) ? 'border-[#00b3b0] bg-[#00b3b0]' : 'border-[#d1d5db] bg-white'}"
									onclick={(e) => {
										e.stopPropagation();
										toggleMetricSelection(m.id);
									}}
									aria-label="Select {metricLabel(m)}"
								>
									{#if selectedMetricIds.has(m.id)}<i
											class="fa-solid fa-check text-[9px] text-white"
										></i>{/if}
								</button>
								<button
									class="flex min-w-0 flex-1 items-center gap-[10px] text-left"
									onclick={() => selectMetric(m.id)}
								>
									<span
										class="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-[800]"
										style={m.current_version?.type === 'negative'
											? 'border:1.5px solid #dc2626;color:#dc2626'
											: 'border:1.5px solid #16a34a;color:#16a34a'}
										>{m.current_version?.type === 'negative' ? '×' : '+'}</span
									>
									<div class="min-w-0 flex-1">
										<div class="truncate text-[12px] font-medium text-[#1a1a1a]">
											{m.current_version?.name ?? m.slug}
										</div>
										<div class="mt-[1px] truncate text-[10px] text-[#9ca3af]">
											{m.benchmark.name} · {m.slug}
										</div>
									</div>
									<span
										class="flex-shrink-0 rounded-full px-2 py-[1px] text-[10px] font-bold"
										style={statusStyle(m.status)}>{statusLabel(m.status)}</span
									>
									{#if m.total_count > 0}
										<ScorePill
											score={m.total_count ? m.passed_count / m.total_count : 0}
											size="sm"
										/>
									{/if}
								</button>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- COL 3: Metric detail -->
			<div class="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
				{#if !selectedMetricId}
					<div class="flex h-full flex-col items-center justify-center gap-2 text-[#9ca3af]">
						<i class="fa-solid fa-arrow-left text-xl opacity-30"></i>
						<p class="text-[12px]">Select a metric to see its details.</p>
					</div>
				{:else if detailLoading}
					<div class="flex h-full items-center justify-center gap-2 text-[#9ca3af]">
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#00b3b0]"
						></div>
						<span class="text-[13px]">Loading metric…</span>
					</div>
				{:else if detailError}
					<p class="p-6 text-[13px] text-[#dc2626]">{detailError}</p>
				{:else if metricDetail}
					{@const v = metricDetail.current_version}
					<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 pt-[12px] pb-[10px]">
						<div
							class="mb-[3px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase"
						>
							{#if placements.taxonomy.length}
								{placements.taxonomy
									.map((t) => `${t.subarea.area.name} · ${t.subarea.name}`)
									.join(' · ')}
								<span class="text-[#c4c9d1] normal-case"> — {metricDetail.benchmark.name}</span>
							{:else}
								{metricDetail.benchmark.name} · {metricDetail.slug}
								<span class="text-[#c4c9d1] normal-case"> — not placed in the taxonomy yet</span>
							{/if}
						</div>
						<div class="flex items-start justify-between gap-3">
							<div class="text-[15px] leading-[1.3] font-[700] tracking-[-0.01em] text-[#1a1a1a]">
								{v.name}
							</div>
							<div class="flex flex-shrink-0 items-center gap-2 pt-[2px]">
								<span
									class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
									style={v.type === 'negative'
										? 'background:#fee2e2;color:#dc2626'
										: 'background:#dcfce7;color:#16a34a'}
								>
									<i
										class="fa-solid {v.type === 'negative'
											? 'fa-shield-halved'
											: 'fa-star'} text-[9px]"
									></i>
									{v.type === 'negative' ? 'Avoiding bad behavior' : 'Promoting good behavior'}
								</span>
								<span
									class="rounded-full px-2 py-[2px] text-[10px] font-bold"
									style={statusStyle(metricDetail.status)}>{statusLabel(metricDetail.status)}</span
								>
							</div>
						</div>
						<div class="mt-[8px] flex items-center gap-2">
							{#if !editing}
								<button
									class="rounded-[6px] border border-[#e5e7eb] px-3 py-[4px] text-[11px] font-semibold text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]"
									onclick={() => (editing = true)}
								>
									<i class="fa-solid fa-pen text-[9px]"></i> Edit
								</button>
							{/if}

							{#if metricDetail.status === 'draft'}
								<button
									class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[4px] text-[11px] font-semibold text-white hover:brightness-105"
									onclick={() => (actionModal = 'generate')}
								>
									<i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i> Generate Scenarios
								</button>
							{:else if metricDetail.status === 'ready_to_simulate'}
								<button
									class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[4px] text-[11px] font-semibold text-white hover:brightness-105"
									onclick={() => (actionModal = 'simulate')}
								>
									<i class="fa-solid fa-play text-[9px]"></i> Run Test Simulation
								</button>
								<span class="text-[10px] text-[#9ca3af]">with {TEST_SIMULATION_MODEL_LABEL}</span>
							{:else if metricDetail.status === 'ready_to_publish'}
								<button
									class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[4px] text-[11px] font-semibold text-white hover:brightness-105"
									onclick={() => (publishOpen = true)}
								>
									<i class="fa-solid fa-upload text-[9px]"></i> Publish
								</button>
							{/if}
						</div>
					</div>

					{#if editing}
						<MetricEditForm version={v} onCancel={() => (editing = false)} />
					{:else}
						<div class="flex-1 overflow-y-auto px-6 py-4">
							{#if v.contributor}
								<div class="mb-[14px] text-[13px] font-semibold text-[#1a1a1a]">
									Part of: {v.contributor}
								</div>
							{/if}

							<div
								class="mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
							>
								Description
							</div>
							<div
								class="mb-3 border-l-[2px] border-[#e5e7eb] pl-[10px] text-[12px] leading-[1.6] whitespace-pre-line text-[#4b5563]"
							>
								{v.definition}
							</div>

							{#if v.matters_because}
								<div
									class="mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
								>
									Why this matters
								</div>
								<div
									class="mb-5 border-l-[2px] border-[#e5e7eb] pl-[10px] text-[12px] leading-[1.6] whitespace-pre-line text-[#4b5563]"
								>
									{v.matters_because}
								</div>
							{/if}

							{#if v.examples.length}
								<div
									class="mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
								>
									Examples
								</div>
								<ul class="mb-5 list-disc space-y-1 pl-5 text-[12px] leading-[1.6] text-[#4b5563]">
									{#each v.examples as example (example)}
										<li>{example}</li>
									{/each}
								</ul>
							{/if}

							{#key selectedMetricId}
								<LiveRelationships
									{placements}
									suggestedPlacements={metricDetail.suggested_placements}
									areas={taxonomyAreas}
									subareas={taxonomySubareas}
								/>
							{/key}

							<VersionHistory current={v} />

							<StalenessBanner
								{staleCount}
								totalCount={metricDetail.scenarios.length}
								simulated={simulateStale}
								onToggleSimulate={() => (simulateStale = !simulateStale)}
								onRegenerate={() => (actionModal = 'regenerate')}
							/>

							<div
								class="mb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
							>
								Scenarios <span class="font-normal text-[#c4c9d1] normal-case"
									>({metricDetail.scenarios.length})</span
								>
							</div>
							{#each metricDetail.scenarios as scenario (scenario.id)}
								<div class="mb-2 rounded-[8px] border border-[#e5e7eb]">
									<button
										class="flex w-full items-center gap-[8px] px-3 py-[8px] text-left"
										onclick={() =>
											(expandedScenarioId =
												expandedScenarioId === scenario.id ? null : scenario.id)}
									>
										<div class="min-w-0 flex-1">
											<div class="truncate text-[12px] font-medium text-[#1a1a1a]">
												{scenario.title}
											</div>
											<div class="mt-[1px] flex items-center gap-[6px] text-[10px] text-[#9ca3af]">
												<span>{scenario.age === 'child' ? 'Child or teenager' : 'Adult'}</span>
												{#if scenario.source === 'submitted'}
													<span
														class="rounded-full px-[6px] py-[1px] font-bold"
														style="background:#fff7ed;color:#c2410c">Submitted</span
													>
												{/if}
											</div>
										</div>
										{#each scenario.conversations as conv (conv.id)}
											{#if conv.score}
												<span
													class="inline-flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-[800]"
													style={conv.score.passed
														? 'background:#dcfce7;color:#16a34a'
														: 'background:#fee2e2;color:#dc2626'}
													title={conv.model.display_name}>{conv.score.passed ? '✓' : '✗'}</span
												>
											{/if}
										{/each}
										<i
											class="fa-solid {expandedScenarioId === scenario.id
												? 'fa-chevron-up'
												: 'fa-chevron-down'} text-[8px] text-[#c4c9d1]"
										></i>
									</button>

									{#if expandedScenarioId === scenario.id}
										<div class="border-t border-[#f3f4f6] bg-[#f9fafb] px-3 py-3">
											{#if scenario.persona}
												<div class="mb-2 text-[11px] leading-[1.6] text-[#6b7280]">
													{scenario.persona}
												</div>
											{/if}
											{#each scenario.conversations as conv (conv.id)}
												<div class="mb-3 rounded-[6px] border border-[#e5e7eb] bg-white p-3">
													<div class="mb-2 flex items-center justify-between">
														<span class="text-[11px] font-semibold text-[#1a1a1a]"
															>{conv.model.display_name}</span
														>
														{#if conv.score}
															<span
																class="rounded-full px-[8px] py-[2px] text-[10px] font-bold"
																style={conv.score.passed
																	? 'background:#dcfce7;color:#16a34a'
																	: 'background:#fee2e2;color:#dc2626'}
																>{conv.score.passed ? 'Pass' : 'Fail'}</span
															>
														{/if}
													</div>
													{#if conv.score?.justification}
														<div class="prose prose-sm mb-2 max-w-none text-[12px] text-[#6b7280]">
															<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized markdown -->
															{@html safeMarkdownHtml(conv.score.justification)}
														</div>
													{/if}
													{#each conv.transcript as turn, i (i)}
														<div class="mb-2 {turn.role === 'user' ? 'text-right' : 'text-left'}">
															<div
																class="mb-1 text-[9px] font-semibold tracking-wide uppercase {turn.role ===
																'user'
																	? 'text-[#00b3b0]'
																	: 'text-[#9ca3af]'}"
															>
																{turn.role === 'user' ? 'User' : 'AI'}
															</div>
															<div
																class="prose prose-sm inline-block max-w-[88%] max-w-none rounded-xl px-3 py-2 text-left text-[12px] {turn.role ===
																'user'
																	? 'bg-[#e0f7f7] text-[#1a1a1a] prose-invert'
																	: 'bg-[#f3f4f6] text-[#374151]'}"
															>
																<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized markdown -->
																{@html safeMarkdownHtml(turn.content)}
															</div>
														</div>
													{/each}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<RegenerateModal
						open={actionModal !== null}
						title={actionModalConfig.title}
						description={actionModalConfig.description}
						phases={actionModalConfig.phases}
						doneTitle={actionModalConfig.doneTitle}
						seedTitles={actionModalConfig.seedTitles}
						onClose={() => (actionModal = null)}
						onDone={() => {
							if (actionModal === 'generate')
								applyStatusTransition([v.metric_id], 'ready_to_simulate');
							else if (actionModal === 'simulate')
								applyStatusTransition([v.metric_id], 'ready_to_publish');
						}}
					/>
					<PublishDiffModal
						open={publishOpen}
						version={v}
						benchmarkName={metricDetail.benchmark.name}
						onClose={() => (publishOpen = false)}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>

{#if massActionConfig}
	<MassActionModal
		open={massAction !== null}
		title={massActionConfig.title}
		description={massActionConfig.description}
		actionLabel={massActionConfig.actionLabel}
		items={massActionConfig.items}
		doneTitle={massActionConfig.doneTitle}
		onClose={closeMassAction}
		onDone={(ids) => applyStatusTransition(ids, massActionConfig.nextStatus)}
	/>
{/if}
