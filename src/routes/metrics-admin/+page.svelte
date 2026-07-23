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
		validateAdminKey
	} from '$lib/metrics-admin/db';
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
	import OpsRunsPanel from '$lib/components/metrics-admin/OpsRunsPanel.svelte';
	import type {
		Benchmark,
		MetricDetail,
		MetricListItem,
		MetricPlacements,
		MetricStatus,
		Model,
		NutritionCategory,
		TaxonomyArea,
		TaxonomySubarea
	} from '$lib/metrics-admin/types';

	type Phase = 'need-key' | 'validating' | 'ready' | 'invalid' | 'error';
	type Tab = 'dashboard' | 'wizard' | 'ops';
	type SortMode = 'name' | 'status' | 'score';

	let phase = $state<Phase>('need-key');
	let errorMessage = $state('');
	let keyInput = $state('');
	let activeTab = $state<Tab>('dashboard');

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
	let sortMode = $state<SortMode>('name');

	let selectedMetricId = $state<string | null>(null);
	let metricDetail = $state<MetricDetail | null>(null);
	let detailLoading = $state(false);
	let detailError = $state('');
	let expandedScenarioId = $state<string | null>(null);
	let placements = $state<MetricPlacements>({ taxonomy: [], nutrition: [] });
	let editing = $state(false);
	let simulateStale = $state(false);
	let publishOpen = $state(false);

	// Which workflow-action modal is open, if any. One shared modal
	// component (RegenerateModal) covers Generate Scenarios / Run Simulation
	// / Run Evaluation / Regenerate — only phases/copy differ.
	let actionModal = $state<null | 'generate' | 'simulate' | 'regenerate'>(null);

	const staleCount = $derived.by(() => {
		const detail = metricDetail;
		if (!detail) return 0;
		if (simulateStale) return detail.scenarios.length;
		return detail.scenarios.filter((s) => s.metric_version_id !== detail.current_version.id).length;
	});

	const actionModalConfig = $derived.by(() => {
		if (actionModal === 'generate') {
			return {
				title: 'Generating scenarios',
				doneTitle: 'Scenarios generated',
				description: 'Simulated for this demo — no pipeline was actually run.',
				phases: [{ key: 'gen_scenarios', label: 'Generating scenarios' }]
			};
		}
		if (actionModal === 'simulate') {
			return {
				title: 'Running simulation',
				doneTitle: 'Simulation complete',
				description: 'Simulated for this demo — no models were actually called.',
				phases: [{ key: 'simulate', label: 'Simulating conversations' }]
			};
		}
		return {
			title: 'Regenerating scenarios',
			doneTitle: 'Regeneration complete',
			description: `Simulated for this demo — ${staleCount} scenario${staleCount === 1 ? '' : 's'} would be regenerated. No pipeline was actually run.`,
			phases: [
				{ key: 'gen_scenarios', label: 'Generating scenarios' },
				{ key: 'simulate', label: 'Simulating conversations' },
				{ key: 'evaluate', label: 'Evaluating' }
			]
		};
	});

	const currentSubareasForFilter = $derived(
		selectedAreaId ? taxonomySubareas.filter((s) => s.area_id === selectedAreaId) : []
	);

	const filteredMetrics = $derived.by(() => {
		const list = metrics.filter((m) => {
			if (selectedBenchmarkSlug && m.benchmark.slug !== selectedBenchmarkSlug) return false;
			if (selectedStatus && m.status !== selectedStatus) return false;
			if (selectedSubareaId && !m.subareas.some((s) => s.subarea_id === selectedSubareaId)) return false;
			if (selectedAreaId && !selectedSubareaId && !m.subareas.some((s) => s.area_id === selectedAreaId))
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
			sorted.sort((a, b) => (a.current_version?.name ?? a.slug).localeCompare(b.current_version?.name ?? b.slug));
		} else if (sortMode === 'status') {
			sorted.sort((a, b) => a.status.localeCompare(b.status));
		} else {
			const rate = (m: MetricListItem) => (m.total_count ? m.passed_count / m.total_count : -1);
			sorted.sort((a, b) => rate(b) - rate(a));
		}
		return sorted;
	});

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
					{#each [['dashboard', 'Dashboard', 'fa-table-list'], ['wizard', 'New Metric', 'fa-wand-magic-sparkles'], ['ops', 'Models & Ops', 'fa-gears']] as [tab, label, icon] (tab)}
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
					Paste your admin capability key to view the metrics dashboard. The key is held in
					memory only — it is never saved, so you'll re-enter it after a reload.
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
	{:else if activeTab === 'wizard'}
		<div class="flex-1 overflow-y-auto">
			<NewMetricWizard {benchmarks} areas={taxonomyAreas} subareas={taxonomySubareas} {nutritionCategories} />
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
							>{filteredMetrics.length}<span class="text-[#c4c9d1]"> / {metrics.length}</span
							></span
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
						{#each ['draft', 'scenarios_generating', 'ready_to_simulate', 'evaluating', 'ready_to_publish', 'published'] as const as status (status)}
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
						<div
							class="px-4 pb-[5px] text-[10px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase"
						>
							Benchmark
						</div>
						<button
							class="w-full px-4 py-[5px] text-left text-[12px] transition-colors duration-100
								{selectedBenchmarkSlug === null
								? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
								: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
							onclick={() => (selectedBenchmarkSlug = null)}>All Benchmarks</button
						>
						{#each benchmarks as bm (bm.id)}
							<button
								class="w-full truncate px-4 py-[5px] text-left text-[12px] transition-colors duration-100
									{selectedBenchmarkSlug === bm.slug
									? 'bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
								title={bm.name}
								onclick={() => (selectedBenchmarkSlug = bm.slug)}>{bm.name}</button
							>
						{/each}
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
						{#each [['name', 'A–Z'], ['status', 'Status'], ['score', 'Score']] as [mode, label] (mode)}
							<button
								class="rounded-[10px] border-[1.5px] px-[8px] py-[2px] text-[10px] font-medium transition-all duration-150
									{sortMode === mode
									? 'border-[#80d8d7] bg-[#e0f7f7] font-semibold text-[#00b3b0]'
									: 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#9ca3af]'}"
								onclick={() => (sortMode = mode as SortMode)}>{label}</button
							>
						{/each}
					</div>
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
							<button
								class="flex w-full items-center gap-[10px] border-b border-[#f3f4f6] px-4 py-[9px] text-left
									{selectedMetricId === m.id ? 'bg-[#f3f4f6]' : 'hover:bg-[#f9fafb]'}"
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
									<ScorePill score={m.total_count ? m.passed_count / m.total_count : 0} size="sm" />
								{/if}
							</button>
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
						<div class="mb-[3px] text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af] uppercase">
							{#if placements.taxonomy.length}
								{placements.taxonomy.map((t) => `${t.subarea.area.name} · ${t.subarea.name}`).join(' · ')}
								<span class="normal-case text-[#c4c9d1]"> — {metricDetail.benchmark.name}</span>
							{:else}
								{metricDetail.benchmark.name} · {metricDetail.slug}
								<span class="normal-case text-[#c4c9d1]"> — not placed in the taxonomy yet</span>
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
										class="fa-solid {v.type === 'negative' ? 'fa-shield-halved' : 'fa-star'} text-[9px]"
									></i>
									{v.type === 'negative' ? 'Avoiding bad behavior' : 'Promoting good behavior'}
								</span>
								<span
									class="rounded-full px-2 py-[2px] text-[10px] font-bold"
									style={statusStyle(metricDetail.status)}
									>{statusLabel(metricDetail.status)}</span
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
							{:else if metricDetail.status === 'scenarios_generating'}
								<span class="inline-flex items-center gap-[6px] text-[11px] font-medium text-[#9ca3af]">
									<i class="fa-solid fa-spinner fa-spin"></i> Generating scenarios…
								</span>
							{:else if metricDetail.status === 'ready_to_simulate'}
								<button
									class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[4px] text-[11px] font-semibold text-white hover:brightness-105"
									onclick={() => (actionModal = 'simulate')}
								>
									<i class="fa-solid fa-play text-[9px]"></i> Run Simulation
								</button>
							{:else if metricDetail.status === 'evaluating'}
								<span class="inline-flex items-center gap-[6px] text-[11px] font-medium text-[#9ca3af]">
									<i class="fa-solid fa-spinner fa-spin"></i> Evaluating…
								</span>
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

							<div class="mb-[4px] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
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

							<div class="mb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
								Scenarios <span class="font-normal text-[#c4c9d1] normal-case"
									>({metricDetail.scenarios.length})</span
								>
							</div>
							{#each metricDetail.scenarios as scenario (scenario.id)}
								<div class="mb-2 rounded-[8px] border border-[#e5e7eb]">
									<button
										class="flex w-full items-center gap-[8px] px-3 py-[8px] text-left"
										onclick={() =>
											(expandedScenarioId = expandedScenarioId === scenario.id ? null : scenario.id)}
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
													title={conv.model.display_name}
													>{conv.score.passed ? '✓' : '✗'}</span
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
						onClose={() => (actionModal = null)}
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
