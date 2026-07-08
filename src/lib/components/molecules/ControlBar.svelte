<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authState, leaderboardState, smartExploreState } from '$lib/store.svelte';

	// Smart Explore is temporarily hidden from the UI; flip to true to surface it again.
	const SHOW_SMART_EXPLORE = false;

	const TABS = [
		{ path: '/', label: 'Home', icon: 'fa-house', locked: false },
		{ path: '/nutrition', label: 'Nutritional Label', icon: 'fa-clipboard-list', locked: true },
		{ path: '/explore', label: 'Explore', icon: 'fa-chart-pie', locked: true },
		{ path: '/metrics', label: 'Metrics', icon: 'fa-list-check', locked: true },
		{ path: '/about', label: 'About', icon: 'fa-seedling', locked: false }
	];

	const activePath = $derived(page.url.pathname);
	const isSmartMode = $derived(leaderboardState.smartRanked.length > 0);
</script>

<header
	class="z-[100] h-[60px] flex-shrink-0 border-b border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
>
	<div class="flex h-full items-center gap-4 px-6">
		<!-- Main nav (left side, margin-right auto pushes right side to end) -->
		<nav class="mr-auto flex items-center gap-0.5">
			<a href="https://www.mit.edu/" target="_blank" rel="noopener noreferrer" aria-label="MIT">
				<img
					src="/mit.svg"
					alt="MIT"
					class="pointer-events-none mr-2 h-5 w-auto flex-shrink-0 select-none"
					aria-hidden="true"
				/>
			</a>
			{#each TABS as tab (tab.path)}
				{@const locked = tab.locked && !authState.authenticated}
				<button
					class="inline-flex items-center gap-1.5 rounded-[6px] border-none px-[14px] py-[7px] text-[14px] font-medium whitespace-nowrap transition-[background,color] duration-150
						{activePath === tab.path
						? 'cursor-pointer bg-[#e0f7f7] font-semibold text-[#00b3b0]'
						: locked
							? 'cursor-pointer bg-transparent text-[#c4c9d4] hover:bg-[#f3f4f6] hover:text-[#6b7280]'
							: 'cursor-pointer bg-transparent text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a]'}"
					aria-disabled={locked}
					title={locked ? 'Enter passcode to unlock' : undefined}
					onclick={() => goto(tab.path)}
				>
					<i class="fa-solid {tab.icon} text-[13px]"></i>
					{tab.label}
					{#if locked}
						<i class="fa-solid fa-lock text-[10px] opacity-60"></i>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Right side -->
		<div class="ml-auto flex items-center gap-2">
			{#if SHOW_SMART_EXPLORE && activePath === '/explore' && !isSmartMode}
				<button
					disabled={smartExploreState.loading}
					class="inline-flex items-center gap-2 rounded-[6px] border-none px-4 py-2 text-[13px] font-semibold text-white
						shadow-[0_1px_2px_rgba(3,141,143,0.25)]
						transition-[transform,box-shadow,filter,opacity] duration-[150ms]
						{smartExploreState.loading
						? 'cursor-wait opacity-70'
						: 'cursor-pointer hover:-translate-y-px hover:shadow-[0_3px_10px_rgba(3,141,143,0.35)] hover:brightness-[1.06] active:translate-y-0'}"
					style="background:linear-gradient(135deg,#00b3b0,#038d8f)"
					onclick={() => {
						smartExploreState.initialText = '';
						smartExploreState.open = true;
					}}
				>
					{#if smartExploreState.loading}
						<i class="fa-solid fa-spinner fa-spin text-[13px]"></i>
						Analyzing…
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles text-[13px]"></i>
						Smart Explore
					{/if}
				</button>
			{/if}
		</div>
	</div>
</header>
