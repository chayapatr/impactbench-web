<script lang="ts">
	// Real, shareable path for the Explore tab. Renders the exact same page
	// component as / — activeTab's initial value is derived from the URL
	// pathname there, and kept in sync afterwards.
	import RootPage from '../+page.svelte';
</script>

<RootPage />
