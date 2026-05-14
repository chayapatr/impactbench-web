<script lang="ts">
	import {
		appState,
		sidebarState,
		sidebarPush,
		sidebarBack,

		nutritionLabelState,
		type NavLevel,
		type ThemeMetricItem
	} from '$lib/store.svelte';
	import { formatScore, scoreToClass, scoreInterpretation, scoreColors, scorePillStyle } from '$lib/scores';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import { loadScenarioDetail } from '$lib/data';
	import { marked } from 'marked';
	import type { ScenarioMeta, ScenarioDetail } from '$lib/types';

	// Expanded metric state for inline accordion
	let expandedMetricId: string | null = $state(null);
	let expandedScenarios: ScenarioMeta[] = $state([]);

	function toggleMetric(metricId: string) {
		if (expandedMetricId === metricId) {
			expandedMetricId = null;
			expandedScenarios = [];
		} else {
			expandedMetricId = metricId;
			const currentAge = appState.filters.age;
			expandedScenarios = (appState.scenarioIndex?.[metricId] ?? []).filter((sc) => sc.age === currentAge);
		}
	}

	function computeAreaScore(areaId: string): number {
		const area = appState.taxonomy?.areas.find((a) => a.id === areaId);
		if (!area) return 0;
		const vals: number[] = [];
		for (const sub of area.subareas)
			for (const m of sub.metrics) {
				const s = getCurrentScores()[m.id];
				if (s !== undefined) vals.push(s);
			}
		return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
	}

	function computeSubareaScore(subareaId: string): number {
		for (const area of appState.taxonomy?.areas ?? []) {
			const sub = area.subareas.find((s) => s.id === subareaId);
			if (sub) {
				const vals = sub.metrics.map((m) => getCurrentScores()[m.id] ?? 0);
				return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
			}
		}
		return 0;
	}

	function getCurrentScores(): Record<string, number> {
		return appState.benchmarkData[`${appState.filters.model}|${appState.filters.age}`] ?? {};
	}

	function getCurrentModelName(): string {
		return appState.models.find((m) => m.id === appState.filters.model)?.name ?? appState.filters.model;
	}

	function getCurrentModelProvider(): string {
		return appState.models.find((m) => m.id === appState.filters.model)?.provider ?? '';
	}

	// Group models by provider
	function getModelGroups(): Record<string, typeof appState.models> {
		const byProvider: Record<string, typeof appState.models> = {};
		for (const m of appState.models) {
			if (!byProvider[m.provider]) byProvider[m.provider] = [];
			byProvider[m.provider].push(m);
		}
		return byProvider;
	}

	type AncestorInfo = { name: string; icon: string | null; score: number | null; navIdx: number };

	function getAncestors(): AncestorInfo[] {
		const result: AncestorInfo[] = [];
		const stackWithoutTop = sidebarState.navStack.slice(0, -1);
		stackWithoutTop.forEach((level, idx) => {
			if (level.type === 'overview') return;
			if (level.type === 'area' && appState.taxonomy) {
				const area = appState.taxonomy.areas.find((a) => a.id === level.areaId);
				if (area)
					result.push({ name: area.name, icon: area.icon, score: computeAreaScore(level.areaId), navIdx: idx });
			} else if (level.type === 'subarea' && appState.taxonomy) {
				for (const area of appState.taxonomy.areas) {
					const sub = area.subareas.find((s) => s.id === level.subareaId);
					if (sub) {
						result.push({ name: sub.name, icon: sub.icon, score: computeSubareaScore(level.subareaId), navIdx: idx });
						break;
					}
				}
			} else if (level.type === 'metric') {
				result.push({ name: level.metricName, icon: null, score: getCurrentScores()[level.metricId] ?? null, navIdx: idx });
			}
		});
		return result;
	}

	let scenarioDetail: ScenarioDetail | null = $state(null);
	let scenarioLoading = $state(false);
	let scenarioError = $state(false);

	$effect(() => {
		const top = sidebarState.navStack[sidebarState.navStack.length - 1];
		// Load scenario conversation when navigating to scenario page
		if (top.type === 'scenario') {
			const { metricId, scenarioMeta } = top;
			scenarioDetail = null;
			scenarioLoading = true;
			scenarioError = false;
			loadScenarioDetail(scenarioMeta.benchmark, appState.filters.model, scenarioMeta.scenario_id)
				.then((d) => { scenarioDetail = d; scenarioLoading = false; })
				.catch(() => { scenarioLoading = false; scenarioError = true; });
		}
		// Reset accordion when leaving subarea
		if (top.type !== 'subarea') {
			expandedMetricId = null;
			expandedScenarios = [];
		}
	});

	const top = $derived(sidebarState.navStack[sidebarState.navStack.length - 1]);
	const isFocused = $derived(top.type !== 'overview');
	const ancestors = $derived(getAncestors());

	const overallScore = $derived(() => {
		const vals = Object.values(getCurrentScores());
		return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
	});

	const overallCls = $derived(() => scoreToClass(overallScore()));

