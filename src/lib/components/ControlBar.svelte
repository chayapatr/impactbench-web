<script lang="ts">
	interface Props {
		onSmartExplore: () => void;
		onTabChange: (tab: string) => void;
		activeTab: string;
		isAuthenticated: boolean;
	}

	let { onSmartExplore, onTabChange, activeTab, isAuthenticated }: Props = $props();

	const TABS = [
		{ id: 'home', label: 'Home', icon: 'fa-house', locked: false },
		{ id: 'explore', label: 'Explore', icon: 'fa-chart-pie', locked: true },
		{ id: 'metrics', label: 'Metrics', icon: 'fa-list-check', locked: true },
		{ id: 'about', label: 'About', icon: 'fa-seedling', locked: false }
	];
</script>

<header
	class="flex-shrink-0 h-[60px] z-[100] bg-white border-b border-[#e5e7eb] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]"
>
	<div class="h-full px-6 flex items-center gap-4">
		<!-- Main nav (left side, margin-right auto pushes right side to end) -->
		<nav class="flex items-center gap-0.5 mr-auto">
			<a href="https://www.mit.edu/" target="_blank" rel="noopener noreferrer" aria-label="MIT">
				<img
					src="/mit.svg"
					alt="MIT"
					class="h-5 w-auto mr-2 flex-shrink-0 pointer-events-none select-none"
					aria-hidden="true"
				/>
			</a>
			{#each TABS as tab (tab.id)}
				{@const locked = tab.locked && !isAuthenticated}
				<button
					disabled={locked}
					class="inline-flex items-center gap-1.5 px-[14px] py-[7px] rounded-[6px] text-[14px] font-medium transition-[background,color] duration-150 whitespace-nowrap border-none
						{activeTab === tab.id
						? 'bg-[#e0f7f7] text-[#00b3b0] font-semibold cursor-pointer'
						: locked
						? 'bg-transparent text-[#c4c9d4] cursor-not-allowed'
						: 'bg-transparent text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a] cursor-pointer'}"
					onclick={() => onTabChange(tab.id)}
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
		<div class="flex items-center gap-2 ml-auto">
			<button
				class="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-white text-[13px] font-semibold cursor-pointer border-none
					shadow-[0_1px_2px_rgba(3,141,143,0.25)]
					transition-[transform,box-shadow,filter] duration-[150ms]
					hover:brightness-[1.06] hover:shadow-[0_3px_10px_rgba(3,141,143,0.35)] hover:-translate-y-px
					active:translate-y-0"
				style="background:linear-gradient(135deg,#00b3b0,#038d8f)"
				onclick={onSmartExplore}
			>
				<i class="fa-solid fa-wand-magic-sparkles text-[13px]"></i>
				Smart Explore
			</button>
		</div>
	</div>
</header>
