<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTaxonomy, loadModels, loadBenchmarkData, loadScenarioIndex, loadMetricCriteria, buildHierarchy, getScoresForFilter } from '$lib/data';
	import {
		appState,
		setData,
		setFilters,
		setScenarioIndex,
		setMetricCriteria,
		sidebarState,
		sidebarNavigateToArea,
		sidebarNavigateToSubarea,
		sidebarNavigateToMetric,
		sidebarNavigateToThemeMetrics,
		sidebarNavigateToSmartFocus,
		leaderboardState,
		smartNutritionState,
		type ThemeMetricItem
	} from '$lib/store.svelte';
	import { makeBenchmarkKey } from '$lib/data';
	import ControlBar from '$lib/components/molecules/ControlBar.svelte';
	import Tooltip from '$lib/components/molecules/Tooltip.svelte';
	import Sunburst from '$lib/components/organisms/Sunburst.svelte';
	import Sidebar from '$lib/components/organisms/Sidebar.svelte';
	import Leaderboard from '$lib/components/organisms/Leaderboard.svelte';
	import NutritionLabel from '$lib/components/organisms/NutritionLabel.svelte';
	import SmartExplore from '$lib/components/organisms/SmartExplore.svelte';
	import SmartNutritionLabel from '$lib/components/organisms/SmartNutritionLabel.svelte';
	import GatePage from '$lib/components/pages/GatePage.svelte';
	import AboutPage from '$lib/components/pages/AboutPage.svelte';
	import MetricsPage from '$lib/components/pages/MetricsPage.svelte';

	let showGate = $state(true);
	let isAuthenticated = $state(false);
	let activeTab = $state('home');
	let smartExploreOpen = $state(false);
	let smartExploreLoading = $state(false);
	let smartNutritionOpen = $state(false);
	const isSmartMode = $derived(leaderboardState.smartRanked.length > 0);

	let sunburstRef: Sunburst | undefined = $state();

	function handleClearFocus() {
		leaderboardState.smartRanked = [];
		leaderboardState.smartFocusNode = null;
		smartNutritionState.opts = null;
		sidebarState.navStack = [{ type: 'overview' }];
	}

	// Sync sunburst focus with sidebar nav stack
	$effect(() => {
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		if (top.type === 'overview' || top.type === 'smart-focus' || top.type === 'theme-metrics') {
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
			isAuthenticated = true;
			showGate = false;
			activeTab = 'explore';
		}

		try {
			const [taxonomy, models, benchmarkData] = await Promise.all([
				loadTaxonomy(),
				loadModels(),
				loadBenchmarkData()
			]);
			setData(taxonomy, models, benchmarkData);

			// Load scenario index and metric criteria in background
			loadScenarioIndex().then(setScenarioIndex).catch(() => {});
			loadMetricCriteria().then(setMetricCriteria).catch(() => {});

			// Wire up global window callbacks for backwards compat
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

	const CASPER_API = 'https://casper-production-7f8e.up.railway.app';

	const BENCHMARK_ICONS: Record<string, string> = {
		'humanebench': 'fa-heart-pulse',
		'humanagency-bench': 'fa-graduation-cap',
		'spillunder-effect': 'fa-compass',
		'emotional-dependency': 'fa-heart',
		'modulated-cognitive-autonomy-benchmark-mcab': 'fa-brain',
		'cognitive-offloading-asymmetry-over-scaffolding-vs-autonomy-preservation-in-llm-responses': 'fa-seedling'
	};

	function subareaNameToId(name: string): string {
		return name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[()]/g, '');
	}

	async function handleSmartExploreSubmit(text: string) {
		smartExploreOpen = false; // close modal immediately
		smartExploreLoading = true;
		try {
			const resp = await fetch(CASPER_API + '/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: text, query: text, top_n: 15, per_benchmark_cap: 3 })
			});
			if (!resp.ok) throw new Error('Casper API error: ' + resp.status);
			const data = await resp.json();

			interface ParsedMetric { id: string; name: string; benchmark: string; icon: string; subareas: string[]; score: number; summary: string }
			interface ParsedConstruct { text: string; description: string; avg_score: number; metrics: ParsedMetric[]; subareas: string[]; primarySubarea: string; icon: string; id: string | null }

			// Parse themes into constructs
			const constructs: ParsedConstruct[] = (data.themes ?? []).map((theme: Record<string, unknown>) => {
				const metrics = ((theme.metrics as Record<string, unknown>[]) ?? []).map((m: Record<string, unknown>) => {
					const subareaIds = ((m.subareas as string[]) ?? []).map(subareaNameToId);
					return {
						id: m.id as string,
						name: m.name as string,
						benchmark: m.benchmark as string,
						icon: BENCHMARK_ICONS[m.benchmark as string] ?? 'fa-bullseye',
						subareas: subareaIds.length ? subareaIds : ['autonomy-preservation'],
						score: (m.score as number) ?? 0,
						summary: (m.description as string) ?? ''
					};
				});
				const allSubareas = [...new Set(metrics.flatMap((m): string[] => m.subareas))];
				return {
					text: theme.name as string,
					description: (theme.description as string) ?? '',
					avg_score: (theme.avg_score as number) ?? 0,
					metrics,
					subareas: allSubareas.length ? allSubareas : ['autonomy-preservation'],
					primarySubarea: allSubareas[0] ?? 'autonomy-preservation',
					icon: metrics[0]?.icon ?? 'fa-bullseye',
					id: metrics[0]?.id ?? null
				};
			});

			// Collect all focus metric IDs and rank models
			const focusMetricIds = [...new Set(constructs.flatMap((c) => c.metrics.map((m) => m.id)))];
			renderSmartRankings(focusMetricIds);

			// Build nutrition label opts and open
			const smartRanked = leaderboardState.smartRanked;
			const topModels = smartRanked.slice(0, 3).map((m) => {
				const themeMetricIds = constructs.map((c) => c.metrics.map((met) => met.id));
				return {
					name: m.name,
					provider: m.provider,
					score: m.score,
					constructScores: getConstructScoresForModel(m.id, themeMetricIds),
					worstAreas: getWorstSubareasForModel(m.id, 3)
				};
			});

			smartNutritionState.opts = {
				userText: text,
				constructs: constructs.map((c) => ({
					text: c.text,
					benchmark: c.metrics[0]?.benchmark ?? 'benchmark',
					score: c.avg_score,
					icon: c.icon,
					summary: c.description
				})),
				topModels
			};
			smartNutritionState.activeModelIdx = 0;

			// Navigate sidebar to smart focus view with all themes as cards
			const smartThemes = constructs.map((c) => ({
				name: c.text,
				description: c.description,
				icon: c.icon ?? 'fa-bullseye',
				avg_score: c.avg_score,
				metrics: c.metrics.map((m) => ({ id: m.id, name: m.name, score: m.score ?? 0 }))
			}));
			sidebarNavigateToSmartFocus(text, smartThemes);

			// Close the input modal
			smartExploreOpen = false;
		} catch (err) {
			console.error('Smart Explore error:', err);
		} finally {
			smartExploreLoading = false;
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

	const LOCKED_TABS = new Set(['explore', 'metrics']);

	function handleTabChange(tab: string) {
		if (tab === 'home') {
			showGate = true;
		} else if (LOCKED_TABS.has(tab) && !isAuthenticated) {
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
		{isAuthenticated}
		onEnter={() => { isAuthenticated = true; showGate = false; activeTab = 'explore'; }}
		onTabChange={(tab) => handleTabChange(tab)}
	/>
{:else}
	<div class="h-screen overflow-hidden flex flex-col bg-[#fafaf9]" style="font-family:'Inter',system-ui,-apple-system,sans-serif">
		<ControlBar
			{activeTab}
			{isAuthenticated}
			{isSmartMode}
			{smartExploreLoading}
			onTabChange={handleTabChange}
			onSmartExplore={() => (smartExploreOpen = true)}
			onOpenNutritionLabel={() => { smartNutritionOpen = true; }}
			onClearFocus={handleClearFocus}
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
				<AboutPage onTabChange={handleTabChange} />
			</div>
		{/if}

	</div>
{/if}

<!-- Global overlays (always rendered, conditionally visible) -->
<Tooltip />
<NutritionLabel />
<SmartExplore
	open={smartExploreOpen}
	onClose={() => { smartExploreOpen = false; }}
	onSubmit={handleSmartExploreSubmit}
	loading={smartExploreLoading}
/>
<SmartNutritionLabel
	open={smartNutritionOpen}
	onClose={() => { smartNutritionOpen = false; }}
/>
