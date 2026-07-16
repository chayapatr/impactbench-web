<script lang="ts">
	import { page } from '$app/state';
	import ExpertsPage from '$lib/components/pages/ExpertsPage.svelte';
	import { EXPERT_SLUG_METRICS, type ExpertSlug } from '$lib/expert-config';

	const slug = $derived(String((page.params as Record<string, string>).slug ?? ''));
	const expertId = $derived(String((page.params as Record<string, string>).expertId ?? ''));
	const config = $derived(
		slug in EXPERT_SLUG_METRICS ? EXPERT_SLUG_METRICS[slug as ExpertSlug] : null
	);
	const pageTitle = $derived(
		config ? `Expert review: ${config.metricName} · ImpactBench` : 'Expert review · ImpactBench'
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if !config}
	<main class="flex min-h-screen items-center justify-center bg-[#fafaf9] px-6 text-[#dc2626]">
		Unknown expert metric path.
	</main>
{:else if !expertId}
	<main class="flex min-h-screen items-center justify-center bg-[#fafaf9] px-6 text-[#dc2626]">
		Missing expert id.
	</main>
{:else}
	{#key `${slug}:${expertId}`}
		<ExpertsPage
			{expertId}
			metricId={config.metricId}
			expertName={config.expertName}
			subareaLabel={config.subareaLabel}
			definition={config.definition}
			examples={config.examples}
		/>
	{/key}
{/if}
