<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { formatScore, scoreToClass, scoreColors } from '$lib/scores';
	import { loadScenarioDetail } from '$lib/data';
	import { filterScenariosByAge, getScores } from '$lib/utils';
	import type { ScenarioMeta, ScenarioDetail } from '$lib/types';
	import ConversationViewer from '../organisms/ConversationViewer.svelte';
	import ScorePill from '../atoms/ScorePill.svelte';

	interface Props {
		onTabChange: (tab: string) => void;
	}

	let { onTabChange }: Props = $props();

	// ── Filter state ──────────────────────────────────────────────
	let selectedAreaId: string | null = $state(null);
	let selectedSubareaId: string | null = $state(null);
	let selectedBenchmark: string | null = $state(null);
	let searchQuery = $state('');
	let sortMode: 'score-desc' | 'score-asc' | 'name-asc' = $state('score-desc');
	let listMode: 'metrics' | 'scenarios' = $state('metrics');

	// ── Selection state ───────────────────────────────────────────
	let expandedMetricUid: string | null = $state(null);
	let selectedMetric: FlatMetric | null = $state(null);
	let selectedScenarioId: string | null = $state(null);
	let selectedMetricForScenario: FlatMetric | null = $state(null);

	// ── Conversation state ────────────────────────────────────────
	let viewingModelId: string = $state(appState.filters.model);
	let selectedScenarioBenchmark: string | null = $state(null);
	let conversationDetail: ScenarioDetail | null = $state(null);
	let conversationLoading = $state(false);
	let conversationError = $state(false);

	// ── Scroll-to refs ────────────────────────────────────────────
	let listEl: HTMLElement | undefined = $state();
	function scrollToRow(id: string) {
		if (!listEl) return;
		const el = listEl.querySelector(`[data-rowid="${id}"]`) as HTMLElement | null;
		if (!el) return;
		const top = el.offsetTop - listEl.offsetTop;
		const visible = listEl.clientHeight;
		const current = listEl.scrollTop;
		if (top < current || top + el.offsetHeight > current + visible) {
			listEl.scrollTo({ top: Math.max(0, top - 80), behavior: 'smooth' });
		}
	}

	// ── Deep link ─────────────────────────────────────────────────
	const _initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	const _deepMetric = _initialParams?.get('metric') ?? null;
	const _deepScenario = _initialParams?.get('scenario') ?? null;

	const allBenchmarks = $derived(() => {
		const set = new Set<string>();
		if (!appState.scenarioIndex) return [];
		for (const scenarios of Object.values(appState.scenarioIndex))
			for (const sc of scenarios) set.add(sc.benchmark);
		return [...set].sort();
	});

	const metricBenchmarks = $derived(() => {
		const map: Record<string, Set<string>> = {};
		if (!appState.scenarioIndex) return map;
		for (const [metricId, scenarios] of Object.entries(appState.scenarioIndex))
			map[metricId] = new Set(scenarios.map((s) => s.benchmark));
		return map;
	});

	interface FlatMetric {
		uid: string;
		id: string;
		name: string;
		harmful: boolean;
		behavior_type?: 'flourishing' | 'restrain_harm';
		measurement?: 'presence' | 'absence';
		areaId: string;
		areaName: string;
		areaIcon: string;
		subareaId: string;
		subareaName: string;
		avgScore: number;
		benchmarks: string[];
	}

	const allMetrics = $derived((): FlatMetric[] => {
		if (!appState.taxonomy) return [];
		const mb = metricBenchmarks();
		const result: FlatMetric[] = [];
		for (const area of appState.taxonomy.areas)
			for (const sub of area.subareas)
				for (const m of sub.metrics) {
					// average across all models for current age
					const vals = appState.models
						.map((mo) => getScores(appState, mo.id, appState.filters.age)[m.id])
						.filter((v): v is number => v !== undefined);
					const avgScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
					result.push({
						uid: `${sub.id}:${m.id}`,
						id: m.id,
						name: m.name,
						harmful: m.harmful,
						behavior_type: m.behavior_type,
						measurement: m.measurement,
						areaId: area.id,
						areaName: area.name,
						areaIcon: area.icon,
						subareaId: sub.id,
						subareaName: sub.name,
						avgScore,
						benchmarks: mb[m.id] ? [...mb[m.id]] : []
					});
				}
		return result;
	});

	const filtered = $derived((): FlatMetric[] => {
		let list = allMetrics();
		if (selectedAreaId) list = list.filter((m) => m.areaId === selectedAreaId);
		if (selectedSubareaId) list = list.filter((m) => m.subareaId === selectedSubareaId);
		if (selectedBenchmark) list = list.filter((m) => m.benchmarks.includes(selectedBenchmark!));
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			if (listMode === 'scenarios') {
				list = list.filter((m) =>
					m.name.toLowerCase().includes(q) ||
					getScenariosForMetric(m.id).some((sc) => sc.title.toLowerCase().includes(q))
				);
			} else {
				list = list.filter((m) => m.name.toLowerCase().includes(q) || m.subareaName.toLowerCase().includes(q));
			}
		}
		if (sortMode === 'score-desc') return [...list].sort((a, b) => b.avgScore - a.avgScore);
		if (sortMode === 'score-asc') return [...list].sort((a, b) => a.avgScore - b.avgScore);
		return [...list].sort((a, b) => a.name.localeCompare(b.name));
	});

	const currentSubareas = $derived(() => {
		if (!selectedAreaId || !appState.taxonomy) return [];
		return appState.taxonomy.areas.find((a) => a.id === selectedAreaId)?.subareas ?? [];
	});

	// ── Scenario helpers ──────────────────────────────────────────

	function getScenariosForMetric(metricId: string): ScenarioMeta[] {
		return filterScenariosByAge(appState, metricId);
	}

	function selectMetric(m: FlatMetric) {
		if (expandedMetricUid === m.uid) {
			expandedMetricUid = null;
			selectedMetric = null;
		} else {
			expandedMetricUid = m.uid;
			selectedMetric = m;
			selectedScenarioId = null;
			selectedMetricForScenario = null;
			conversationDetail = null;
			setTimeout(() => scrollToRow(m.uid), 50);
		}
	}

	// Resolve deep link once allMetrics is populated
	$effect(() => {
		if (!_deepMetric || !allMetrics().length) return;
		const m = allMetrics().find((x) => x.id === _deepMetric);
		if (!m) return;
		expandedMetricUid = m.uid;
		selectedMetric = m;
		if (_deepScenario) {
			const scenarios = getScenariosForMetric(m.id);
			const sc = scenarios.find((s) => s.scenario_id === _deepScenario);
			if (sc) {
				selectScenario(m, sc);
			}
		}
		setTimeout(() => scrollToRow(_deepScenario ?? m.uid), 100);
	});

	function loadConversation(benchmark: string, scenarioId: string, modelId: string) {
		conversationDetail = null;
		conversationLoading = true;
		conversationError = false;
		loadScenarioDetail(benchmark, modelId, scenarioId)
			.then((d) => { conversationDetail = d; conversationLoading = false; })
			.catch(() => { conversationLoading = false; conversationError = true; });
	}

	function selectScenario(m: FlatMetric, sc: ScenarioMeta) {
		expandedMetricUid = m.uid;
		selectedMetric = m;
		selectedScenarioId = sc.scenario_id;
		selectedScenarioBenchmark = sc.benchmark;
		selectedMetricForScenario = m;
		viewingModelId = appState.filters.model;
		loadConversation(sc.benchmark, sc.scenario_id, viewingModelId);
		setTimeout(() => scrollToRow(sc.scenario_id), 50);
	}

	function switchModel(modelId: string) {
		viewingModelId = modelId;
		if (selectedScenarioId && selectedScenarioBenchmark) {
			loadConversation(selectedScenarioBenchmark, selectedScenarioId, modelId);
		}
	}

	function selectArea(id: string | null) {
		selectedAreaId = id;
		selectedSubareaId = null;
	}

	let copiedId = $state<string | null>(null);

	function copyLink(params: Record<string, string>, id: string, e: MouseEvent) {
		e.stopPropagation();
		const url = new URL(window.location.href);
		url.search = '';
		url.searchParams.set('tab', 'metrics');
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		navigator.clipboard.writeText(url.toString()).then(() => {
			copiedId = id;
			setTimeout(() => { copiedId = null; }, 2000);
		}).catch(() => {});
	}

	function benchmarkLabel(slug: string): string {
		return slug
			.replace(/-/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase())
			.replace(/\bAi\b/g, 'AI')
			.replace(/\bLlm\b/g, 'LLM');
	}
