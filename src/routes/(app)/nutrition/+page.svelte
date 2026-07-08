<script lang="ts">
	import {
		appState,
		setFilters,
		smartExploreState,
		scenarioPanelState,
		closeScenarioPanel
	} from '$lib/store.svelte';
	import NutritionLabelPage from '$lib/components/pages/NutritionLabelPage.svelte';
	import NutritionCatPanel from '$lib/components/organisms/NutritionCatPanel.svelte';
	import ScenarioPanel from '$lib/components/organisms/sidebar/ScenarioPanel.svelte';

	let nutritionCatPanel: { catId: string; modelId: string } | null = $state(null);
</script>

<div class="flex flex-1 overflow-hidden">
	<NutritionLabelPage
		loading={smartExploreState.loading}
		onModelSelect={(modelId) => setFilters({ ...appState.filters, model: modelId })}
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
				<ScenarioPanel backLabel="Close" onBack={closeScenarioPanel} />
			</div>
		</aside>
	{/if}
</div>
