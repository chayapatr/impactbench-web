<script lang="ts">
	import { appState, leaderboardState, sidebarState, setFilters } from '$lib/store.svelte';
	import { makeBenchmarkKey } from '$lib/data';
	import { formatScore } from '$lib/scores';

	const AGE_OPTIONS = [
		{ value: 'adult', label: 'Adult (18+)' },
		{ value: 'child', label: 'Child / Teen (6–17)' }
	];

	interface Props {
		onModelSelect: (modelId: string) => void;
	}

	let { onModelSelect }: Props = $props();

	// Derive context from sidebar nav stack
	const navContext = $derived(() => {
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		if (top.type === 'scenario') {
			return { mode: 'scenario' as const, metricId: top.metricId, scenarioMeta: top.scenarioMeta };
		}
		if (top.type === 'metric') {
			return { mode: 'metric' as const, metricId: top.metricId };
		}
		if (top.type === 'subarea') {
			return { mode: 'subarea' as const, subareaId: top.subareaId };
		}
		if (top.type === 'area') {
			return { mode: 'area' as const, areaId: top.areaId };
		}
		if (top.type === 'smart-focus' || top.type === 'theme-metrics') {
			return { mode: 'overview' as const };
		}
		return { mode: 'overview' as const };
	});

	function computeSplitScore(modelId: string, areaId: string | null, subareaId: string | null, metricId: string | null) {
		const key = makeBenchmarkKey(modelId, appState.filters.age);
		const scores = appState.benchmarkData[key];
		if (!scores) return { avg: 0.5, pos: 0.5, neg: 0.5 };

		const posIds: string[] = [];
		const negIds: string[] = [];

		for (const area of appState.taxonomy?.areas ?? []) {
			if (areaId && area.id !== areaId) continue;
			for (const sub of area.subareas) {
				if (subareaId && sub.id !== subareaId) continue;
				for (const m of sub.metrics) {
					if (metricId && m.id !== metricId) continue;
					if ((m.behavior_type ?? (m.harmful ? 'restrain_harm' : 'flourishing')) === 'restrain_harm') negIds.push(m.id);
					else posIds.push(m.id);
				}
			}
		}

		if (posIds.length + negIds.length === 0) return { avg: 0.5, pos: 0.5, neg: 0.5 };

		const posVals = posIds.map((id) => scores[id] ?? 0);
		const negVals = negIds.map((id) => scores[id] ?? 0);
		const allVals = [...posVals, ...negVals];
		const pos = posVals.length ? posVals.reduce((a, b) => a + b, 0) / posVals.length : 0.5;
		const neg = negVals.length ? negVals.reduce((a, b) => a + b, 0) / negVals.length : 0.5;
		const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
		return { avg, pos, neg };
	}

	const ranked = $derived(() => {
		const ctx = navContext();
		const areaId = ctx.mode === 'area' ? ctx.areaId : null;
		const subareaId = ctx.mode === 'subarea' ? ctx.subareaId : null;
		const metricId = (ctx.mode === 'metric' || ctx.mode === 'scenario') ? ctx.metricId : null;

		return appState.models
			.map((m) => ({
				model: m,
				split: computeSplitScore(m.id, areaId, subareaId, metricId)
			}))
			.sort((a, b) => b.split.avg - a.split.avg);
	});

	const isSmartMode = $derived(() => {
		if (leaderboardState.smartRanked.length === 0) return false;
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		return top.type === 'smart-focus' || top.type === 'theme-metrics';
	});

	const subtitle = $derived(() => {
		if (isSmartMode()) return 'Rankings reflect your focus areas from Smart Explore.';
		const ctx = navContext();
		if (ctx.mode === 'scenario') {
			const sc = ctx.scenarioMeta;
			return `Pass/fail for scenario: ${sc.title}`;
		}
		if (ctx.mode === 'metric') {
			const metricName = (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const sub of area.subareas)
						for (const m of sub.metrics)
							if (m.id === ctx.metricId) return m.name;
				return ctx.metricId;
			})();
			return `Rankings filtered to metric: ${metricName}`;
		}
		if (ctx.mode === 'subarea') {
			for (const area of appState.taxonomy?.areas ?? [])
				for (const sub of area.subareas)
					if (sub.id === ctx.subareaId) return `Rankings filtered to ${sub.name}.`;
		}
		if (ctx.mode === 'area') {
			const area = appState.taxonomy?.areas.find((a) => a.id === ctx.areaId);
			return `Rankings filtered to the ${area?.name} area.`;
		}
		return 'Rankings reflect average impact across all 260 behavioral indicators.';
	});

	function selectModel(modelId: string) {
		onModelSelect(modelId);
	}
</script>

