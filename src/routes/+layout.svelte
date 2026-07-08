<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import {
		initAppData,
		smartExploreState,
		smartNutritionState,
		runSmartExplore
	} from '$lib/store.svelte';
	import Tooltip from '$lib/components/molecules/Tooltip.svelte';
	import NutritionLabel from '$lib/components/organisms/NutritionLabel.svelte';
	import SmartExplore from '$lib/components/organisms/SmartExplore.svelte';
	import SmartNutritionLabel from '$lib/components/organisms/SmartNutritionLabel.svelte';

	let { children } = $props();

	onMount(() => {
		initAppData();
	});
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

{@render children()}

<!-- Global overlays (always rendered, conditionally visible) -->
<Tooltip />
<NutritionLabel />
<SmartExplore
	open={smartExploreState.open}
	onClose={() => (smartExploreState.open = false)}
	onSubmit={runSmartExplore}
	loading={smartExploreState.loading}
	initialText={smartExploreState.initialText}
/>
<SmartNutritionLabel
	open={smartNutritionState.open}
	onClose={() => (smartNutritionState.open = false)}
/>
