<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authState, closeScenarioPanel } from '$lib/store.svelte';
	import ControlBar from '$lib/components/molecules/ControlBar.svelte';
	import FeedbackSurveyModal from '$lib/components/organisms/FeedbackSurveyModal.svelte';

	let { children } = $props();

	let surveyOpen = $state(false);

	// Tabs behind the passcode gate. /about is public.
	const LOCKED_PATHS = new Set(['/explore', '/metrics', '/nutrition']);
	const locked = $derived(LOCKED_PATHS.has(page.url.pathname) && !authState.authenticated);

	// Client-side guard: bounce locked pages to the gate, remembering the
	// intended destination so the gate can auto-open its password modal and
	// land the visitor back here after unlock.
	$effect(() => {
		if (locked) {
			const next = page.url.pathname + page.url.search;
			goto(`/?next=${encodeURIComponent(next)}`, { replaceState: true });
		}
	});

	// Close the scenario side-panel when switching tabs.
	$effect(() => {
		void page.url.pathname;
		closeScenarioPanel();
	});
</script>

{#if !locked}
	<div
		class="flex h-screen flex-col overflow-hidden bg-[#fafaf9]"
		style="font-family:'Inter',system-ui,-apple-system,sans-serif"
	>
		<ControlBar />

		<!-- Beta banner (below navbar) -->
		{#if false && page.url.pathname !== '/nutrition'}
			<div
				class="z-[99] flex-shrink-0 border-b border-[#fde047] bg-[#fef9c3] px-6 py-[10px] text-center text-[13px] leading-[1.5] text-[#713f12]"
			>
				<i class="fa-solid fa-triangle-exclamation mr-1.5 text-[#a16207]"></i>
				The current data and benchmarks are subject to change and still under validation and review.
				<button
					type="button"
					class="ml-1 cursor-pointer border-none bg-transparent p-0 font-semibold text-[#713f12] underline hover:opacity-80"
					onclick={() => goto('/#feedback')}
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

		{@render children()}
	</div>
{/if}

<FeedbackSurveyModal bind:open={surveyOpen} onClose={() => (surveyOpen = false)} />
