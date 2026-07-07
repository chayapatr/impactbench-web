<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTaxonomy, makeBenchmarkKey } from '$lib/data';
	import type { NutritionCategoryDetail } from '$lib/data';
	import {
		appState,
		setData,
		setNutritionScore,
		setNutritionCat,
		setScenarioIndex,
		setFilters,
		scenarioPanelState,
		closeScenarioPanel
	} from '$lib/store.svelte';
	import type { ScenarioDetail, ScenarioMeta } from '$lib/types';
	import NutritionLabelPage from '$lib/components/pages/NutritionLabelPage.svelte';
	import NutritionCatPanel from '$lib/components/organisms/NutritionCatPanel.svelte';
	import LocalScenarioPanel from './LocalScenarioPanel.svelte';
	import { METRIC_MAP, CATEGORY_LABELS, CATEGORY_DESCRIPTIONS, CATEGORY_ORDER } from './metric-map';

	interface ChatTurn {
		role: 'user' | 'assistant';
		content: string;
	}
	interface ConversationRow {
		id: string;
		metric_id: string;
		metric_name?: string;
		persona?: string;
		user_persona?: string;
		user_goal?: string;
		latent_adversarial_goal?: string;
		demographic?: { age?: string; gender?: string };
		target?: { id?: string };
		transcript: ChatTurn[];
	}
	interface ScoreRow {
		id: string;
		metric_id: string;
		target_model?: string;
		present: boolean;
		passed: boolean;
		score: number | null;
		justification?: string;
	}

	let conversations: ConversationRow[] = $state([]);
	let scores: ScoreRow[] = $state([]);
	let modelName: string = $state('');
	let importError: string | null = $state(null);
	let dragging = $state(false);
	let ready = $state(false);

	// Local lookup for the conversation viewer — built once on import.
	let scenarioDetails: Map<string, ScenarioDetail> = $state(new Map());

	function ageOf(row: ConversationRow): 'child' | 'adult' {
		const raw = row.demographic?.age ?? '';
		return raw.toLowerCase().includes('child') || raw.includes('6-17') ? 'child' : 'adult';
	}

	async function buildAppState() {
		const taxonomy = await loadTaxonomy();

		const modelId = modelName || 'imported-model';
		const scoresById = new Map(scores.map((s) => [s.id, s]));

		// ── models / benchmarkData (per-metric scores, flat, for the sunburst) ──
		const flatScores: Record<string, number> = {};
		for (const row of conversations) {
			const s = scoresById.get(row.id);
			if (s?.score == null) continue;
			const meta = METRIC_MAP[row.metric_id];
			if (!meta) continue;
			for (const cat of meta.categories) {
				flatScores[`${cat}__${row.metric_id}`] = s.score;
			}
		}
		const benchmarkData = Object.fromEntries(
			['child', 'adult'].map((age) => [makeBenchmarkKey(modelId, age), flatScores])
		);

		// ── nutritionScore (per-category avg for this one model) ──
		const catScoreAcc = new Map<string, number[]>();
		for (const row of conversations) {
			const s = scoresById.get(row.id);
			if (s?.score == null) continue;
			const meta = METRIC_MAP[row.metric_id];
			if (!meta) continue;
			for (const cat of meta.categories) {
				if (!catScoreAcc.has(cat)) catScoreAcc.set(cat, []);
				catScoreAcc.get(cat)!.push(s.score);
			}
		}
		const nutritionScore = CATEGORY_ORDER.filter((c) => catScoreAcc.has(c)).map((catId) => {
			const vals = catScoreAcc.get(catId)!;
			return {
				id: catId,
				label: CATEGORY_LABELS[catId] ?? catId,
				models: { [modelId]: vals.reduce((a, b) => a + b, 0) / vals.length }
			};
		});

		// ── nutritionCat (per-category metric breakdown, for the drill-down panel) ──
		const catMetricAcc = new Map<string, Map<string, number[]>>();
		for (const row of conversations) {
			const s = scoresById.get(row.id);
			if (s?.score == null) continue;
			const meta = METRIC_MAP[row.metric_id];
			if (!meta) continue;
			for (const cat of meta.categories) {
				if (!catMetricAcc.has(cat)) catMetricAcc.set(cat, new Map());
				const byMetric = catMetricAcc.get(cat)!;
				if (!byMetric.has(row.metric_id)) byMetric.set(row.metric_id, []);
				byMetric.get(row.metric_id)!.push(s.score);
			}
		}
		const nutritionCat: NutritionCategoryDetail[] = CATEGORY_ORDER.filter((c) => catMetricAcc.has(c)).map(
			(catId) => ({
				id: catId,
				label: CATEGORY_LABELS[catId] ?? catId,
				description: CATEGORY_DESCRIPTIONS[catId],
				metrics: [...catMetricAcc.get(catId)!.keys()].map((mid) => ({
					id: mid,
					name: METRIC_MAP[mid]?.name ?? mid,
					type: METRIC_MAP[mid]?.type === 'negative' ? 'negative_behavior' : 'positive_behavior'
				}))
			})
		);

		// ── scenarioIndex (metric id -> scenario metas, for the panel's scenario list) ──
		const scenarioIndex: Record<string, ScenarioMeta[]> = {};
		scenarioDetails = new Map();
		for (const row of conversations) {
			const s = scoresById.get(row.id);
			const meta: ScenarioMeta = {
				scenario_id: row.id,
				title: row.user_goal ?? row.id,
				age: ageOf(row),
				benchmark: 'nutritional-label',
				verdicts: s ? { [modelId]: s.present ? 'yes' : 'no' } : {}
			};
			if (!scenarioIndex[row.metric_id]) scenarioIndex[row.metric_id] = [];
			scenarioIndex[row.metric_id].push(meta);

			scenarioDetails.set(row.id, {
				id: row.id,
				metric_id: row.metric_id,
				metric_name: METRIC_MAP[row.metric_id]?.name ?? row.metric_id,
				metric_type: METRIC_MAP[row.metric_id]?.type ?? 'positive',
				user_goal: row.user_goal ?? '',
				persona: row.persona ?? row.user_persona ?? '',
				latent_adversarial_goal: row.latent_adversarial_goal,
				transcript: row.transcript,
				justification: s?.justification
			});
		}

		const models = [{ id: modelId, name: modelId, provider: 'Imported', version: modelId, releaseYear: 2026 }];

		setData(taxonomy, models, benchmarkData);
		setNutritionScore(nutritionScore);
		setNutritionCat(nutritionCat);
		setScenarioIndex(scenarioIndex);
		setFilters({ model: modelId, age: 'adult' });

		ready = true;
	}

	async function handleFiles(files: FileList | null) {
		if (!files) return;
		importError = null;
		for (const file of Array.from(files)) {
			try {
				const text = await file.text();
				const json = JSON.parse(text);
				if (file.name.includes('conversations') || (Array.isArray(json) && json[0]?.transcript)) {
					conversations = json;
					if (json[0]?.target?.id) modelName = json[0].target.id;
				} else if (file.name.includes('scores') || (Array.isArray(json) && json[0]?.justification !== undefined)) {
					scores = json;
					if (!modelName && json[0]?.target_model) modelName = json[0].target_model;
				}
			} catch (e) {
				importError = `Failed to parse ${file.name}: ${(e as Error).message}`;
			}
		}
		if (conversations.length && scores.length) {
			await buildAppState();
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function reset() {
		conversations = [];
		scores = [];
		modelName = '';
		ready = false;
		closeScenarioPanel();
	}

	let nutritionCatPanel: { catId: string; modelId: string } | null = $state(null);
</script>

<svelte:head>
	<title>Nutritional Label</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Serif+Pro:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<link
		rel="stylesheet"
		href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
		crossorigin="anonymous"
	/>
</svelte:head>

<div class="single-card flex h-screen w-screen overflow-hidden bg-[#fafaf9]">
	{#if !ready}
		<div class="flex flex-1 items-center justify-center p-8">
			<div class="w-full max-w-lg">
				<h1 class="mb-1 text-2xl font-black tracking-tight">Nutritional Label</h1>
				<p class="mb-6 text-sm text-[#6b7280]">
					Drop or select <code class="rounded bg-[#f3f4f6] px-1">conversations.json</code> and
					<code class="rounded bg-[#f3f4f6] px-1">scores.json</code> from a
					<code class="rounded bg-[#f3f4f6] px-1">benchmarks/nutritional-label/runs/&lt;model&gt;/</code>
					folder. Any upload here is assumed to be a nutritional-label benchmark run.
				</p>

				<label
					class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors"
					class:border-[#00b3b0]={dragging}
					class:bg-[#f0fafa]={dragging}
					class:border-[#d1d5db]={!dragging}
					ondragover={(e) => {
						e.preventDefault();
						dragging = true;
					}}
					ondragleave={() => (dragging = false)}
					ondrop={onDrop}
				>
					<i class="fa-solid fa-file-import text-3xl text-[#9ca3af]"></i>
					<span class="text-sm font-semibold text-[#374151]">Drop JSON files here, or click to browse</span>
					<input
						type="file"
						accept="application/json"
						multiple
						class="hidden"
						onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
					/>
				</label>

				<div class="mt-4 flex gap-4 text-xs text-[#9ca3af]">
					<span class="flex items-center gap-1">
						<i class="fa-solid {conversations.length ? 'fa-circle-check text-green-600' : 'fa-circle'}"
						></i>
						conversations.json {conversations.length ? `(${conversations.length} rows)` : ''}
					</span>
					<span class="flex items-center gap-1">
						<i class="fa-solid {scores.length ? 'fa-circle-check text-green-600' : 'fa-circle'}"></i>
						scores.json {scores.length ? `(${scores.length} rows)` : ''}
					</span>
				</div>

				{#if importError}
					<p class="mt-3 text-xs text-red-600">{importError}</p>
				{/if}
			</div>
		</div>
	{:else}
		<button
			class="fixed top-4 left-4 z-10 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6b7280] shadow-sm hover:bg-[#f9fafb]"
			onclick={reset}
		>
			<i class="fa-solid fa-arrow-left-long mr-1"></i> Import different files
		</button>
		<NutritionLabelPage
			onCatSelect={(catId, modelId) => {
				nutritionCatPanel = { catId, modelId };
				closeScenarioPanel();
			}}
		/>
		<aside class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb]">
			<NutritionCatPanel
				catId={nutritionCatPanel?.catId ?? null}
				modelId={nutritionCatPanel?.modelId ?? appState.filters.model}
				onClose={() => (nutritionCatPanel = null)}
			/>
		</aside>
		{#if scenarioPanelState.open && scenarioPanelState.scenarioMeta && scenarioPanelState.metricId}
			<aside
				class="flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.08)]"
			>
				<div class="sidebar-scroll flex flex-1 flex-col overflow-y-auto">
					<LocalScenarioPanel
						metricId={scenarioPanelState.metricId}
						scenarioMeta={scenarioPanelState.scenarioMeta}
						scenarioDetail={scenarioDetails.get(scenarioPanelState.scenarioMeta.scenario_id) ?? null}
						backLabel="Close"
						onBack={closeScenarioPanel}
					/>
				</div>
			</aside>
		{/if}
	{/if}
</div>

<style>
	/* Single-model view: no leaderboard to pick a model from, no carousel to page through. */
	.single-card :global(.nl-left),
	.single-card :global(.nl-nav),
	.single-card :global(.nl-pdf-btn--corner),
	.single-card :global(.nl-select-checkbox--corner),
	.single-card :global(.nl-strip) {
		display: none !important;
	}
	.single-card :global(.nl-center) {
		justify-content: center;
	}
	.sidebar-scroll {
		scrollbar-width: none;
	}
	.sidebar-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
