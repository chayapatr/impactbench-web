<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTaxonomy, loadModels, loadBenchmarkData, loadScenarioIndex, buildHierarchy, getScoresForFilter, buildSubareaDetail } from '$lib/data';
	import {
		appState,
		setData,
		setFilters,
		setScenarioIndex,
		sidebarState,
		sidebarNavigateToArea,
		sidebarNavigateToSubarea,
		sidebarNavigateToMetric,
		sidebarNavigateToThemeMetrics,
		leaderboardState,
		smartNutritionState,
		type ThemeMetricItem
	} from '$lib/store.svelte';
	import { makeBenchmarkKey } from '$lib/data';
	import ControlBar from '$lib/components/ControlBar.svelte';
	import Sunburst from '$lib/components/Sunburst.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Leaderboard from '$lib/components/Leaderboard.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import NutritionLabel from '$lib/components/NutritionLabel.svelte';
	import SmartExplore from '$lib/components/SmartExplore.svelte';
	import GatePage from '$lib/components/GatePage.svelte';
	import AboutPage from '$lib/components/AboutPage.svelte';
	import MetricsPage from '$lib/components/MetricsPage.svelte';

	let showGate = $state(true);
	let activeTab = $state('explore');
	let smartExploreOpen = $state(false);
	let smartExploreLoading = $state(false);

	let sunburstRef: Sunburst | undefined = $state();

	// Sync sunburst focus with sidebar nav stack
	$effect(() => {
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		if (top.type === 'overview') {
			sunburstRef?.clearFocus();
		} else if (top.type === 'area') {
			sunburstRef?.focusNode(top.areaId, 'area');
		} else if (top.type === 'subarea') {
			sunburstRef?.focusNode(top.subareaId, 'subarea');
		}
	});

	// Derived hierarchy data for sunburst
	const hierarchyData = $derived(
		appState.taxonomy && !appState.loading
			? buildHierarchy(appState.taxonomy, getScoresForFilter(appState.benchmarkData, appState.filters))
			: null
	);

	onMount(async () => {
		// Check gate
		if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('aib-auth') === '1') {
			showGate = false;
		}

		try {
			const [taxonomy, models, benchmarkData] = await Promise.all([
				loadTaxonomy(),
				loadModels(),
				loadBenchmarkData()
			]);
			setData(taxonomy, models, benchmarkData);

			// Load scenario index in background
			loadScenarioIndex().then(setScenarioIndex).catch(() => {});

			// Wire up global window callbacks for the smart-explore inline script (backwards compat)
			const w = window as unknown as Record<string, unknown>;
			w.__openSubarea = handleSubareaClick;
			w.__openMetric = (id: string) => {
				if (appState.taxonomy) sidebarNavigateToMetric(id, appState.taxonomy);
			};
			w.__renderSmartRankings = renderSmartRankings;
			w.__restoreNormalRankings = restoreNormalRankings;
			w.__openThemeMetrics = (name: string, desc: string, metrics: ThemeMetricItem[]) =>
				sidebarNavigateToThemeMetrics(name, desc, metrics);
			w.__getSmartRanked = () => leaderboardState.smartRanked;
			w.__getBenchmarkScores = () =>
				appState.benchmarkData[makeBenchmarkKey(appState.filters.model, appState.filters.age)] ?? {};
			w.__getWorstSubareas = getWorstSubareasForModel;
			w.__getConstructScores = getConstructScoresForModel;
			w.__openSmartNutritionLabel = (opts: typeof smartNutritionState.opts) => {
				if (opts) {
					smartNutritionState.opts = opts;
					smartNutritionState.activeModelIdx = 0;
					smartExploreOpen = true;
				}
			};
		} catch (err) {
			appState.error = (err as Error).message;
			appState.loading = false;
		}
	});

	// ===== Event Handlers =====

	function handleSubareaClick(subareaId: string) {
		if (!appState.taxonomy) return;
		sidebarNavigateToSubarea(subareaId, appState.taxonomy);
	}

	function handleAreaClick(areaId: string) {
		sidebarNavigateToArea(areaId);
	}

	function handleCenterClick() {
		sunburstRef?.resetZoom();
		sidebarState.navStack = [{ type: 'overview' }];
	}

	function handleLeaderboardModelSelect(modelId: string) {
		setFilters({ ...appState.filters, model: modelId });
	}

	function handleSmartExploreSubmit(text: string) {
		// The smart-explore module (inline script from old app) expects a window function.
		// In this Svelte port we emit the query to the global handler if present,
		// or show a fallback. The inline script from the old index.html is the AI-calling layer.
		const w = window as unknown as Record<string, unknown>;
		if (typeof w.__runSmartExplore === 'function') {
			smartExploreLoading = true;
			(w.__runSmartExplore as (t: string) => void)(text);
			// loading cleared when __openSmartNutritionLabel is called
			setTimeout(() => { smartExploreLoading = false; }, 8000);
		}
	}

	// ===== Leaderboard helpers =====

	function renderSmartRankings(metricIds: string[]) {
		const ranked = appState.models
			.map((m) => {
				const key = makeBenchmarkKey(m.id, appState.filters.age);
				const scores = appState.benchmarkData[key];
				if (!scores || !metricIds.length) return { model: m, avg: 0 };
				const vals = metricIds.map((id) => scores[id] ?? null).filter((v) => v !== null) as number[];
				const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
				return { model: m, avg };
			})
			.sort((a, b) => b.avg - a.avg);

		leaderboardState.smartRanked = ranked.map(({ model, avg }) => ({
			id: model.id,
			name: model.name,
			provider: model.provider,
			score: avg
		}));
	}

	function restoreNormalRankings() {
		leaderboardState.smartRanked = [];
	}

	function getWorstSubareasForModel(modelId: string, count = 3): { name: string; score: number }[] {
		const key = makeBenchmarkKey(modelId, appState.filters.age);
		const scores = appState.benchmarkData[key];
		if (!scores || !appState.taxonomy) return [];

		const allMetrics: { id: string; name: string; score: number }[] = [];
		for (const area of appState.taxonomy.areas)
			for (const sub of area.subareas)
				for (const m of sub.metrics) {
					const s = scores[m.id] ?? null;
					if (s !== null) allMetrics.push({ id: m.id, name: m.name, score: s });
				}

		allMetrics.sort((a, b) => a.score - b.score);
		const seen = new Set<string>();
		const result: { name: string; score: number }[] = [];
		for (const m of allMetrics) {
			if (seen.has(m.id)) continue;
			seen.add(m.id);
			result.push({ name: m.name, score: m.score });
			if (result.length >= count) break;
		}
		return result;
	}

	function getConstructScoresForModel(modelId: string, themeMetricIds: string[][]): number[] {
		const key = makeBenchmarkKey(modelId, appState.filters.age);
		const scores = appState.benchmarkData[key];
		if (!scores) return themeMetricIds.map(() => 0);
		return themeMetricIds.map((ids) => {
			const vals = ids.map((id) => scores[id] ?? null).filter((v) => v !== null) as number[];
			return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
		});
	}

	function handleTabChange(tab: string) {
		if (tab === 'home') {
			showGate = true;
		} else {
			activeTab = tab;
			showGate = false;
		}
	}
