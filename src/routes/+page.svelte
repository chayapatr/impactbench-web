<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import GatePage from '$lib/components/pages/GatePage.svelte';

	// Legacy deep-link formats, redirected to their real routes:
	//   /?tab=explore            -> /explore
	//   /?metric=…&scenario=…    -> /?next=/explore?metric=…&scenario=…
	// (the gate consumes ?next= and auto-opens its password modal)
	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('tab');
		if (tab && ['explore', 'metrics', 'nutrition', 'about'].includes(tab)) {
			params.delete('tab');
			const rest = params.toString();
			goto(`/${tab}${rest ? `?${rest}` : ''}`, { replaceState: true });
			return;
		}
		if ((params.has('metric') || params.has('scenario')) && !params.has('next')) {
			const next = `/explore?${params.toString()}`;
			goto(`/?next=${encodeURIComponent(next)}`, { replaceState: true });
		}
	});
</script>

<GatePage />