</script>

<div class="flex flex-col h-full overflow-hidden bg-[#fafaf9]">
	<!-- Header (hidden in focus/drill-down mode) -->
	<div class="flex-shrink-0 border-b border-[#f3f4f6] {isFocused ? 'hidden' : ''}" id="sb-header">
		<div class="px-[14px] pt-[20px] pb-[14px]">
			<div class="flex items-center gap-3">
				<div class="flex-1 min-w-0">
					<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-[3px]">{getCurrentModelProvider()}</div>
					<div class="text-[16px] font-[800] text-[#1a1a1a] tracking-[-0.02em] leading-[1.2] truncate">{getCurrentModelName()}</div>
				</div>
				<span
					class="inline-block px-[7px] py-[2px] rounded-[7px] text-[12px] font-[700] flex-shrink-0 text-center"
					style={scorePillStyle(overallScore())}
				>{formatScore(overallScore())}</span>
			</div>
		</div>
	</div>

	<!-- Scrollable summary panel -->
	<div class="flex-1 overflow-y-auto text-[14px]" id="summary-panel">
		{#if top.type === 'overview'}
			<!-- Overview -->
			<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] px-[14px] pt-[10px] pb-2 mt-4 flex items-center justify-between gap-2">
				Well-being Areas
			</div>
			<div class="px-[14px] pb-1 flex flex-col gap-[6px]">
				{#each appState.taxonomy?.areas ?? [] as area (area.id)}
					{@const areaScore = computeAreaScore(area.id)}
					{@const interp = scoreInterpretation(areaScore)}
					<button
						class="w-full text-left flex flex-col bg-white border-[1.5px] border-[#e5e7eb] rounded-[10px] px-4 py-[10px] cursor-pointer transition-[border-color] duration-150 hover:border-[#00b3b0]"
						onclick={() => sidebarPush({ type: 'area', areaId: area.id })}
					>
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 flex-1 min-w-0">
								<i class="fa-solid {area.icon} text-[15px] flex-shrink-0"></i>
								<span class="text-[13px] font-semibold text-[#1a1a1a]">{area.name}</span>
							</div>
							<span
								class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
								style={scorePillStyle(areaScore)}
							>{formatScore(areaScore)}</span>
						</div>
						<div class="text-[11px] text-[#9ca3af] mt-[5px] leading-[1.35] text-balance">{interp}</div>
					</button>
				{/each}
			</div>

			<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] px-[14px] pt-[10px] pb-2 mt-4 flex items-center justify-between gap-2">
				Score Scale
			</div>
			<div class="px-[14px] pb-4 flex flex-col gap-[6px]">
				{#each [{ pill: '−1', label: 'AI consistently harms this dimension', cls: 'negative' }, { pill: '0', label: 'No net effect on well-being', cls: 'neutral' }, { pill: '+1', label: 'AI consistently benefits this dimension', cls: 'positive' }] as row (row.cls)}
					<div class="flex items-center gap-2">
						<span
							class="inline-block px-[9px] py-0.5 rounded-[12px] text-[12px] font-semibold flex-shrink-0 min-w-[34px] text-center"
							class:bg-[#dcfce7]={row.cls === 'positive'}
							class:text-[#16a34a]={row.cls === 'positive'}
							class:bg-[#fee2e2]={row.cls === 'negative'}
							class:text-[#dc2626]={row.cls === 'negative'}
							class:bg-[#f3f4f6]={row.cls === 'neutral'}
							class:text-[#6b7280]={row.cls === 'neutral'}
						>{row.pill}</span>
						<span class="text-[12px] text-[#6b7280] leading-[1.4]">{row.label}</span>
					</div>
				{/each}
			</div>

		{:else if top.type === 'area' && appState.taxonomy}
			{@const area = appState.taxonomy.areas.find((a) => a.id === top.areaId)}
			{#if area}
				{@const areaScore = computeAreaScore(area.id)}
				{@const areaDesc = AREA_DESCRIPTIONS[area.id] ?? ''}
				{@const cls = scoreToClass(areaScore)}
				{@const areaColors = scoreColors(areaScore)}

				<!-- Sticky header -->
				<div class="sticky top-0 z-10 bg-white border-b border-[#f3f4f6] ">
					<div class="px-[14px] pt-[10px] pb-[8px] flex items-center justify-between gap-2">
						<button class="flex items-center gap-[5px] px-[10px] py-[4px] rounded-[6px] border-[1.5px] border-[#e5e7eb] text-[12px] font-semibold text-[#6b7280] cursor-pointer transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:text-[#00b3b0] hover:bg-[#e0f7f7]" onclick={sidebarBack}>
							<i class="fa-solid fa-arrow-left text-[10px]"></i> All Areas
						</button>
						<div class="flex items-center gap-[5px] flex-shrink-0">
							<span class="text-[11px] font-semibold text-[#6b7280] truncate max-w-[100px]">{getCurrentModelName()}</span>
							<span class="text-[10px] font-medium text-[#6b7280] border border-[#d1d5db] rounded-[5px] px-[5px] py-[1px]">{appState.filters.age === 'adult' ? '18+' : '6–17'}</span>
						</div>
					</div>
					<div style="border-left: 5px solid {areaColors.color}; background: {areaColors.light}; border-bottom: 1px solid {areaColors.border}; padding: 12px 16px;">
						<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[4px]">Well-being Area</div>
						<div class="flex items-center gap-2">
							<i class="fa-solid {area.icon} text-[15px] flex-shrink-0"></i>
							<span class="text-[15px] font-[800] text-[#1a1a1a] tracking-[-0.02em] leading-[1.2] flex-1 min-w-0">{area.name}</span>
							<span
								class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
								style={scorePillStyle(areaScore)}
							>{formatScore(areaScore)}</span>
						</div>
					</div>
				</div>

				{#if areaDesc}
					<div class="px-[14px] pt-3 pb-2">
						<p class="text-[12px] text-[#6b7280] leading-[1.6] text-balance">{areaDesc}</p>
					</div>
				{/if}

				<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] px-[14px] pt-[10px] pb-2 mt-4 flex items-center justify-between gap-2">
					Subareas
				</div>
				<div class="px-[14px] pb-4 flex flex-col gap-[6px]">
					{#each area.subareas as sub (sub.id)}
						{@const subScore = computeSubareaScore(sub.id)}
						{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
						<button
							class="w-full text-left flex flex-col bg-white border-[1.5px] border-[#e5e7eb] rounded-[10px] px-4 py-[10px] cursor-pointer transition-[border-color] duration-150 hover:border-[#00b3b0]"
							onclick={() => sidebarPush({ type: 'subarea', subareaId: sub.id })}
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2 flex-1 min-w-0">
									<i class="fa-solid {sub.icon} text-[15px] flex-shrink-0"></i>
									<span class="text-[13px] font-semibold text-[#1a1a1a] truncate">{sub.name}</span>
								</div>
								<span
									class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
									style={scorePillStyle(subScore)}
								>{formatScore(subScore)}</span>
							</div>
							{#if subDesc}
								<div class="text-[11px] text-[#9ca3af] mt-[5px] leading-[1.35] text-balance">{subDesc}</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

		{:else if top.type === 'subarea' && appState.taxonomy}
			{@const scores = getCurrentScores()}
			{@const subareaScore = computeSubareaScore(top.subareaId)}
			{@const subareaTuple = (() => {
				for (const area of appState.taxonomy.areas) {
					const sub = area.subareas.find((s) => s.id === top.subareaId);
					if (sub) return { sub, area };
				}
				return null;
			})()}

			{#if subareaTuple}
				{@const { sub, area } = subareaTuple}
				{@const subDesc = SUBAREA_DESCRIPTIONS[sub.id] ?? ''}
				{@const metrics = sub.metrics.map((m) => ({ ...m, score: scores[m.id] ?? 0 }))}
				{@const sorted =
					sidebarState.behaviorSort === 'score-desc'
						? [...metrics].sort((a, b) => b.score - a.score)
						: sidebarState.behaviorSort === 'score-asc'
							? [...metrics].sort((a, b) => a.score - b.score)
							: sidebarState.behaviorSort === 'name-asc'
								? [...metrics].sort((a, b) => a.name.localeCompare(b.name))
								: metrics}
				{@const posMetrics = metrics.filter((m) => !m.harmful)}
				{@const negMetrics = metrics.filter((m) => m.harmful)}
				{@const posAvg = posMetrics.length ? posMetrics.reduce((s, m) => s + m.score, 0) / posMetrics.length : 0}
				{@const negAvg = negMetrics.length ? negMetrics.reduce((s, m) => s + m.score, 0) / negMetrics.length : 0}
				{@const cls = scoreToClass(subareaScore)}
				{@const subColors = scoreColors(subareaScore)}

				<!-- Sticky header -->
				<div class="sticky top-0 z-10 bg-white border-b border-[#f3f4f6] ">
					<div class="px-[14px] pt-[10px] pb-[8px] flex items-center justify-between gap-2">
						<button class="flex items-center gap-[5px] px-[10px] py-[4px] rounded-[6px] border-[1.5px] border-[#e5e7eb] text-[12px] font-semibold text-[#6b7280] cursor-pointer transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:text-[#00b3b0] hover:bg-[#e0f7f7]" onclick={sidebarBack}>
							<i class="fa-solid fa-arrow-left text-[10px]"></i> {area.name}
						</button>
						<div class="flex items-center gap-[5px] flex-shrink-0">
							<span class="text-[11px] font-semibold text-[#6b7280] truncate max-w-[100px]">{getCurrentModelName()}</span>
							<span class="text-[10px] font-medium text-[#6b7280] border border-[#d1d5db] rounded-[5px] px-[5px] py-[1px]">{appState.filters.age === 'adult' ? '18+' : '6–17'}</span>
						</div>
					</div>
					<div style="border-left: 5px solid {subColors.color}; background: {subColors.light}; border-bottom: 1px solid {subColors.border}; padding: 12px 16px;">
						<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[4px]">{area.name} ›</div>
						<div class="flex items-center gap-2">
							<i class="fa-solid {sub.icon} text-[15px] flex-shrink-0"></i>
							<span class="text-[15px] font-[700] text-[#1a1a1a] tracking-[-0.02em] leading-[1.2] flex-1 min-w-0">{sub.name}</span>
							<span
								class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
								style={scorePillStyle(subareaScore)}
							>{formatScore(subareaScore)}</span>
						</div>
					</div>
				</div>

				{#if subDesc}
					<div class="px-[14px] pt-3 pb-2">
						<p class="text-[12px] text-[#6b7280] leading-[1.6] text-balance">{subDesc}</p>
					</div>
				{/if}

				<!-- Score breakdown bars -->
				<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] px-[14px] pt-[10px] pb-2 mt-4 flex items-baseline gap-1.5">
					Score Breakdown <span class="text-[10px] normal-case font-normal tracking-normal text-[#b0b8c1]">(higher is better)</span>
				</div>
				<div class="px-[14px] pb-3 flex flex-col gap-3">
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<span class="text-[12px] font-semibold text-[#374151] flex items-center gap-1.5">
								<span class="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[10px] font-[800]" style="border:1.5px solid #93c5fd;color:#60a5fa">+</span>
								Promoting good behavior <span class="text-[#9ca3af] font-normal">· {posMetrics.length} metrics</span>
							</span>
							<span class="text-[12px] font-bold" style="color:#60a5fa">{posAvg.toFixed(2)}</span>
						</div>
						<div class="w-full h-[8px] bg-[#f3f4f6] rounded-[4px] overflow-hidden">
							<div class="h-full bg-[#93c5fd] rounded-[4px] transition-[width] duration-300" style="width:{Math.round(posAvg * 100)}%"></div>
						</div>
					</div>
					{#if negMetrics.length > 0}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<span class="text-[12px] font-semibold text-[#374151] flex items-center gap-1.5">
									<span class="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[10px] font-[800]" style="border:1.5px solid #fdba74;color:#f97316">×</span>
									Avoiding bad behavior <span class="text-[#9ca3af] font-normal">· {negMetrics.length} metrics</span>
								</span>
								<span class="text-[12px] font-bold" style="color:#f97316">{(1 - negAvg).toFixed(2)}</span>
							</div>
							<div class="w-full h-[8px] bg-[#f3f4f6] rounded-[4px] overflow-hidden">
								<div class="h-full bg-[#fdba74] rounded-[4px] transition-[width] duration-300" style="width:{Math.round((1 - negAvg) * 100)}%"></div>
							</div>
						</div>
					{/if}
				</div>

				{@const metricById = Object.fromEntries(metrics.map(m => [m.id, m]))}
				{@const hasGroups = sub.groups && sub.groups.length > 0}

				{#snippet metricRow(m: typeof metrics[0])}
					<div>
						<button
							class="w-full text-left flex items-center gap-[8px] border-l-[3px] px-[14px] py-[7px] transition-colors duration-150 hover:bg-[#f3f4f6]
								{expandedMetricId === m.id ? 'bg-[#f3f4f6] border-l-[#00b3b0]' : 'border-l-transparent'}"
							onclick={() => toggleMetric(m.id)}
						>
							<span
								class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[11px] font-[800] flex-shrink-0 leading-none"
								style={m.harmful ? 'border:1.5px solid #fdba74;color:#f97316' : 'border:1.5px solid #93c5fd;color:#60a5fa'}
							>{m.harmful ? '×' : '+'}</span>
							<span class="flex-1 text-[12px] text-[#374151] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{m.name}</span>
							<span
								class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
								style={scorePillStyle(m.score)}
							>{formatScore(m.score)}</span>
							<i class="fa-solid {expandedMetricId === m.id ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px] text-[#9ca3af] flex-shrink-0"></i>
						</button>
						{#if expandedMetricId === m.id}
							<div class="bg-[#f9fafb] pb-1">
								{#if expandedScenarios.length === 0}
									<p class="text-[11px] text-[#9ca3af] px-[28px] py-2">No scenarios available.</p>
								{:else}
									{#each expandedScenarios as sc (sc.scenario_id)}
										{@const rawResult = sc.verdicts?.[appState.filters.model]}
										{@const pass = rawResult === undefined ? null : m.harmful ? rawResult === 'no' : rawResult === 'yes'}
										<button
											class="w-full text-left flex items-center gap-[8px] px-[28px] py-[9px] transition-colors duration-150 hover:bg-[#f3f4f6]"
											onclick={() => sidebarPush({ type: 'scenario', metricId: m.id, scenarioMeta: sc })}
										>
											{#if pass !== null}
												<span
													class="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[9px] font-[800] flex-shrink-0 leading-none"
													style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
												>{pass ? '✓' : '✗'}</span>
											{:else}
												<span class="w-[16px] h-[16px] rounded-full bg-[#f3f4f6] flex-shrink-0"></span>
											{/if}
											<span class="flex-1 text-[12px] text-[#374151] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{sc.title}</span>
											<i class="fa-solid fa-chevron-right text-[9px] text-[#9ca3af] flex-shrink-0"></i>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				{/snippet}

				{#if hasGroups}
					<!-- Grouped view with section headers -->
					<div class="pb-4 flex flex-col gap-5 mt-3">
						{#each sub.groups as group (group.name)}
							{@const groupMetrics = group.metric_ids.map(id => metricById[id]).filter(Boolean)}
							{#if groupMetrics.length > 0}
								<div>
									<div class="text-[10px] font-[700] uppercase tracking-[0.08em] text-[#9ca3af] px-[14px] pb-1.5 mb-0.5 border-b border-[#f3f4f6]">{group.name}</div>
									{#each groupMetrics as m (m.id)}
										{@render metricRow(m)}
									{/each}
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<!-- Flat view -->
					<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] px-6 pt-[10px] pb-2 mt-2 flex items-center justify-between gap-2">
						<span>All Behaviors</span>
						<div class="flex gap-[5px]">
							{#each [['score-desc','Score ↓'],['score-asc','Score ↑'],['name-asc','A–Z']] as [mode, label] (mode)}
								<button
									class="text-[11px] font-medium px-[10px] py-[3px] rounded-[12px] border-[1.5px] cursor-pointer transition-all duration-150
										{sidebarState.behaviorSort === mode
											? 'bg-[#e0f7f7] border-[#80d8d7] text-[#00b3b0] font-semibold'
											: 'bg-[#fafaf9] border-[#e5e7eb] text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]'}"
									onclick={() => (sidebarState.behaviorSort = mode as typeof sidebarState.behaviorSort)}
								>{label}</button>
							{/each}
						</div>
					</div>
					<div class="pb-4 flex flex-col">
						{#each sorted as m (m.id)}
							{@render metricRow(m)}
						{/each}
					</div>
				{/if}
			{/if}

		{:else if top.type === 'metric'}
			{@const scores = getCurrentScores()}
			{@const score = scores[top.metricId] ?? 0}
			{@const currentAge = appState.filters.age}
			{@const scenarios = (appState.scenarioIndex?.[top.metricId] ?? []).filter((sc) => sc.age === currentAge)}
			{@const cls = scoreToClass(score)}
			{@const metricColors = scoreColors(score)}
			{@const isHarmful = (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const sub of area.subareas)
						for (const m of sub.metrics)
							if (m.id === top.metricId) return m.harmful;
				return false;
			})()}

			<!-- Sticky header -->
			<div class="sticky top-0 z-10 bg-white border-b border-[#f3f4f6] ">
				<div class="px-[14px] pt-[10px] pb-[8px] flex items-center justify-between gap-2">
					<button class="flex items-center gap-[5px] px-[10px] py-[4px] rounded-[6px] border-[1.5px] border-[#e5e7eb] text-[12px] font-semibold text-[#6b7280] cursor-pointer transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:text-[#00b3b0] hover:bg-[#e0f7f7]" onclick={sidebarBack}>
						<i class="fa-solid fa-arrow-left text-[10px]"></i> {ancestors.length > 0 ? ancestors[ancestors.length - 1].name : 'Back'}
					</button>
					<span class="text-[11px] font-semibold text-[#9ca3af] truncate">{getCurrentModelName()}</span>
				</div>
				<div style="border-left: 5px solid {metricColors.color}; background: {metricColors.light}; border-bottom: 1px solid {metricColors.border}; padding: 12px 16px;">
					{#if ancestors.length > 0}
						<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[4px]">{ancestors[ancestors.length - 1].name} ›</div>
					{/if}
					<div class="flex items-start justify-between gap-2">
						<span class="text-[15px] font-[700] text-[#1a1a1a] tracking-[-0.01em] leading-[1.2] flex-1">{top.metricName}</span>
						<span
							class="inline-block px-[6px] py-[1px] rounded-[6px] text-[11px] font-semibold flex-shrink-0 min-w-[30px] text-center"
							style={scorePillStyle(score)}
						>{formatScore(score)}</span>
					</div>
				</div>
			</div>

			<div class="px-6 py-4">
				{#if scenarios.length === 0}
					<p class="text-[13px] text-[#6b7280] leading-[1.6]">No scenarios available for this metric.</p>
				{:else}
					<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-3">Scenarios</div>
					<div class="flex flex-col">
						{#each scenarios as sc (sc.scenario_id)}
							{@const rawResult = sc.verdicts?.[appState.filters.model]}
							{@const pass = rawResult === undefined ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
							<button
								class="w-full text-left flex items-center gap-[8px] border-l-[3px] border-l-transparent px-[14px] py-[7px] transition-colors duration-150 hover:bg-[#f3f4f6] hover:border-l-[#00b3b0]"
								onclick={() => sidebarPush({ type: 'scenario', metricId: top.metricId, scenarioMeta: sc })}
							>
								{#if pass !== null}
									<span
										class="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[9px] font-[800] flex-shrink-0 leading-none"
										style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
									>{pass ? '✓' : '✗'}</span>
								{:else}
									<span class="w-[16px] h-[16px] rounded-full bg-[#f3f4f6] flex-shrink-0"></span>
								{/if}
								<span class="flex-1 text-[12px] text-[#374151] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{sc.title}</span>
								<i class="fa-solid fa-chevron-right text-[9px] text-[#9ca3af] flex-shrink-0"></i>
							</button>
						{/each}
					</div>
				{/if}
			</div>

		{:else if top.type === 'scenario'}
			{@const isHarmful = (() => {
				for (const area of appState.taxonomy?.areas ?? [])
					for (const sub of area.subareas)
						for (const m of sub.metrics)
							if (m.id === top.metricId) return m.harmful;
				return false;
			})()}

			<!-- Sticky header -->
			<div class="sticky top-0 z-10 bg-white border-b border-[#f3f4f6] ">
				<div class="px-[14px] pt-[10px] pb-[8px] flex items-center justify-between gap-2">
					<button class="flex items-center gap-[5px] px-[10px] py-[4px] rounded-[6px] border-[1.5px] border-[#e5e7eb] text-[12px] font-semibold text-[#6b7280] cursor-pointer transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:text-[#00b3b0] hover:bg-[#e0f7f7]" onclick={sidebarBack}>
						<i class="fa-solid fa-arrow-left text-[10px]"></i> {ancestors.length > 0 ? ancestors[ancestors.length - 1].name : 'Back'}
					</button>
					<span class="text-[11px] font-semibold text-[#9ca3af] truncate">{getCurrentModelName()}</span>
				</div>
				<div style="border-left: 5px solid #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 12px 16px;">
					{#if ancestors.length > 0}
						<div class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-[4px]">{ancestors[ancestors.length - 1].name} ›</div>
					{/if}
					<span class="text-[14px] font-[600] text-[#1a1a1a] leading-[1.2]">{top.scenarioMeta.title}</span>
				</div>
			</div>

			<div class="px-6 py-4">
				{#if scenarioLoading}
					<p class="text-[13px] text-[#9ca3af]">Loading conversation…</p>
				{:else if scenarioError}
					<p class="text-[13px] text-[#dc2626]">Failed to load conversation.</p>
				{:else if scenarioDetail}
					{@const verdict = scenarioDetail.verdict ?? {}}
					{@const rawResult = verdict.result}
					{@const pass = rawResult == null ? null : isHarmful ? rawResult === 'no' : rawResult === 'yes'}
					{@const turns = scenarioDetail.samples?.[0] ?? []}
					<div class="flex items-center gap-2 mb-3">
						{#if pass !== null}
							<span
								class="text-[10px] font-bold px-2 py-0.5 rounded-full"
								style={pass ? 'background:#dcfce7;color:#16a34a' : 'background:#fee2e2;color:#dc2626'}
							>{pass ? 'Pass' : 'Fail'}</span>
						{/if}
					</div>
					{#if verdict.justification}
						<p class="text-[12px] text-[#6b7280] italic mb-4 leading-relaxed">{verdict.justification}</p>
					{/if}
					<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-3">Conversation</div>
					{#each turns as turn, i (i)}
						<div class="mb-2 {turn.role === 'user' ? 'text-right' : 'text-left'}">
							<div class="text-[9px] uppercase tracking-wide font-semibold mb-0.5 {turn.role === 'user' ? 'text-[#00b3b0]' : 'text-[#9ca3af]'}">{turn.role === 'user' ? 'User' : 'AI'}</div>
							<div class="inline-block text-[12px] px-3 py-2 rounded-xl max-w-[90%] text-left prose prose-sm max-w-none {turn.role === 'user' ? 'bg-[#e0f7f7] text-[#1a1a1a] prose-invert' : 'bg-[#f3f4f6] text-[#374151]'}">{@html marked.parse(turn.content)}</div>
						</div>
					{/each}
				{/if}
			</div>

		{:else if top.type === 'theme-metrics'}
			{@const scores = getCurrentScores()}
			{@const withScores = top.metrics.filter((m) => scores[m.id] !== undefined)}
			{@const avgScore = withScores.length ? withScores.reduce((s, m) => s + (scores[m.id] ?? 0), 0) / withScores.length : 0}
			{@const sorted = [...top.metrics].sort((a, b) => (scores[b.id] ?? -1) - (scores[a.id] ?? -1))}
			{@const cls = scoreToClass(avgScore)}
			{@const themeColors = scoreColors(avgScore)}

			<!-- Sticky header -->
			<div class="sticky top-0 z-10 bg-white border-b border-[#f3f4f6] ">
				<div class="px-[14px] pt-[10px] pb-[8px]">
					<button class="flex items-center gap-[5px] px-[10px] py-[4px] rounded-[6px] border-[1.5px] border-[#e5e7eb] text-[12px] font-semibold text-[#6b7280] cursor-pointer transition-[border-color,color,background] duration-150 hover:border-[#00b3b0] hover:text-[#00b3b0] hover:bg-[#e0f7f7] w-fit" onclick={sidebarBack}>
						<i class="fa-solid fa-arrow-left text-[10px]"></i> Back
					</button>
				</div>
				<div
					style="border-left: 5px solid {themeColors.color}; background: {themeColors.light}; border-bottom: 1px solid {themeColors.border}; padding: 14px 16px 14px;"
				>
					<div class="text-[9px] font-[800] uppercase tracking-[0.1em] text-[#374151] opacity-70 mb-[5px]">Focus Area</div>
					<div class="flex items-center gap-2">
						<span class="text-[17px] font-[700] text-[#1a1a1a] tracking-[-0.02em] leading-[1.2] flex-1">{top.themeName}</span>
						<span
							class="inline-block px-[9px] py-0.5 rounded-[12px] text-[12px] font-semibold flex-shrink-0 min-w-[34px] text-center ml-auto"
							class:bg-[#dcfce7]={cls === 'positive'}
							class:text-[#16a34a]={cls === 'positive'}
							class:bg-[#fee2e2]={cls === 'negative'}
							class:text-[#dc2626]={cls === 'negative'}
							class:bg-[#f3f4f6]={cls === 'neutral'}
							class:text-[#6b7280]={cls === 'neutral'}
						>{formatScore(avgScore)}</span>
					</div>
				</div>
			</div>

			<div class="px-6 py-4">
				{#if top.themeDesc}
					<p class="text-[13px] text-[#6b7280] leading-[1.6] mb-3">{top.themeDesc}</p>
				{/if}
				<div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-3">
					Metrics ({top.metrics.length})
				</div>
				<div class="flex flex-col gap-0.5">
					{#each sorted as m (m.id)}
						{@const sc = scores[m.id]}
						{@const mCls = sc !== undefined ? scoreToClass(sc) : 'neutral'}
						<button
							class="w-full text-left flex items-center gap-[7px] py-1.5 px-2 rounded-[6px] cursor-pointer transition-colors duration-150 border border-transparent hover:bg-[#fafaf9] hover:border-[#e5e7eb]"
							onclick={() => sidebarPush({ type: 'metric', metricId: m.id, metricName: m.name })}
						>
							<span class="flex-1 text-[12px] text-[#1a1a1a]">{m.name}</span>
							{#if sc !== undefined}
								<span
									class="text-[12px] font-semibold flex-shrink-0"
									class:text-[#16a34a]={mCls === 'positive'}
									class:text-[#dc2626]={mCls === 'negative'}
									class:text-[#6b7280]={mCls === 'neutral'}
								>{formatScore(sc)}</span>
							{:else}
								<span class="text-[12px] text-[#d1d5db] flex-shrink-0">N/A</span>
							{/if}
							<span class="text-[#9ca3af] flex-shrink-0">›</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Site footer -->
	<div class="flex-shrink-0 px-4 py-3 border-t border-[#f3f4f6] flex flex-col gap-1.5">
		<p class="text-[11px] leading-[1.5] text-[#9ca3af]">MIT Media Lab · 77 Mass. Ave., E14/E15, Cambridge, MA 02139-4307 USA ⋅ <a href="https://accessibility.mit.edu/" target="_blank" rel="noopener" class="text-[#9ca3af] underline underline-offset-2 hover:text-[#6b7280]">Accessibility [↗]</a></p>
	</div>
</div>

<style>
	:global(.filter-select-style) {
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		background-size: 12px;
	}
	:global(.filter-select-style:hover) {
		border-color: #9ca3af;
	}
	:global(.filter-select-style:focus) {
		border-color: #00b3b0;
		box-shadow: 0 0 0 3px rgba(0, 179, 176, 0.12);
	}
</style>