<!-- Leaderboard header (sticky) -->
<div class="sticky top-0 z-[1] flex-shrink-0 bg-white border-b border-[#f3f4f6]">
	<!-- Title row -->
	<div class="px-5 pt-[14px] pb-[10px]">
		<div class="flex items-center justify-between gap-2">
			<h2 class="flex items-center gap-2 text-[15px] font-[800] text-[#1a1a1a] tracking-[-0.01em]">
				<i class="fa-solid fa-trophy text-[12px] text-[#f59e0b]"></i>
				Model Rankings
			</h2>
			<span class="inline-block rounded bg-[#e5e7eb] px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-[0.5px] text-[#6b7280] uppercase">beta</span>
		</div>
		<p class="mt-[4px] text-[11px] leading-[1.4] text-[#9ca3af] text-balance">{subtitle()}</p>
	</div>

	<!-- Age group filter -->
	<div class="px-5 pb-[10px]">
		<div class="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-[5px]">Age Group</div>
		<div class="flex gap-[6px]">
			{#each AGE_OPTIONS as opt (opt.value)}
				<button
					class="flex-1 py-[3px] rounded-[12px] text-[11px] font-semibold border-[1.5px] transition-all duration-150 cursor-pointer
						{appState.filters.age === opt.value
							? 'bg-[#e0f7f7] border-[#80d8d7] text-[#00b3b0]'
							: 'bg-white border-[#e5e7eb] text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1a1a]'}"
					onclick={() => setFilters({ ...appState.filters, age: opt.value })}
				>{opt.label}</button>
			{/each}
		</div>
	</div>
</div>

<!-- Context panel -->
{#if navContext().mode !== 'overview'}
	{@const ctx = navContext()}
	<div class="mx-3 mb-[6px] mt-1 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-[10px] py-[8px]">
		<div class="text-[10px] font-[700] uppercase tracking-[0.06em] text-[#9ca3af] mb-[4px]">Scoring based on</div>
		{#if ctx.mode === 'scenario'}
			<div class="flex items-center gap-[6px]">
				<i class="fa-solid fa-comment-dots text-[10px] text-[#6b7280] flex-shrink-0"></i>
				<span class="text-[11px] font-semibold text-[#1a1a1a] leading-[1.3]">{ctx.scenarioMeta.title}</span>
			</div>
			<div class="text-[10px] text-[#9ca3af] mt-[2px] ml-[16px]">Pass / Fail per model</div>
		{:else if ctx.mode === 'metric'}
			{@const metricName = (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const sub of area.subareas)
						for (const m of sub.metrics)
							if (m.id === ctx.metricId) return m.name;
				return ctx.metricId;
			})()}
			<div class="flex items-center gap-[6px]">
				<i class="fa-solid fa-circle-dot text-[10px] text-[#6b7280] flex-shrink-0"></i>
				<span class="text-[11px] font-semibold text-[#1a1a1a] leading-[1.3]">{metricName}</span>
			</div>
		{:else if ctx.mode === 'subarea'}
			{@const sub = (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const s of area.subareas)
						if (s.id === ctx.subareaId) return s;
				return null;
			})()}
			<div class="flex items-center gap-[6px]">
				<i class="fa-solid {sub?.icon ?? 'fa-layer-group'} text-[10px] text-[#6b7280] flex-shrink-0"></i>
				<span class="text-[11px] font-semibold text-[#1a1a1a]">{sub?.name ?? ctx.subareaId}</span>
			</div>
		{:else if ctx.mode === 'area'}
			{@const area = appState.taxonomy?.areas.find((a) => a.id === ctx.areaId)}
			<div class="flex items-center gap-[6px]">
				<i class="fa-solid {area?.icon ?? 'fa-layer-group'} text-[10px] text-[#6b7280] flex-shrink-0"></i>
				<span class="text-[11px] font-semibold text-[#1a1a1a]">{area?.name ?? ctx.areaId}</span>
			</div>
		{/if}
	</div>
{/if}

