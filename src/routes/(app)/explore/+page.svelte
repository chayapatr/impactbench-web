<script lang="ts">
	import { page } from '$app/state';
	import { buildHierarchy, getScoresForFilter } from '$lib/data';
	import {
		appState,
		setFilters,
		sidebarState,
		sidebarNavigateTo,
		sidebarNavigateToMetric,
		leaderboardState,
		smartNutritionState,
		smartExploreState,
		scenarioPanelState,
		openScenarioPanel,
		openMetricPanel,
		closeScenarioPanel
	} from '$lib/store.svelte';
	import Sunburst from '$lib/components/organisms/Sunburst.svelte';
	import Sidebar from '$lib/components/organisms/Sidebar.svelte';
	import Leaderboard from '$lib/components/organisms/Leaderboard.svelte';
	import ScenarioPanel from '$lib/components/organisms/sidebar/ScenarioPanel.svelte';

	let sunburstRef: Sunburst | undefined = $state();

	// Deep link params (?metric=…&scenario=…), consumed once data arrives.
	let deepMetric = $state(page.url.searchParams.get('metric'));
	let deepScenario = $state(page.url.searchParams.get('scenario'));

	$effect(() => {
		if (deepMetric && appState.taxonomy) {
			sidebarNavigateToMetric(deepMetric, appState.taxonomy);
			if (!deepScenario) deepMetric = null;
		}
	});

	$effect(() => {
		if (deepMetric && deepScenario && appState.scenarioIndex) {
			const scenarios = appState.scenarioIndex[deepMetric] ?? [];
			const scenarioMeta = scenarios.find((s) => s.scenario_id === deepScenario);
			if (scenarioMeta) openScenarioPanel(deepMetric, scenarioMeta);
			deepScenario = null;
			deepMetric = null;
		}
	});

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
			? buildHierarchy(
					appState.taxonomy,
					getScoresForFilter(appState.benchmarkData, appState.filters)
				)
			: null
	);

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

	function handleClearFocus() {
		leaderboardState.smartRanked = [];
		leaderboardState.smartFocusNode = null;
		smartNutritionState.opts = null;
		sidebarState.navStack = [{ type: 'overview' }];
	}
</script>

<!-- Main 3-column layout -->
<div class="flex flex-1 overflow-hidden">
	<!-- LEFT: Leaderboard (324px) -->
	<aside
		class="flex h-full w-[324px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white"
	>
		<Leaderboard onModelSelect={(modelId) => setFilters({ ...appState.filters, model: modelId })} />
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
					<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]">Bad behavior</span>
					<div
						class="h-[10px] flex-1 rounded-[5px]"
						style="background:linear-gradient(to right,#dc2626,#e5e7eb)"
					></div>
					<div class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#9ca3af]"></div>
					<div
						class="h-[10px] flex-1 rounded-[5px]"
						style="background:linear-gradient(to right,#e5e7eb,#16a34a)"
					></div>
					<span class="text-[12px] font-medium whitespace-nowrap text-[#444444]">Good behavior</span
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
				smartNutritionState.open = true;
			}}
			onEditFocus={() => {
				smartExploreState.initialText = leaderboardState.smartFocusNode?.userText ?? '';
				smartExploreState.open = true;
			}}
			onClearFocus={handleClearFocus}
		/>
	</aside>

	<!-- FAR RIGHT: Metric/scenario detail side-panel -->
	{#if scenarioPanelState.open && scenarioPanelState.metricId}
		<aside
			class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.08)]"
		>
			<div class="sidebar-scroll flex flex-1 flex-col overflow-y-auto">
				<ScenarioPanel backLabel="Close" onBack={closeScenarioPanel} />
			</div>
		</aside>
	{/if}
</div>
