<script lang="ts">
	import {
		appState,
		sidebarState,
		sidebarNavigateTo,
		scenarioPanelState,
		closeScenarioPanel
	} from '$lib/store.svelte';
	import { filterScenariosByAge, findMetricInTaxonomy, getModelName } from '$lib/utils';

	interface Crumb {
		label: string;
		value: string;
		onClick: (() => void) | null;
		noTruncate?: boolean;
	}

	const crumbs = $derived.by<Crumb[]>(() => {
		if (!appState.taxonomy) return [];
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		const list: Crumb[] = [];

		// Determine current navigation context
		let areaId: string | null = null;
		let subareaId: string | null = null;
		let metricId: string | null = null;
		for (const level of sidebarState.navStack) {
			if (level.type === 'area') areaId = level.areaId;
			if (level.type === 'subarea') subareaId = level.subareaId;
			if (level.type === 'metric') metricId = level.metricId;
		}
		if (!metricId && scenarioPanelState.metricId) metricId = scenarioPanelState.metricId;

		if (!areaId || !subareaId) {
			if (metricId) {
				const f = findMetricInTaxonomy(appState, metricId);
				if (f) {
					areaId = f.area.id;
					subareaId = f.subarea.id;
				}
			}
			if (subareaId && !areaId) {
				for (const a of appState.taxonomy.areas) {
					if (a.subareas.some((s) => s.id === subareaId)) {
						areaId = a.id;
						break;
					}
				}
			}
		}

		const area = areaId ? appState.taxonomy.areas.find((a) => a.id === areaId) : null;
		const subarea = area && subareaId ? area.subareas.find((s) => s.id === subareaId) : null;
		const metric = metricId ? findMetricInTaxonomy(appState, metricId)?.metric ?? null : null;

		const isOverview = top.type === 'overview';

		// Model crumb — always present; click returns to overview (choose an area)
		list.push({
			label: 'Model',
			value: getModelName(appState),
			onClick: isOverview
				? null
				: () => {
						sidebarState.navStack = [{ type: 'overview' }];
						closeScenarioPanel();
					},
			noTruncate: true
		});

		// Subarea crumb — click navigates to the area panel (choose a subarea)
		if (subarea && area) {
			const aId = area.id;
			list.push({
				label: 'Subarea',
				value: subarea.name,
				onClick: () => {
					sidebarNavigateTo({ type: 'area', areaId: aId });
					closeScenarioPanel();
				}
			});
		}

		// Metric crumb — click navigates to the subarea panel (choose a metric)
		if (metric && metricId && subarea && area) {
			const aId = area.id;
			const sId = subarea.id;
			list.push({
				label: 'Metric',
				value: metric.name,
				onClick: () => {
					sidebarNavigateTo(
						{ type: 'area', areaId: aId },
						{ type: 'subarea', subareaId: sId }
					);
					closeScenarioPanel();
				}
			});
		}

		// Scenario terminal crumb — value is the scenario index (1-based)
		if (scenarioPanelState.scenarioMeta && metricId) {
			const scenarios = filterScenariosByAge(appState, metricId);
			const idx = scenarios.findIndex(
				(s) => s.scenario_id === scenarioPanelState.scenarioMeta?.scenario_id
			);
			list.push({
				label: 'Scenario',
				value: String(idx + 1),
				onClick: null
			});
		}

		return list;
	});
</script>

{#if crumbs.length > 0}
	<div
		class="sticky top-0 z-20 flex min-h-[64px] items-stretch justify-between gap-2 border-b border-[#d1d5db] bg-white px-[14px] py-[10px]"
		style="border-left: 3px solid #0e7490;"
	>
		<div class="flex min-w-0 flex-1 items-stretch gap-[6px] overflow-hidden">
			{#each crumbs as c, i (i)}
				{#if i > 0}
					<div class="flex flex-shrink-0 items-center">
						<i class="fa-solid fa-chevron-right text-[10px] font-[900] text-[#d1d5db]"></i>
					</div>
				{/if}
				{@const isLast = i === crumbs.length - 1}
				{@const shrinkClass = c.noTruncate ? 'flex-shrink-0' : 'min-w-0 flex-shrink'}
				{@const crumbClasses = `flex ${shrinkClass} flex-col justify-center gap-[1px] rounded-[6px] px-[6px] py-[2px] transition-colors duration-150`}
				{@const valueTruncateClass = c.noTruncate ? 'whitespace-nowrap' : 'truncate'}
				{@const labelClasses = 'whitespace-nowrap text-[9px] font-[700] tracking-[0.06em] uppercase ' + (isLast ? 'text-[#0e7490]' : 'text-[#9ca3af]')}
				{@const valueClasses = `${valueTruncateClass} text-[13px] leading-[1.2] font-[700] tracking-[-0.01em] ` + (isLast ? 'text-[#084342]' : 'text-[#374151]')}
				{#if c.onClick}
					<button
						class="{crumbClasses} cursor-pointer border-none bg-transparent text-left hover:bg-[#f3f4f6]"
						onclick={c.onClick}
						title="{c.label}: {c.value}"
					>
						<span class={labelClasses}>{c.label}</span>
						<span class="{valueClasses} hover:text-[#0e7490]">{c.value}</span>
					</button>
				{:else}
					<div class={crumbClasses} title="{c.label}: {c.value}">
						<span class={labelClasses}>{c.label}</span>
						<span class={valueClasses}>{c.value}</span>
					</div>
				{/if}
			{/each}
		</div>
		{#if scenarioPanelState.open}
			<button
				class="flex h-[32px] w-[32px] flex-shrink-0 cursor-pointer items-center justify-center self-center rounded-full border border-[#e5e7eb] bg-white text-[#6b7280] transition-colors duration-150 hover:border-[#0e7490] hover:text-[#0e7490]"
				aria-label="Close"
				onclick={closeScenarioPanel}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		{/if}
	</div>
{/if}
