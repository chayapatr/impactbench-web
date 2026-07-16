<script lang="ts">
	import ExpertsPage from '$lib/components/pages/ExpertsPage.svelte';
	import { EXPERT_SLUG_METRICS } from '$lib/expert-config';

	const config = EXPERT_SLUG_METRICS.scaffoldedlearning;
</script>

<svelte:head>
	<title>Expert review: {config.metricName} · ImpactBench</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<ExpertsPage
	metricId={config.metricId}
	expertName={config.expertName}
	subareaLabel={config.subareaLabel}
	definition={config.definition}
	examples={config.examples}
/>