</script>

<div class="flex h-full w-full overflow-hidden bg-[#fafaf9]">

	<!-- ── COL 1: Filter sidebar ──────────────────────────────── -->
	<aside class="w-[220px] flex-shrink-0 bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden">

		<!-- Header -->
		<div class="px-4 pt-[14px] pb-[10px] border-b border-[#f3f4f6]">
			<div class="flex items-baseline justify-between">
				<h2 class="text-[13px] font-[800] text-[#1a1a1a] tracking-[-0.01em]">Filters</h2>
				<span class="text-[11px] text-[#9ca3af]">{filtered().length}<span class="text-[#c4c9d1]"> / {allMetrics().length}</span></span>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto">

			<!-- ── Area / Subarea section ── -->
			<div class="pt-2 pb-1">
				<div class="px-4 pb-[5px] text-[10px] font-[700] uppercase tracking-[0.08em] text-[#b0b8c4]">Area</div>
				<button
					class="w-full text-left flex items-center gap-[7px] px-4 py-[5px] text-[12px] transition-colors duration-100
						{selectedAreaId === null ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
					onclick={() => selectArea(null)}
				>
					<i class="fa-solid fa-layer-group text-[10px] flex-shrink-0 opacity-60"></i>
					All Areas
				</button>
				{#each appState.taxonomy?.areas ?? [] as area (area.id)}
					<button
						class="w-full text-left flex items-center gap-[7px] px-4 py-[5px] text-[12px] transition-colors duration-100
							{selectedAreaId === area.id ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
						onclick={() => selectArea(area.id)}
					>
						<i class="fa-solid {area.icon} text-[10px] flex-shrink-0 opacity-60"></i>
						{area.name}
					</button>
				{/each}
			</div>

			{#if selectedAreaId && currentSubareas().length > 0}
				<div class="pt-1 pb-1 border-t border-[#f3f4f6] mt-1">
					<div class="px-4 py-[5px] text-[10px] font-[700] uppercase tracking-[0.08em] text-[#b0b8c4]">Subarea</div>
					<button
						class="w-full text-left px-4 py-[5px] text-[12px] transition-colors duration-100
							{selectedSubareaId === null ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
						onclick={() => (selectedSubareaId = null)}
					>All Subareas</button>
					{#each currentSubareas() as sub (sub.id)}
						<button
							class="w-full text-left flex items-center gap-[7px] px-4 py-[5px] text-[12px] transition-colors duration-100
								{selectedSubareaId === sub.id ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
							onclick={() => (selectedSubareaId = sub.id)}
						>
							<i class="fa-solid {sub.icon} text-[10px] flex-shrink-0 opacity-60"></i>
							<span class="truncate">{sub.name}</span>
						</button>
					{/each}
				</div>
			{/if}

			<!-- ── Benchmark section — visually separated ── -->
			<div class="border-t-[4px] border-[#f3f4f6] mt-2 pt-2 pb-3">
				<div class="px-4 pb-[5px] text-[10px] font-[700] uppercase tracking-[0.08em] text-[#b0b8c4]">Benchmark</div>
				<button
					class="w-full text-left px-4 py-[5px] text-[12px] transition-colors duration-100
						{selectedBenchmark === null ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
					onclick={() => (selectedBenchmark = null)}
				>All Benchmarks</button>
				{#each allBenchmarks() as bm (bm)}
					<button
						class="w-full text-left px-4 py-[5px] text-[12px] transition-colors duration-100 truncate
							{selectedBenchmark === bm ? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold' : 'text-[#4b5563] hover:bg-[#f3f4f6]'}"
						title={benchmarkLabel(bm)}
						onclick={() => (selectedBenchmark = bm)}
					>{benchmarkLabel(bm)}</button>
				{/each}
			</div>

		</div>
	</aside>

	<!-- ── COL 2: Metric / scenario listing ───────────────────── -->
	<div class="flex-1 border-r border-[#e5e7eb] bg-white flex flex-col overflow-hidden min-w-0">

		<!-- Toolbar -->
		<div class="flex-shrink-0 bg-white border-b border-[#e5e7eb] px-4 py-[9px] flex flex-col gap-[7px]">
			<!-- Search -->
			<div class="relative">
				<i class="fa-solid fa-magnifying-glass absolute left-[8px] top-1/2 -translate-y-1/2 text-[10px] text-[#b0b8c4]"></i>
				<input
					type="text"
					placeholder={listMode === 'scenarios' ? 'Search scenarios…' : 'Search metrics…'}
					bind:value={searchQuery}
					class="w-full pl-[24px] pr-3 py-[5px] text-[12px] border-[1.5px] border-[#e5e7eb] rounded-[6px] bg-[#fafaf9] text-[#1a1a1a] outline-none transition-[border-color] duration-150 focus:border-[#00b3b0] focus:bg-white placeholder:text-[#b0b8c4]"
				/>
			</div>
			<!-- View toggle + sort -->
			<div class="flex items-center gap-[5px]">
				<button
					class="px-[10px] py-[3px] rounded-[6px] text-[11px] font-semibold border-[1.5px] transition-all duration-150 cursor-pointer
						{listMode === 'metrics' ? 'bg-[#e0f7f7] border-[#00b3b0] text-[#00b3b0]' : 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
					onclick={() => { listMode = 'metrics'; expandedMetricUid = null; }}
				>Metrics</button>
				<button
					class="px-[10px] py-[3px] rounded-[6px] text-[11px] font-semibold border-[1.5px] transition-all duration-150 cursor-pointer
						{listMode === 'scenarios' ? 'bg-[#e0f7f7] border-[#00b3b0] text-[#00b3b0]' : 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
					onclick={() => { listMode = 'scenarios'; }}
				>Scenarios</button>
				<div class="flex-1"></div>
				{#each [['score-desc','Score ↓'],['score-asc','Score ↑'],['name-asc','A–Z']] as [mode, label] (mode)}
					<button
						class="text-[10px] font-medium px-[8px] py-[2px] rounded-[10px] border-[1.5px] cursor-pointer transition-all duration-150
							{sortMode === mode ? 'bg-[#e0f7f7] border-[#80d8d7] text-[#00b3b0] font-semibold' : 'bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
						onclick={() => (sortMode = mode as typeof sortMode)}
					>{label}</button>
				{/each}
			</div>
		</div>

		<!-- List -->
		<div class="flex-1 overflow-y-auto" bind:this={listEl}>
			{#if filtered().length === 0}
				<div class="flex flex-col items-center justify-center h-full gap-2 text-[#9ca3af]">
					<i class="fa-solid fa-magnifying-glass text-xl opacity-30"></i>
					<p class="text-[12px]">No metrics match your filters.</p>
				</div>
			{:else if listMode === 'metrics'}
				{#each filtered() as m (m.uid)}
					<div class="border-b border-[#f3f4f6]" data-rowid={m.uid}>
						<div class="group flex items-center {expandedMetricUid === m.uid ? 'bg-[#f3f4f6]' : 'hover:bg-[#f9fafb]'}">
							<button
								class="flex flex-1 min-w-0 items-center gap-[10px] px-4 py-[9px] text-left cursor-pointer border-none bg-transparent"
								onclick={() => selectMetric(m)}
							>
								<span
									class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] font-[800] flex-shrink-0 leading-none"
									style={m.harmful ? 'border:1.5px solid #dc2626;color:#dc2626' : 'border:1.5px solid #16a34a;color:#16a34a'}
								>{m.harmful ? '×' : '+'}</span>
								<div class="flex-1 min-w-0">
									<div class="text-[12px] font-medium text-[#1a1a1a] truncate">{m.name}</div>
									<div class="text-[10px] text-[#9ca3af] truncate mt-[1px]">{m.subareaName}{m.benchmarks.length ? ' · ' + m.benchmarks.map(benchmarkLabel).join(', ') : ''}</div>
								</div>
							</button>
							<div class="relative flex-shrink-0 pr-1">
								<button
									class="flex items-center justify-center rounded p-[3px] text-[#9ca3af] transition-colors duration-150 hover:text-[#00b3b0] cursor-pointer border-none bg-transparent"
									title="Copy link to this metric"
									onclick={(e) => copyLink({ metric: m.id }, m.id, e)}
								>
									<i class="fa-solid {copiedId === m.id ? 'fa-check text-[#16a34a]' : 'fa-link'} text-[9px]"></i>
								</button>
								{#if copiedId === m.id}
									<div class="absolute bottom-full right-0 mb-[5px] whitespace-nowrap rounded-[5px] bg-[#1a1a1a] px-[8px] py-[4px] text-[11px] font-medium text-white shadow-md pointer-events-none z-50">
										Link copied!
										<div class="absolute top-full right-2 border-[4px] border-transparent border-t-[#1a1a1a]"></div>
									</div>
								{/if}
							</div>
							<ScorePill score={m.avgScore} size="sm" />
							<button
								class="flex-shrink-0 pl-2 pr-3 py-[9px] cursor-pointer border-none bg-transparent"
								onclick={() => selectMetric(m)}
							>
								<i class="fa-solid {expandedMetricUid === m.uid ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px] text-[#c4c9d1]"></i>
							</button>
						</div>

						{#if expandedMetricUid === m.uid}
							{@const scenarios = getScenariosForMetric(m.id)}
							<div class="bg-[#f9fafb] pb-1">
								{#if scenarios.length === 0}
									<p class="text-[11px] text-[#9ca3af] px-[36px] py-2">No scenarios available.</p>
								{:else}
									{#each scenarios as sc (sc.scenario_id)}
										{@const verdicts = sc.verdicts ?? {}}
										{@const total = appState.models.length}
										{@const passed = appState.models.filter((mo) => {
											const v = verdicts[mo.id];
											return v !== undefined && (m.harmful ? v === 'no' : v === 'yes');
										}).length}
										<div class="group flex items-center transition-colors duration-150 {selectedScenarioId === sc.scenario_id ? 'bg-[#e0f7f7]' : 'hover:bg-[#f3f4f6]'}" data-rowid={sc.scenario_id}>
											<button
												class="flex flex-1 min-w-0 items-center gap-[8px] pl-[36px] py-[7px] text-left cursor-pointer border-none bg-transparent"
												onclick={() => selectScenario(m, sc)}
											>
												<span class="flex-1 text-[11px] text-[#374151] min-w-0 truncate">{sc.title}</span>
												<span class="text-[11px] font-semibold flex-shrink-0 tabular-nums"
													style={passed / total >= 0.75 ? 'color:#16a34a' : passed / total >= 0.45 ? 'color:#d97706' : 'color:#dc2626'}
												>{passed}<span class="font-normal text-[#9ca3af]">/{total}</span></span>
											</button>
											<div class="relative flex-shrink-0 px-2">
												<button
													class="flex items-center justify-center rounded p-[3px] text-[#9ca3af] transition-colors duration-150 hover:text-[#00b3b0] cursor-pointer border-none bg-transparent"
													title="Copy link to this scenario"
													onclick={(e) => copyLink({ metric: m.id, scenario: sc.scenario_id }, sc.scenario_id, e)}
												>
													<i class="fa-solid {copiedId === sc.scenario_id ? 'fa-check text-[#16a34a]' : 'fa-link'} text-[9px]"></i>
												</button>
												{#if copiedId === sc.scenario_id}
													<div class="absolute bottom-full right-0 mb-[5px] whitespace-nowrap rounded-[5px] bg-[#1a1a1a] px-[8px] py-[4px] text-[11px] font-medium text-white shadow-md pointer-events-none z-50">
														Link copied!
														<div class="absolute top-full right-2 border-[4px] border-transparent border-t-[#1a1a1a]"></div>
													</div>
												{/if}
											</div>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				{/each}

			{:else}
				<!-- Scenario list mode: flat list of all scenarios grouped by metric -->
				{#each filtered() as m (m.uid)}
					{@const scenarios = getScenariosForMetric(m.id)}
					{#each scenarios as sc (sc.scenario_id + m.uid)}
						{@const verdicts = sc.verdicts ?? {}}
						{@const total = appState.models.length}
						{@const passed = appState.models.filter((mo) => {
							const v = verdicts[mo.id];
							return v !== undefined && (m.harmful ? v === 'no' : v === 'yes');
						}).length}
						<div class="group flex items-center border-b border-[#f3f4f6] transition-colors duration-150
							{selectedScenarioId === sc.scenario_id && selectedMetricForScenario?.uid === m.uid ? 'bg-[#e0f7f7] border-l-[3px] border-l-[#00b3b0]' : 'border-l-[3px] border-l-transparent hover:bg-[#f3f4f6]'}" data-rowid={sc.scenario_id}>
							<button
								class="flex flex-1 min-w-0 items-center gap-[8px] px-4 py-[8px] text-left cursor-pointer border-none bg-transparent"
								onclick={() => selectScenario(m, sc)}
							>
								<div class="flex-1 min-w-0">
									<div class="text-[12px] font-medium text-[#1a1a1a] truncate">{sc.title}</div>
									<div class="text-[10px] text-[#9ca3af] truncate mt-[1px]">{m.name}</div>
								</div>
								<span class="text-[11px] font-semibold flex-shrink-0 tabular-nums"
									style={passed / total >= 0.75 ? 'color:#16a34a' : passed / total >= 0.45 ? 'color:#d97706' : 'color:#dc2626'}
								>{passed}<span class="font-normal text-[#9ca3af]">/{total}</span></span>
							</button>
							<div class="relative flex-shrink-0 pr-2">
								<button
									class="flex items-center justify-center rounded p-[3px] text-[#9ca3af] transition-colors duration-150 hover:text-[#00b3b0] cursor-pointer border-none bg-transparent"
									title="Copy link to this scenario"
									onclick={(e) => copyLink({ metric: m.id, scenario: sc.scenario_id }, sc.scenario_id, e)}
								>
									<i class="fa-solid {copiedId === sc.scenario_id ? 'fa-check text-[#16a34a]' : 'fa-link'} text-[9px]"></i>
								</button>
								{#if copiedId === sc.scenario_id}
									<div class="absolute bottom-full right-0 mb-[5px] whitespace-nowrap rounded-[5px] bg-[#1a1a1a] px-[8px] py-[4px] text-[11px] font-medium text-white shadow-md pointer-events-none z-50">
										Link copied!
										<div class="absolute top-full right-2 border-[4px] border-transparent border-t-[#1a1a1a]"></div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/each}
			{/if}
		</div>
	</div>

	<!-- ── COL 3: Right panel ────────────────────────────────── -->
	<div class="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
		{#if selectedScenarioId && (conversationDetail || conversationLoading || conversationError)}
			<!-- Conversation view -->
			<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 pt-[12px] pb-[10px]">
				{#if selectedMetricForScenario}
					<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[3px]">
						{selectedMetricForScenario.subareaName}
					</div>
					<div class="text-[14px] font-[700] text-[#1a1a1a] tracking-[-0.01em] leading-[1.3] mb-[3px]">
						{conversationDetail ? conversationDetail.user_goal : '…'}
					</div>
					<div class="flex items-center gap-2 mt-[4px]">
						<span class="text-[11px] text-[#9ca3af]">{selectedMetricForScenario.name}</span>
						<span class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold" style="{selectedMetricForScenario.harmful ? 'background:#fee2e2;color:#dc2626' : 'background:#dcfce7;color:#16a34a'}">
							<i class="fa-solid {selectedMetricForScenario.harmful ? 'fa-shield-halved' : 'fa-star'} text-[9px]"></i>
							{selectedMetricForScenario.harmful ? 'Avoiding bad behavior' : 'Promoting good behavior'}
						</span>
					</div>
				{/if}
			</div>
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if selectedMetricForScenario}
					{@const _scVerdict = appState.scenarioIndex?.[selectedMetricForScenario.id]?.find(sc => sc.scenario_id === selectedScenarioId)?.verdicts?.[viewingModelId] ?? null}
					<ConversationViewer
						metricId={selectedMetricForScenario.id}
						metricName={selectedMetricForScenario.name}
						subareaName={selectedMetricForScenario.subareaName}
						behaviorType={selectedMetricForScenario.behavior_type}
						measurement={selectedMetricForScenario.measurement}
						scenarioDetail={conversationDetail}
						loading={conversationLoading}
						error={conversationError}
						showModelSwitcher={true}
						{viewingModelId}
						scenarioId={selectedScenarioId ?? ''}
						onSwitchModel={switchModel}
						verdictOverride={_scVerdict}
					/>
				{/if}
			</div>

		{:else if selectedMetric}
			<!-- Metric detail view -->
			{@const mScenarios = getScenariosForMetric(selectedMetric.id)}
			{@const mCriteria = appState.metricCriteria?.[selectedMetric.id]}
			<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 pt-[12px] pb-[10px]">
				<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[3px]">
					{selectedMetric.subareaName} · {selectedMetric.areaName}
				</div>
				<div class="flex items-start justify-between gap-3">
					<div class="text-[15px] font-[700] text-[#1a1a1a] tracking-[-0.01em] leading-[1.3]">
						{selectedMetric.name}
					</div>
					<div class="flex-shrink-0 flex items-center gap-2 pt-[2px]">
						<span class="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
							style={selectedMetric.harmful ? 'background:#fee2e2;color:#dc2626' : 'background:#dcfce7;color:#16a34a'}>
							<i class="fa-solid {selectedMetric.harmful ? 'fa-shield-halved' : 'fa-star'} text-[9px]"></i>
							{selectedMetric.harmful ? 'Avoiding bad behavior' : 'Promoting good behavior'}
						</span>
						<ScorePill score={selectedMetric.avgScore} />
					</div>
				</div>
				{#if selectedMetric.benchmarks.length}
					<div class="mt-[6px] text-[11px] text-[#9ca3af]">{selectedMetric.benchmarks.map(benchmarkLabel).join(', ')}</div>
				{/if}
			</div>
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if mCriteria}
					<div class="mb-5 border-l-[2px] border-[#e5e7eb] pl-[10px] text-[12px] leading-[1.6] whitespace-pre-line text-[#6b7280]">
						{mCriteria}
					</div>
				{/if}
				{#if mScenarios.length}
					<div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">
						Scenarios <span class="font-normal normal-case text-[#c4c9d1]">({mScenarios.length})</span>
					</div>
					{#each mScenarios as sc (sc.scenario_id)}
						{@const verdicts = sc.verdicts ?? {}}
						{@const total = appState.models.length}
						{@const passed = appState.models.filter((mo) => {
							const v = verdicts[mo.id];
							const harmful = selectedMetric!.harmful;
							return v !== undefined && (harmful ? v === 'no' : v === 'yes');
						}).length}
						{@const rawResult = verdicts[appState.filters.model]}
						{@const isHarmful = selectedMetric!.behavior_type === 'restrain_harm' && selectedMetric!.measurement === 'presence'}
						{@const pass = rawResult === undefined ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
						<button
							class="flex w-full items-center gap-[8px] border-l-[3px] px-[4px] py-[7px] text-left transition-colors duration-150
								{selectedScenarioId === sc.scenario_id ? 'border-l-[#00b3b0] bg-[#e0f7f7]' : 'border-l-transparent hover:bg-[#f9fafb]'}"
							onclick={() => selectScenario(selectedMetric!, sc)}
						>
							{#if pass !== null}
								<span class="inline-flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-[800] leading-none"
									style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}>{pass ? '✓' : '✗'}</span>
							{:else}
								<span class="h-[16px] w-[16px] flex-shrink-0 rounded-full bg-[#f3f4f6]"></span>
							{/if}
							<span class="min-w-0 flex-1 text-[12px] text-ellipsis truncate text-[#374151]">{sc.title}</span>
							<span class="text-[11px] font-semibold flex-shrink-0 tabular-nums"
								style={passed / total >= 0.75 ? 'color:#16a34a' : passed / total >= 0.45 ? 'color:#d97706' : 'color:#dc2626'}
							>{passed}<span class="font-normal text-[#9ca3af]">/{total}</span></span>
							<i class="fa-solid fa-chevron-right flex-shrink-0 text-[9px] text-[#9ca3af] pr-1"></i>
						</button>
					{/each}
				{:else}
					<p class="text-[12px] text-[#9ca3af]">No scenarios available for this metric.</p>
				{/if}
			</div>

		{:else}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center h-full gap-3 text-[#9ca3af]">
				<i class="fa-solid fa-list-check text-3xl opacity-20"></i>
				<p class="text-[13px] font-medium">Select a metric to explore</p>
				<p class="text-[11px] opacity-70">Click a row in the list to see details and scenarios</p>
			</div>
		{/if}
	</div>

</div>
