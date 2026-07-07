<script lang="ts">
	import { onMount } from 'svelte';
	import {
		loadTaxonomy,
		loadModels,
		loadBenchmarkData,
		loadScenarioIndex,
		loadMetricCriteria,
		loadMetricMeta,
		loadNutritionScore,
		loadNutritionCat,
		buildHierarchy,
		getScoresForFilter
	} from '$lib/data';
	import {
		appState,
		setData,
		setFilters,
		setScenarioIndex,
		setMetricCriteria,
		setMetricMeta,
		setNutritionScore,
		setNutritionCat,
		sidebarState,
		sidebarPush,
		sidebarNavigateTo,
		sidebarNavigateToMetric,
		sidebarNavigateToSmartFocus,
		leaderboardState,
		smartNutritionState,
		scenarioPanelState,
		openScenarioPanel,
		closeScenarioPanel,
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
	import ScenarioPanel from '$lib/components/organisms/sidebar/ScenarioPanel.svelte';
	import SmartNutritionLabel from '$lib/components/organisms/SmartNutritionLabel.svelte';
	import GatePage from '$lib/components/pages/GatePage.svelte';
	import AboutPage from '$lib/components/pages/AboutPage.svelte';
	import MetricsPage from '$lib/components/pages/MetricsPage.svelte';
	import FeedbackSurveyModal from '$lib/components/organisms/FeedbackSurveyModal.svelte';
	import NutritionLabelPage from '$lib/components/pages/NutritionLabelPage.svelte';
	import NutritionCatPanel from '$lib/components/organisms/NutritionCatPanel.svelte';

	interface Props {
		initialTab: 'home' | 'explore' | 'metrics' | 'nutrition' | 'about';
	}
	let { initialTab }: Props = $props();

	let showGate = $state(true);
	let isAuthenticated = $state(false);
	let activeTab = $state(initialTab);
	let smartExploreOpen = $state(false);
	let smartExploreLoading = $state(false);
	let smartExploreInitialText = $state('');
	let smartNutritionOpen = $state(false);
	let nutritionCatPanel: { catId: string; modelId: string } | null = $state(null);
	let surveyOpen = $state(false);
	const isSmartMode = $derived(leaderboardState.smartRanked.length > 0);

	// Deep link params — parsed immediately (browser-only), consumed after auth.
	// The tab comes from the route (initialTab, set by SvelteKit's own router —
	// no more window.location.pathname sniffing) or the legacy ?tab=explore
	// query param on the homepage, in that precedence order.
	const ROUTABLE_TABS = new Set(['explore', 'metrics', 'nutrition']);
	const _initialParams =
		typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	let pendingDeepMetric = $state<string | null>(_initialParams?.get('metric') ?? null);
	let pendingDeepScenario = $state<string | null>(_initialParams?.get('scenario') ?? null);
	let pendingDeepTab = $state<string | null>(
		(ROUTABLE_TABS.has(initialTab) ? initialTab : null) ?? _initialParams?.get('tab') ?? null
	);

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

	// Auto-close the scenario side-panel on tab switch.
	$effect(() => {
		void activeTab;
		closeScenarioPanel();
	});

	// Keep the URL path in sync with the active tab so /explore, /metrics,
	// /nutrition are real shareable links (refresh, back/forward, copy-paste).
	// Uses replaceState directly (not SvelteKit's goto) to avoid a full
	// navigation/remount of this page on every tab switch.
	$effect(() => {
		if (typeof window === 'undefined') return;
		const path = ROUTABLE_TABS.has(activeTab) ? `/${activeTab}` : '/';
		if (window.location.pathname !== path) {
			history.replaceState(history.state, '', path + window.location.search);
		}
	});

	// Derived hierarchy data for sunburst
	const hierarchyData = $derived(
		appState.taxonomy && !appState.loading
			? buildHierarchy(
					appState.taxonomy,
					getScoresForFilter(appState.benchmarkData, appState.filters)
				)
			: null
	);

	onMount(async () => {
		// Check gate
		if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('aib-auth') === '1') {
			isAuthenticated = true;
			showGate = false;
			activeTab = pendingDeepTab ?? 'explore';
			pendingDeepTab = null;
		} else if (pendingDeepTab === 'about') {
			showGate = false;
			activeTab = 'about';
			pendingDeepTab = null;
		}

		try {
			const [taxonomy, models, benchmarkData] = await Promise.all([
				loadTaxonomy(),
				loadModels(),
				loadBenchmarkData()
			]);
			setData(taxonomy, models, benchmarkData);

			// Handle deep linking after data is loaded (only if already authenticated)
			if (isAuthenticated && pendingDeepMetric && taxonomy) {
				sidebarNavigateToMetric(pendingDeepMetric, taxonomy);
			}

			// Load scenario index and metric criteria in background
			loadScenarioIndex()
				.then((idx) => {
					setScenarioIndex(idx);
					// Navigate to scenario if specified in deep link (only if already authenticated)
					if (isAuthenticated && pendingDeepScenario && pendingDeepMetric && idx) {
						const scenarios = idx[pendingDeepMetric] ?? [];
						const scenarioMeta = scenarios.find((s) => s.scenario_id === pendingDeepScenario);
						if (scenarioMeta) {
							openScenarioPanel(pendingDeepMetric, scenarioMeta);
						}
						pendingDeepScenario = null;
					}
					if (isAuthenticated && pendingDeepMetric) pendingDeepMetric = null;
				})
				.catch((e) => console.warn('Failed to load scenario index:', e));
			loadMetricCriteria()
				.then(setMetricCriteria)
				.catch((e) => console.warn('Failed to load metric criteria:', e));
			loadMetricMeta()
				.then(setMetricMeta)
				.catch((e) => console.warn('Failed to load metric meta:', e));
			loadNutritionScore()
				.then(setNutritionScore)
				.catch((e) => console.warn('Failed to load nutrition scores:', e));
			loadNutritionCat()
				.then(setNutritionCat)
				.catch((e) => console.warn('Failed to load nutrition categories:', e));

			// Wire up global window callbacks for backwards compat
			const w = window as unknown as Record<string, unknown>;
			w.__openSubarea = handleSubareaClick;
			w.__openMetric = (id: string) => {
				if (appState.taxonomy) sidebarNavigateToMetric(id, appState.taxonomy);
			};
			w.__renderSmartRankings = renderSmartRankings;
			w.__restoreNormalRankings = restoreNormalRankings;
			w.__openThemeMetrics = (name: string, desc: string, metrics: ThemeMetricItem[]) =>
				sidebarNavigateTo({ type: 'theme-metrics', themeName: name, themeDesc: desc, metrics });
			w.__getSmartRanked = () => leaderboardState.smartRanked;
			w.__getBenchmarkScores = () =>
				appState.benchmarkData[makeBenchmarkKey(appState.filters.model, appState.filters.age)] ??
				{};
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
		const area = appState.taxonomy.areas.find((a) => a.subareas.some((s) => s.id === subareaId));
		const levels: import('$lib/store.svelte').NavLevel[] = [];
		if (area) levels.push({ type: 'area', areaId: area.id });
		levels.push({ type: 'subarea', subareaId });
		sidebarNavigateTo(...levels);
	}

	function handleAreaClick(areaId: string) {
		sidebarNavigateTo({ type: 'area', areaId });
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
		humanebench: 'fa-heart-pulse',
		'humanagency-bench': 'fa-graduation-cap',
		'spillunder-effect': 'fa-compass',
		'emotional-dependency': 'fa-heart',
		'modulated-cognitive-autonomy-benchmark-mcab': 'fa-brain',
		'cognitive-offloading-asymmetry-over-scaffolding-vs-autonomy-preservation-in-llm-responses':
			'fa-seedling'
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

			interface ParsedMetric {
				id: string;
				name: string;
				benchmark: string;
				icon: string;
				subareas: string[];
				score: number;
				summary: string;
			}
			interface ParsedConstruct {
				text: string;
				description: string;
				avg_score: number;
				metrics: ParsedMetric[];
				subareas: string[];
				primarySubarea: string;
				icon: string;
				id: string | null;
			}

			// Parse themes into constructs
			const constructs: ParsedConstruct[] = (data.themes ?? []).map(
				(theme: Record<string, unknown>) => {
					const metrics = ((theme.metrics as Record<string, unknown>[]) ?? []).map(
						(m: Record<string, unknown>) => {
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
						}
					);
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
				}
			);

			// Single pass: compute construct scores for all models, rank, build nutrition opts
			const constructMetricIds = constructs.map((c) => c.metrics.map((m) => m.id));

			// All metric IDs flat (for sidebar/label score)
			const allFlatMetricIds = constructMetricIds.flat();

			const allModelScores = appState.models
				.map((m) => {
					const constructScores = getConstructScoresForModel(m.id, constructMetricIds);
					const avg = constructScores.length
						? constructScores.reduce((a, b) => a + b, 0) / constructScores.length
						: 0;
					// Flat avg across all metric IDs (for sidebar header + nutrition label)
					const key = makeBenchmarkKey(m.id, appState.filters.age);
					const rawScores = appState.benchmarkData[key];
					const flatVals = allFlatMetricIds
						.map((id) => rawScores?.[id] ?? null)
						.filter((v): v is number => v !== null);
					const flatScore = flatVals.length
						? flatVals.reduce((a, b) => a + b, 0) / flatVals.length
						: 0;
					return { model: m, avg, constructScores, flatScore };
				})
				.sort((a, b) => b.avg - a.avg);

			leaderboardState.smartRanked = allModelScores.map(({ model, avg, flatScore }) => ({
				id: model.id,
				name: model.name,
				provider: model.provider,
				score: avg,
				flatScore
			}));

			const topModels = allModelScores
				.slice(0, 3)
				.map(({ model, avg, constructScores, flatScore }) => ({
					name: model.name,
					provider: model.provider,
					score: avg,
					flatScore,
					constructScores,
					worstAreas: getWorstSubareasForModel(model.id, 3)
				}));

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

	function renderSmartRankings(constructMetricIds: string[][]) {
		const allFlatMetricIds = constructMetricIds.flat();
		const ranked = appState.models
			.map((m) => {
				const key = makeBenchmarkKey(m.id, appState.filters.age);
				const scores = appState.benchmarkData[key];
				if (!scores || !constructMetricIds.length) return { model: m, avg: 0, flatScore: 0 };
				const constructAvgs = constructMetricIds
					.map((ids) => {
						const vals = ids.map((id) => scores[id] ?? null).filter((v) => v !== null) as number[];
						return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
					})
					.filter((v): v is number => v !== null);
				const avg = constructAvgs.length
					? constructAvgs.reduce((a, b) => a + b, 0) / constructAvgs.length
					: 0;
				const flatVals = allFlatMetricIds
					.map((id) => scores[id] ?? null)
					.filter((v): v is number => v !== null);
				const flatScore = flatVals.length
					? flatVals.reduce((a, b) => a + b, 0) / flatVals.length
					: 0;
				return { model: m, avg, flatScore };
			})
			.sort((a, b) => b.avg - a.avg);

		leaderboardState.smartRanked = ranked.map(({ model, avg, flatScore }) => ({
			id: model.id,
			name: model.name,
			provider: model.provider,
			score: avg,
			flatScore
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

	// Incremented each time a locked tab is clicked to (re-)trigger the
	// password modal on the gate page. Seeded to 1 when a deep link (a metric,
	// a scenario, or a locked-tab route like /explore) is present so the modal
	// auto-opens on first mount — signals to the visitor why they're on the
	// gate instead of where they meant to go.
	let gatePasswordRequest = $state(
		_initialParams?.get('metric') ||
			_initialParams?.get('scenario') ||
			(pendingDeepTab && ROUTABLE_TABS.has(pendingDeepTab))
			? 1
			: 0
	);

	function handleTabChange(tab: string) {
		if (tab === 'home') {
			showGate = true;
		} else if (ROUTABLE_TABS.has(tab) && !isAuthenticated) {
			showGate = true;
			// Remember which locked tab the user wanted so we can land them
			// there (not on the default Explore) after they enter the password.
			pendingDeepTab = tab;
			gatePasswordRequest += 1;
		} else {
			activeTab = tab;
			showGate = false;
			if (tab === 'nutrition') {
				sidebarState.navStack = [{ type: 'overview' }];
				closeScenarioPanel();
			}
		}
	}
</script>

<svelte:head>
	<title>MIT | ImpactBench</title>
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
		showPasswordOnMount={!!(pendingDeepMetric || pendingDeepScenario)}
		passwordRequestNonce={gatePasswordRequest}
		onEnter={(smartText) => {
			isAuthenticated = true;
			showGate = false;
			// If user submitted a focus prompt on the homepage, route them
			// straight to the Nutritional Label tab and run the pipeline.
			if (smartText && smartText.trim()) {
				activeTab = 'nutrition';
				pendingDeepTab = null;
				handleSmartExploreSubmit(smartText);
			} else {
				activeTab = pendingDeepTab ?? 'explore';
				pendingDeepTab = null;
			}
			// Navigate to deep link target if present
			if (pendingDeepMetric && appState.taxonomy) {
				sidebarNavigateToMetric(pendingDeepMetric, appState.taxonomy);
			}
			if (pendingDeepScenario && pendingDeepMetric) {
				// scenarioIndex may still be loading — navigate now if ready, otherwise wait for it
				if (appState.scenarioIndex) {
					const scenarios = appState.scenarioIndex[pendingDeepMetric] ?? [];
					const scenarioMeta = scenarios.find((s) => s.scenario_id === pendingDeepScenario);
					if (scenarioMeta) openScenarioPanel(pendingDeepMetric!, scenarioMeta);
					pendingDeepScenario = null;
					pendingDeepMetric = null;
				}
				// else: scenarioIndex .then() handler above will pick it up when it arrives
			} else {
				pendingDeepMetric = null;
			}
		}}
		onTabChange={(tab) => handleTabChange(tab)}
	/>
{:else}
	<div
		class="flex h-screen flex-col overflow-hidden bg-[#fafaf9]"
		style="font-family:'Inter',system-ui,-apple-system,sans-serif"
	>
		<ControlBar
			{activeTab}
			{isAuthenticated}
			{isSmartMode}
			{smartExploreLoading}
			onTabChange={handleTabChange}
			onSmartExplore={() => {
				smartExploreInitialText = '';
				smartExploreOpen = true;
			}}
		/>

		<!-- Beta banner (below navbar) -->
		{#if activeTab !== 'nutrition'}
			<div
				class="z-[99] flex-shrink-0 border-b border-[#fde047] bg-[#fef9c3] px-6 py-[10px] text-center text-[13px] leading-[1.5] text-[#713f12]"
			>
				<i class="fa-solid fa-triangle-exclamation mr-1.5 text-[#a16207]"></i>
				The current data and benchmarks are subject to change and still under validation and review.
				<button
					type="button"
					class="ml-1 cursor-pointer border-none bg-transparent p-0 font-semibold text-[#713f12] underline hover:opacity-80"
					onclick={() => {
						if (typeof window !== 'undefined') {
							window.location.hash = '#feedback';
						}
						handleTabChange('home');
					}}
				>
					Share feedback
				</button>
				<span class="mx-1 text-[#a16207]">|</span>
				<button
					type="button"
					class="cursor-pointer border-none bg-transparent p-0 font-semibold text-[#713f12] underline hover:opacity-80"
					onclick={() => (surveyOpen = true)}
				>
					Help us learn
				</button>
			</div>
		{/if}

		{#if activeTab === 'explore'}
			<!-- Main 3-column layout -->
			<div class="flex flex-1 overflow-hidden">
				<!-- LEFT: Leaderboard (324px) -->
				<aside
					class="flex h-full w-[324px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white"
				>
					<Leaderboard onModelSelect={handleLeaderboardModelSelect} />
				</aside>

				<!-- CENTER: Sunburst + legend -->
				<div class="flex h-full min-w-0 flex-1 flex-col items-center overflow-hidden p-3">
					<!-- Sunburst wrapper -->
					<div class="relative flex min-h-0 w-full flex-1 items-center justify-center">
						{#if appState.loading}
							<div
								class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-[16px] bg-[#fafaf9]"
							>
								<div
									class="h-10 w-10 animate-spin rounded-full border-[3px] border-[#e5e7eb] border-t-[#00b3b0]"
								></div>
								<p class="text-[14px] font-medium text-[#6b7280]">Loading data...</p>
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
					<div
						class="mt-[-8px] flex-shrink-0 text-center text-[16px] font-semibold tracking-[-0.01em] text-[#1a1a1a]"
					>
						{appState.models.find((m) => m.id === appState.filters.model)?.name ?? ''}
					</div>

					<!-- Legend (pinned at bottom of center column) -->
					<div class="w-full max-w-[700px] flex-shrink-0 py-1.5 pb-2">
						<div class="px-4 pt-1 pb-2">
							<div class="flex items-center gap-3">
								<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]"
									>Bad behavior</span
								>
								<div
									class="h-[10px] flex-1 rounded-[5px]"
									style="background:linear-gradient(to right,#dc2626,#e5e7eb)"
								></div>
								<div class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#9ca3af]"></div>
								<div
									class="h-[10px] flex-1 rounded-[5px]"
									style="background:linear-gradient(to right,#e5e7eb,#16a34a)"
								></div>
								<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]"
									>Good behavior</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- RIGHT: Sidebar panel (360px) -->
				<aside
					class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-[#fafaf9]"
				>
					<Sidebar
						onOpenNutritionLabel={() => {
							smartNutritionOpen = true;
						}}
						onEditFocus={() => {
							smartExploreInitialText = leaderboardState.smartFocusNode?.userText ?? '';
							smartExploreOpen = true;
						}}
						onClearFocus={handleClearFocus}
					/>
				</aside>

				<!-- FAR RIGHT: Scenario detail side-panel (only when a scenario is selected) -->
				{#if scenarioPanelState.open && scenarioPanelState.scenarioMeta && scenarioPanelState.metricId}
					<aside
						class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.08)]"
					>
						<div class="sidebar-scroll flex flex-1 flex-col overflow-y-auto">
							<ScenarioPanel
								metricId={scenarioPanelState.metricId}
								scenarioMeta={scenarioPanelState.scenarioMeta}
								backLabel="Close"
								onBack={closeScenarioPanel}
							/>
						</div>
					</aside>
				{/if}
			</div>
		{:else if activeTab === 'metrics'}
			<div class="flex flex-1 overflow-hidden">
				<MetricsPage onTabChange={handleTabChange} />
			</div>
		{:else if activeTab === 'about'}
			<div class="flex flex-1 overflow-hidden">
				<AboutPage onTabChange={handleTabChange} />
			</div>
		{:else if activeTab === 'nutrition'}
			<div class="flex flex-1 overflow-hidden">
				<NutritionLabelPage
					loading={smartExploreLoading}
					onTabChange={handleTabChange}
					onModelSelect={handleLeaderboardModelSelect}
					onCatSelect={(catId, modelId) => {
						nutritionCatPanel = { catId, modelId };
						closeScenarioPanel();
					}}
				/>
				<aside
					class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb]"
				>
					<NutritionCatPanel
						catId={nutritionCatPanel?.catId ?? null}
						modelId={nutritionCatPanel?.modelId ?? appState.filters.model}
						onClose={() => (nutritionCatPanel = null)}
					/>
				</aside>
				{#if scenarioPanelState.open && scenarioPanelState.scenarioMeta && scenarioPanelState.metricId}
					<aside
						class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.08)]"
					>
						<div class="sidebar-scroll flex flex-1 flex-col overflow-y-auto">
							<ScenarioPanel
								metricId={scenarioPanelState.metricId}
								scenarioMeta={scenarioPanelState.scenarioMeta}
								backLabel="Close"
								onBack={closeScenarioPanel}
							/>
						</div>
					</aside>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- Global overlays (always rendered, conditionally visible) -->
<Tooltip />
<NutritionLabel />
<SmartExplore
	open={smartExploreOpen}
	onClose={() => {
		smartExploreOpen = false;
	}}
	onSubmit={handleSmartExploreSubmit}
	loading={smartExploreLoading}
	initialText={smartExploreInitialText}
/>
<SmartNutritionLabel
	open={smartNutritionOpen}
	onClose={() => {
		smartNutritionOpen = false;
	}}
/>
<FeedbackSurveyModal bind:open={surveyOpen} onClose={() => (surveyOpen = false)} />