</script>

<svelte:head>
	<title>Human-AI Impact Bench</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Serif+Pro:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
		crossorigin="anonymous"
	/>
</svelte:head>

{#if showGate}
	<GatePage
		onEnter={() => { showGate = false; activeTab = 'explore'; }}
		onTabChange={(tab) => { showGate = false; activeTab = tab; }}
	/>
{:else}
	<div class="h-screen overflow-hidden flex flex-col bg-[#fafaf9]" style="font-family:'Inter',system-ui,-apple-system,sans-serif">
		<ControlBar
			{activeTab}
			onTabChange={handleTabChange}
			onSmartExplore={() => (smartExploreOpen = true)}
		/>

		<!-- Beta banner (below navbar) -->
		<div class="flex-shrink-0 bg-[#fef9c3] border-b border-[#fde047] text-[#713f12] text-[13px] leading-[1.5] px-6 py-[10px] text-center z-[99]">
			<i class="fa-solid fa-triangle-exclamation mr-1.5 text-[#a16207]"></i>
			The current data and benchmarks are subject to change and still under validation and review.
		</div>

		{#if activeTab === 'explore'}
			<!-- Main 3-column layout -->
			<div class="flex-1 overflow-hidden flex">
				<!-- LEFT: Leaderboard (324px) -->
				<aside class="w-[324px] flex-shrink-0 bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden h-full">
					<Leaderboard onModelSelect={handleLeaderboardModelSelect} />
				</aside>

				<!-- CENTER: Sunburst + legend -->
				<div class="flex-1 flex flex-col items-center overflow-hidden p-3 min-w-0 h-full">
					<!-- Sunburst wrapper -->
					<div class="flex-1 min-h-0 relative flex items-center justify-center w-full">
						{#if appState.loading}
							<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#fafaf9] rounded-[16px] z-10">
								<div class="w-10 h-10 rounded-full border-[3px] border-[#e5e7eb] border-t-[#00b3b0] animate-spin"></div>
								<p class="text-[14px] text-[#6b7280] font-medium">Loading data...</p>
							</div>
						{:else if appState.error}
							<div class="flex flex-col items-center gap-3 text-[#dc2626]">
								<i class="fa-solid fa-circle-exclamation text-3xl"></i>
								<p class="text-[14px] font-semibold">Failed to load data</p>
								<p class="text-[13px] text-[#6b7280]">{appState.error}</p>
							</div>
						{:else}
							<Sunburst
								bind:this={sunburstRef}
								data={hierarchyData}
								onSubareaClick={handleSubareaClick}
								onAreaClick={handleAreaClick}
								onCenterClick={handleCenterClick}
							/>
						{/if}
					</div>

					<!-- Model name label (below sunburst) -->
					<div class="flex-shrink-0 text-[18px] font-semibold text-[#1a1a1a] text-center mt-[-8px] tracking-[-0.01em]">
						{appState.models.find((m) => m.id === appState.filters.model)?.name ?? ''}
					</div>

					<!-- Legend (pinned at bottom of center column) -->
					<div class="flex-shrink-0 w-full max-w-[700px] py-1.5 pb-2">
						<div class="px-4 pt-1 pb-2">
							<div class="flex items-center gap-3">
								<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]">Prohibits human flourishing</span>
								<div class="flex-1 h-[10px] rounded-[5px]" style="background:linear-gradient(to right,#dc2626,#e5e7eb)"></div>
								<div class="w-1.5 h-1.5 rounded-full bg-[#9ca3af] flex-shrink-0"></div>
								<div class="flex-1 h-[10px] rounded-[5px]" style="background:linear-gradient(to right,#e5e7eb,#16a34a)"></div>
								<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]">Promotes human flourishing</span>
							</div>
						</div>
					</div>
				</div>

				<!-- RIGHT: Sidebar panel (360px) -->
				<aside class="w-[360px] flex-shrink-0 bg-[#fafaf9] border-l border-[#e5e7eb] flex flex-col overflow-hidden h-full">
					<Sidebar />
				</aside>
			</div>

		{:else if activeTab === 'metrics'}
			<div class="flex-1 overflow-hidden flex">
				<MetricsPage onTabChange={handleTabChange} />
			</div>

		{:else if activeTab === 'about'}
			<div class="flex-1 overflow-hidden flex">
				<AboutPage />
			</div>
		{/if}

	</div>
{/if}

<!-- Global overlays (always rendered, conditionally visible) -->
<Tooltip />
<NutritionLabel />
<SmartExplore
	open={smartExploreOpen}
	onClose={() => { smartExploreOpen = false; smartNutritionState.opts = null; }}
	onSubmit={handleSmartExploreSubmit}
	loading={smartExploreLoading}
/>
