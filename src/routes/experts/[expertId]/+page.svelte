<script lang="ts">
	import { page } from '$app/state';
	import ExpertsPage from '$lib/components/pages/ExpertsPage.svelte';

	const expertId = $derived(page.params.expertId ?? '');
</script>

<svelte:head>
	<title>Expert review · ImpactBench</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if expertId}
	{#key expertId}
		<ExpertsPage {expertId} />
	{/key}
{:else}
	<main class="flex min-h-screen items-center justify-center text-[#dc2626]">
		Missing expert id.
	</main>
{/if}