<!-- Rankings list -->
<div class="flex-1 overflow-y-auto py-[6px] pb-0">
	{#if isSmartMode()}
		<div class="mx-3 my-2.5 rounded-[8px] bg-[#e0f7f7] px-[10px] py-[6px] text-[11px] font-semibold tracking-[0.06em] text-[#00b3b0] uppercase">
			<i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Smart Rankings
		</div>
		{#each leaderboardState.smartRanked as entry, idx (entry.id)}
			{@const rank = idx + 1}
			{@const split = computeSplitScore(entry.id, null, null, null)}
			{@const posPct = Math.round(split.pos * 100)}
			{@const negPct = Math.round((1 - split.neg) * 100)}
			<button
				class="flex w-full cursor-pointer items-center gap-[5px] border-l-[3px] px-[12px] py-[9px] text-left transition-colors duration-150
					{appState.filters.model === entry.id
					? 'border-l-[#00b3b0] bg-[#e0f7f7]'
					: 'border-l-transparent hover:bg-[#f3f4f6]'}"
				onclick={() => selectModel(entry.id)}
			>
				<span class="w-[18px] mr-[4px] flex-shrink-0 text-center text-[11px] font-bold {rank <= 3 ? 'text-[#f59e0b]' : 'text-[#9ca3af]'}">{rank}</span>
				<div class="min-w-0 flex-1">
					<div class="truncate text-[12px] font-semibold text-[#1a1a1a]">{entry.name}</div>
					<div class="text-[10px] text-[#9ca3af]">{entry.provider}</div>
				</div>
				<div
					class="flex h-[6px] w-[72px] flex-shrink-0 items-center overflow-hidden rounded-full bg-[#f3f4f6]"
					title="Harm avoidance: {formatScore(split.neg)} | Promotes good: {formatScore(split.pos)}"
				>
					<div class="flex h-full flex-1 items-center justify-end overflow-hidden rounded-l-full bg-[#fee2e2]">
						<div class="h-full rounded-l-full bg-gradient-to-l from-[#f87171] to-[#dc2626]" style="width:{negPct}%"></div>
					</div>
					<div class="h-full w-[2px] flex-shrink-0 bg-white"></div>
					<div class="flex h-full flex-1 items-center justify-start overflow-hidden rounded-r-full bg-[#dcfce7]">
						<div class="h-full rounded-r-full bg-gradient-to-r from-[#4ade80] to-[#16a34a]" style="width:{posPct}%"></div>
					</div>
				</div>
				<span class="w-8 text-right text-[11px] font-semibold text-[#6b7280]">{formatScore(split.avg)}</span>
			</button>
		{/each}
	{:else}
		{@const ctx = navContext()}
		{#each ranked() as { model, split }, idx (model.id)}
			{@const rank = idx + 1}
			{@const posPct = Math.round(split.pos * 100)}
			{@const negPct = Math.round((1 - split.neg) * 100)}
			{@const isScenarioMode = ctx.mode === 'scenario'}
			{@const verdict = isScenarioMode ? ctx.scenarioMeta.verdicts?.[model.id] : undefined}
			{@const isHarmful = isScenarioMode ? (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const sub of area.subareas)
						for (const m of sub.metrics)
							if (m.id === ctx.metricId) return m.behavior_type === 'restrain_harm' && m.measurement === 'presence';
				return false;
			})() : false}
			{@const pass = verdict === undefined ? null : isHarmful ? verdict === 'no' : verdict === 'yes'}
			<button
				class="flex w-full cursor-pointer items-center gap-[5px] border-l-[3px] px-[12px] py-[9px] text-left transition-colors duration-150
					{appState.filters.model === model.id
					? 'border-l-[#00b3b0] bg-[#e0f7f7]'
					: 'border-l-transparent hover:bg-[#f3f4f6]'}"
				onclick={() => selectModel(model.id)}
			>
				<span class="w-[18px] mr-[4px] flex-shrink-0 text-center text-[11px] font-bold {rank <= 3 ? 'text-[#f59e0b]' : 'text-[#9ca3af]'}">{rank}</span>
				<div class="min-w-0 flex-1">
					<div class="truncate text-[12px] font-semibold text-[#1a1a1a]">{model.name}</div>
					<div class="text-[10px] text-[#9ca3af]">{model.provider}</div>
				</div>
				{#if isScenarioMode}
					<!-- Pass/fail indicator -->
					{#if pass !== null}
						<span
							class="text-[10px] font-bold px-[7px] py-[2px] rounded-full flex-shrink-0"
							style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
						>{pass ? 'Pass' : 'Fail'}</span>
					{:else}
						<span class="text-[10px] text-[#c4c9d4] flex-shrink-0">—</span>
					{/if}
				{:else}
					<!-- Split pos/neg bar -->
					<div
						class="flex h-[6px] w-[72px] flex-shrink-0 items-center overflow-hidden rounded-full bg-[#f3f4f6]"
						title="Harm avoidance: {formatScore(split.neg)} | Promotes good: {formatScore(split.pos)}"
					>
						<div class="flex h-full flex-1 items-center justify-end overflow-hidden rounded-l-full bg-[#fee2e2]">
							<div class="h-full rounded-l-full bg-gradient-to-l from-[#f87171] to-[#dc2626]" style="width:{negPct}%"></div>
						</div>
						<div class="h-full w-[2px] flex-shrink-0 bg-white"></div>
						<div class="flex h-full flex-1 items-center justify-start overflow-hidden rounded-r-full bg-[#dcfce7]">
							<div class="h-full rounded-r-full bg-gradient-to-r from-[#4ade80] to-[#16a34a]" style="width:{posPct}%"></div>
						</div>
					</div>
					<span class="w-8 text-right text-[11px] font-semibold text-[#6b7280]">{formatScore(split.avg)}</span>
				{/if}
			</button>
		{/each}
	{/if}
</div>
