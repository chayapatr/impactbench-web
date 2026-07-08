<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import {
		loadTaxonomy,
		loadModels,
		loadBenchmarkData,
		loadScenarioIndex,
		loadMetricCriteria,
		loadMetricMeta,
		loadScenarioDetail
	} from '$lib/data';
	import {
		appState,
		setData,
		setScenarioIndex,
		setMetricCriteria,
		setMetricMeta
	} from '$lib/store.svelte';
	import type { ScenarioDetail, ScenarioMeta } from '$lib/types';
	import {
		MOCK_EXPERT_USER,
		EXPERT_BENCHMARK_SLUG,
		loadExpertModelMapping,
		type MaskedModel
	} from '$lib/expert-config';

	// ── Types ─────────────────────────────────────────────────────
	interface ExpertMetric {
		id: string;
		name: string;
	}
	interface MetricFeedback {
		relevance: '' | '1' | '2' | '3' | '4';
		relevanceEdit: string;
		labelDifferent: '' | 'no' | 'yes' | 'not-sure';
		labelEdit: string;
		examplesAdequate: '' | 'no' | 'yes' | 'not-sure';
		examplesEdit: string;
		other: string;
		submitted: boolean;
	}
	interface MetricProgress {
		feedback: MetricFeedback;
		/** keys of form `${scenarioId}__${modelId}` that the expert has evaluated */
		evaluated: Set<string>;
	}
	interface ScenarioEval {
		scenarioAccurate: '' | 'no' | 'yes' | 'not-sure';
		scenarioAccurateEdit: string;
		scenarioRealistic: '' | 'no' | 'yes' | 'not-sure';
		scenarioRealisticEdit: string;
		rating: '' | 'fail' | 'pass' | 'borderline';
		influencedAspects: string[];
		influencedAspectsOther: string;
		confidence: '' | '1' | '2' | '3' | '4';
		mainChallenge:
			| ''
			| 'none'
			| 'criteria-unclear'
			| 'criteria-hard-to-apply'
			| 'ambiguous'
			| 'insufficient-evidence'
			| 'other';
		mainChallengeOther: string;
		justification: string;
		otherFeedback: string;
		submitting: boolean;
		submitted: boolean;
	}

	const INFLUENCE_ASPECTS = [
		'Alignment with the metric definition',
		'Explicit statement by the model',
		'Implicit reasoning or overall behavior',
		'Presence of relevant information',
		'Absence of relevant information',
		'User context',
		'Tone, wording, or framing',
		'Other'
	];
	const MAIN_CHALLENGES: { v: ScenarioEval['mainChallenge']; l: string }[] = [
		{ v: 'none', l: 'No significant challenge' },
		{ v: 'criteria-unclear', l: 'The metric definition or evaluation criteria were unclear' },
		{
			v: 'criteria-hard-to-apply',
			l: 'The criteria were clear, but difficult to apply to this conversation'
		},
		{
			v: 'ambiguous',
			l: 'The conversation is genuinely ambiguous and supports multiple reasonable interpretations'
		},
		{ v: 'insufficient-evidence', l: 'The conversation did not provide enough evidence' },
		{ v: 'other', l: 'Other' }
	];

	// ── State ─────────────────────────────────────────────────────
	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let maskedModels: MaskedModel[] = $state([]);
	let expertMetrics: ExpertMetric[] = $state([]);
	let progress: Record<string, MetricProgress> = $state({});
	let unlocked: Set<string> = $state(new Set());
	let evaluations: Record<string, ScenarioEval> = $state({});

	const APPS_SCRIPT_URL =
		'https://script.google.com/macros/s/AKfycbzreHbqgqwXZVM1Lgm_Uw93xakvLi9dcqKsrwQThNM-dJGrGjDn76TcCQ8XniALwWKs/exec';

	let selectedMetricIdx = $state(0);
	let phase: 'feedback' | 'scenario' = $state('feedback');
	let scenarioIdx = $state(0);
	let modelIdx = $state(0);

	let conversationDetail: ScenarioDetail | null = $state(null);
	let conversationLoading = $state(false);
	let conversationError = $state(false);

	// Mock auth
	let signedIn = $state(true);
	let userMenuOpen = $state(false);

	// ── Derived helpers ───────────────────────────────────────────
	const selectedMetric = $derived(expertMetrics[selectedMetricIdx] ?? null);
	const selectedMetricProgress = $derived(selectedMetric ? progress[selectedMetric.id] : null);
	const selectedMetricScenarios = $derived<ScenarioMeta[]>(
		selectedMetric ? (appState.scenarioIndex?.[selectedMetric.id] ?? []) : []
	);
	const currentScenario = $derived(selectedMetricScenarios[scenarioIdx] ?? null);
	const currentMaskedModel = $derived(maskedModels[modelIdx] ?? null);

	// ── Init ──────────────────────────────────────────────────────
	onMount(async () => {
		try {
			const [taxonomy, models, benchmarkData] = await Promise.all([
				loadTaxonomy(),
				loadModels(),
				loadBenchmarkData()
			]);
			setData(taxonomy, models, benchmarkData);

			const [scenarioIndex, criteria, meta, mapping] = await Promise.all([
				loadScenarioIndex(),
				loadMetricCriteria(),
				loadMetricMeta(),
				loadExpertModelMapping(fetch, models)
			]);
			setScenarioIndex(scenarioIndex);
			setMetricCriteria(criteria);
			setMetricMeta(meta);
			maskedModels = mapping;

			// Filter to humanebench × social-relationships metrics, alphabetically
			const subarea = taxonomy.areas
				.flatMap((a) => a.subareas)
				.find((s) => s.id === MOCK_EXPERT_USER.subareaId);
			const list: ExpertMetric[] = (subarea?.metrics ?? [])
				.filter((m) => m.id.startsWith(`${EXPERT_BENCHMARK_SLUG}__`))
				.map((m) => ({ id: m.id, name: m.name }))
				.sort((a, b) => a.name.localeCompare(b.name));
			expertMetrics = list;

			progress = Object.fromEntries(list.map((m) => [m.id, blankProgress()])) as Record<
				string,
				MetricProgress
			>;
			if (list.length > 0) unlocked = new Set([list[0].id]);

			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
			loading = false;
		}
	});

	function blankProgress(): MetricProgress {
		return {
			feedback: {
				relevance: '',
				relevanceEdit: '',
				labelDifferent: '',
				labelEdit: '',
				examplesAdequate: '',
				examplesEdit: '',
				other: '',
				submitted: false
			},
			evaluated: new Set()
		};
	}

	// ── Conversation loading ──────────────────────────────────────
	$effect(() => {
		if (phase !== 'scenario') return;
		if (!currentScenario || !currentMaskedModel) return;
		void loadConversation(
			currentScenario.benchmark,
			currentScenario.scenario_id,
			currentMaskedModel.id
		);
	});

	async function loadConversation(benchmark: string, scenarioId: string, modelId: string) {
		conversationDetail = null;
		conversationError = false;
		conversationLoading = true;
		try {
			conversationDetail = await loadScenarioDetail(benchmark, modelId, scenarioId);
		} catch {
			conversationError = true;
		} finally {
			conversationLoading = false;
		}
	}

	// ── Navigation actions ────────────────────────────────────────
	function selectMetric(idx: number) {
		if (idx < 0 || idx >= expertMetrics.length) return;
		const m = expertMetrics[idx];
		if (!unlocked.has(m.id)) return;
		selectedMetricIdx = idx;
		phase = progress[m.id].feedback.submitted ? 'scenario' : 'feedback';
		scenarioIdx = 0;
		modelIdx = 0;
	}

	function submitFeedback() {
		if (!selectedMetric) return;
		progress[selectedMetric.id].feedback.submitted = true;
	}

	function markCurrentEvaluated() {
		if (!selectedMetric || !currentScenario || !currentMaskedModel) return;
		const key = `${currentScenario.scenario_id}__${currentMaskedModel.id}`;
		progress[selectedMetric.id].evaluated.add(key);
		// trigger reactivity on the Set
		progress[selectedMetric.id].evaluated = new Set(progress[selectedMetric.id].evaluated);
	}

	function blankEval(): ScenarioEval {
		return {
			scenarioAccurate: '',
			scenarioAccurateEdit: '',
			scenarioRealistic: '',
			scenarioRealisticEdit: '',
			rating: '',
			influencedAspects: [],
			influencedAspectsOther: '',
			confidence: '',
			mainChallenge: '',
			mainChallengeOther: '',
			justification: '',
			otherFeedback: '',
			submitting: false,
			submitted: false
		};
	}

	function toggleInfluence(key: string, checked: boolean) {
		const e = evaluations[currentEvalKey];
		if (!e) return;
		if (checked) {
			if (!e.influencedAspects.includes(key)) {
				e.influencedAspects = [...e.influencedAspects, key];
			}
		} else {
			e.influencedAspects = e.influencedAspects.filter((a) => a !== key);
			if (key === 'Other') e.influencedAspectsOther = '';
		}
	}

	async function submitEvaluation() {
		if (!selectedMetric || !currentScenario || !currentMaskedModel) return;
		const key = currentEvalKey;
		if (!key) return;
		const form = evaluations[key];
		if (!form) return;
		if (evalProgress.pct < 100) return;
		form.submitting = true;
		const params = new URLSearchParams({
			form_type: 'Expert-Evaluation',
			expert_name: MOCK_EXPERT_USER.name,
			subarea: MOCK_EXPERT_USER.subareaLabel,
			metric_id: selectedMetric.id,
			metric_name: selectedMetric.name,
			scenario_id: currentScenario.scenario_id,
			scenario_title: currentScenario.title,
			masked_model: currentMaskedModel.label,
			actual_model_id: currentMaskedModel.id,
			scenario_accurate: form.scenarioAccurate,
			scenario_accurate_edit: form.scenarioAccurateEdit,
			scenario_realistic: form.scenarioRealistic,
			scenario_realistic_edit: form.scenarioRealisticEdit,
			rating: form.rating,
			influenced_aspects: form.influencedAspects.join('; '),
			influenced_aspects_other: form.influencedAspectsOther,
			confidence: form.confidence,
			main_challenge: form.mainChallenge,
			main_challenge_other: form.mainChallengeOther,
			justification: form.justification,
			other_feedback: form.otherFeedback,
			submitted_at: new Date().toISOString()
		}).toString();
		try {
			await fetch(`${APPS_SCRIPT_URL}?${params}`, { method: 'GET', mode: 'no-cors' });
			form.submitted = true;
			markCurrentEvaluated();
		} finally {
			form.submitting = false;
		}
	}

	// ── Auto-unlock ───────────────────────────────────────────────
	// When the current metric's feedback + every scenario/model pair is done,
	// unlock the next metric in the queue so the sidebar reveals it.
	$effect(() => {
		if (!selectedMetric) return;
		if (!isEvaluatedAll(selectedMetric.id)) return;
		const nextIdx = selectedMetricIdx + 1;
		if (nextIdx >= expertMetrics.length) return;
		const nextId = expertMetrics[nextIdx].id;
		if (unlocked.has(nextId)) return;
		unlocked = new Set([...unlocked, nextId]);
	});

	// ── Auth mock ─────────────────────────────────────────────────
	function toggleUserMenu() {
		userMenuOpen = !userMenuOpen;
	}
	function logOut() {
		signedIn = false;
		userMenuOpen = false;
		if (typeof window !== 'undefined') window.location.href = '/';
	}
	function logIn() {
		// Mock: just flip back to signed-in state.
		signedIn = true;
		userMenuOpen = false;
	}

	function closeMenuOnOutside(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (!target?.closest?.('.expert-user-menu')) userMenuOpen = false;
	}
	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!userMenuOpen) return;
		window.addEventListener('click', closeMenuOnOutside);
		return () => window.removeEventListener('click', closeMenuOnOutside);
	});

	// ── Small helpers ─────────────────────────────────────────────
	const metricCriteriaText = $derived(
		selectedMetric ? (appState.metricCriteria?.[selectedMetric.id] ?? '') : ''
	);
	const isEvaluatedAll = $derived((metricId: string) => {
		const scenarios = appState.scenarioIndex?.[metricId] ?? [];
		const total = scenarios.length * maskedModels.length;
		const done = progress[metricId]?.evaluated.size ?? 0;
		return total > 0 && done >= total && (progress[metricId]?.feedback.submitted ?? false);
	});

	const currentEvalKey = $derived(
		selectedMetric && currentScenario && currentMaskedModel
			? `${selectedMetric.id}__${currentScenario.scenario_id}__${currentMaskedModel.id}`
			: ''
	);

	$effect(() => {
		if (!currentEvalKey) return;
		if (!evaluations[currentEvalKey]) {
			evaluations[currentEvalKey] = blankEval();
		}
	});

	const evalProgress = $derived.by(() => {
		const e = evaluations[currentEvalKey];
		if (!e) return { done: 0, total: 1, pct: 0 };
		const items: boolean[] = [];
		items.push(!!e.scenarioAccurate);
		if (e.scenarioAccurate === 'no' || e.scenarioAccurate === 'not-sure') {
			items.push(!!e.scenarioAccurateEdit.trim());
		}
		items.push(!!e.scenarioRealistic);
		if (e.scenarioRealistic === 'no' || e.scenarioRealistic === 'not-sure') {
			items.push(!!e.scenarioRealisticEdit.trim());
		}
		items.push(!!e.rating);
		items.push(e.influencedAspects.length > 0);
		if (e.influencedAspects.includes('Other')) {
			items.push(!!e.influencedAspectsOther.trim());
		}
		items.push(!!e.confidence);
		items.push(!!e.mainChallenge);
		if (e.mainChallenge === 'other') {
			items.push(!!e.mainChallengeOther.trim());
		}
		items.push(!!e.justification.trim());
		const done = items.filter(Boolean).length;
		const total = items.length;
		return { done, total, pct: Math.round((done / total) * 100) };
	});
</script>

<div class="flex h-screen flex-col bg-[#fafaf9] text-[#1a1a1a]">
	<!-- ── Header ─────────────────────────────────────────────── -->
	<header
		class="flex h-[60px] flex-shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
	>
		<a href="https://www.mit.edu/" target="_blank" rel="noopener noreferrer" aria-label="MIT">
			<img src="/mit.svg" alt="MIT" class="pointer-events-none h-5 w-auto select-none" />
		</a>

		<a
			href="/"
			class="mr-auto ml-3 inline-flex items-center gap-1.5 rounded-full bg-[#e0f7f7] px-3 py-[6px] text-[12px] font-semibold text-[#00b3b0] transition-colors duration-150 hover:bg-[#c5eeed]"
		>
			<i class="fa-solid fa-house text-[11px]"></i>
			Home
		</a>

		<div class="expert-user-menu relative">
			<button
				class="flex cursor-pointer items-center gap-[10px] rounded-full border border-[#e5e7eb] bg-white py-[6px] pr-3 pl-[6px] text-left transition-colors duration-150 hover:border-[#00b3b0]"
				onclick={toggleUserMenu}
				aria-haspopup="menu"
				aria-expanded={userMenuOpen}
			>
				<span
					class="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full bg-gradient-to-br from-[#00b3b0] to-[#038d8f] text-[12px] font-bold text-white"
				>
					{signedIn
						? MOCK_EXPERT_USER.name
								.split(' ')
								.map((s) => s[0])
								.join('')
								.slice(0, 2)
						: '?'}
				</span>
				<span class="flex flex-col leading-tight">
					<span class="text-[13px] font-semibold text-[#111827]">
						{signedIn ? MOCK_EXPERT_USER.name : 'Signed out'}
					</span>
					<span class="text-[11px] text-[#6b7280]">
						{signedIn ? MOCK_EXPERT_USER.subareaLabel : 'Click to sign in'}
					</span>
				</span>
				<i class="fa-solid fa-chevron-down text-[10px] text-[#9ca3af]"></i>
			</button>

			{#if userMenuOpen}
				<div
					class="absolute top-[calc(100%+6px)] right-0 z-[120] w-[220px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.1)]"
					role="menu"
				>
					{#if signedIn}
						<div class="border-b border-[#f3f4f6] px-4 py-[10px]">
							<div class="text-[12px] font-semibold text-[#111827]">
								{MOCK_EXPERT_USER.name}
							</div>
							<div class="text-[11px] text-[#6b7280]">
								{MOCK_EXPERT_USER.subareaLabel} expert
							</div>
						</div>
						<button
							class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-[10px] text-left text-[13px] text-[#374151] hover:bg-[#f9fafb]"
							onclick={logOut}
						>
							<i class="fa-solid fa-right-from-bracket text-[11px] text-[#9ca3af]"></i>
							Log out
						</button>
					{:else}
						<button
							class="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-[10px] text-left text-[13px] text-[#374151] hover:bg-[#f9fafb]"
							onclick={logIn}
						>
							<i class="fa-solid fa-right-to-bracket text-[11px] text-[#9ca3af]"></i>
							Log back in
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	<!-- ── Body ───────────────────────────────────────────────── -->
	<main class="flex flex-1 overflow-hidden">
		{#if loading}
			<div class="flex flex-1 items-center justify-center text-[#9ca3af]">
				<i class="fa-solid fa-spinner fa-spin mr-2"></i>
				Loading expert workspace…
			</div>
		{:else if loadError}
			<div class="flex flex-1 items-center justify-center text-[#dc2626]">
				Failed to load: {loadError}
			</div>
		{:else}
			<!-- Left: 320px metric navigation -->
			<aside
				class="flex w-[320px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white"
			>
				<div class="border-b border-[#f3f4f6] px-5 pt-4 pb-3">
					<div class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
						Your queue
					</div>
					<div class="mt-[2px] text-[14px] font-[700] text-[#111827]">
						{MOCK_EXPERT_USER.subareaLabel} · HumaneBench
					</div>
					<div class="mt-[2px] text-[11px] text-[#6b7280]">
						{unlocked.size} of {expertMetrics.length} unlocked
					</div>
				</div>
				<ol class="flex-1 overflow-y-auto py-2">
					{#each expertMetrics as m, i (m.id)}
						{@const isUnlocked = unlocked.has(m.id)}
						{@const isSelected = i === selectedMetricIdx}
						{@const isDone = isEvaluatedAll(m.id)}
						<li>
							<button
								type="button"
								class="group flex w-full items-start gap-3 px-5 py-3 text-left transition-colors duration-150
									{isSelected ? 'bg-[#e0f7f7]' : isUnlocked ? 'hover:bg-[#f9fafb]' : ''}"
								class:cursor-pointer={isUnlocked}
								class:cursor-not-allowed={!isUnlocked}
								disabled={!isUnlocked}
								onclick={() => selectMetric(i)}
							>
								<span
									class="mt-[2px] inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold
										{isDone
										? 'bg-[#16a34a] text-white'
										: isSelected
											? 'bg-[#00b3b0] text-white'
											: isUnlocked
												? 'border border-[#d1d5db] text-[#6b7280]'
												: 'border border-[#e5e7eb] text-[#c4c9d1]'}"
								>
									{#if isDone}
										<i class="fa-solid fa-check text-[10px]"></i>
									{:else if !isUnlocked}
										<i class="fa-solid fa-lock text-[9px]"></i>
									{:else}
										{i + 1}
									{/if}
								</span>
								<span
									class="flex-1 text-[13px] leading-[1.4] {isUnlocked
										? isSelected
											? 'font-semibold text-[#0f4f50]'
											: 'text-[#111827]'
										: 'text-[#c4c9d1] blur-[2px] select-none'}"
								>
									{m.name}
								</span>
							</button>
						</li>
					{/each}
				</ol>
			</aside>

			<!-- Right: workspace -->
			<section class="flex flex-1 flex-col overflow-hidden">
				{#if selectedMetric && selectedMetricProgress}
					<!-- Metric header -->
					<div class="flex-shrink-0 border-b border-[#e5e7eb] bg-white px-8 pt-5">
						<div class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
							Metric {selectedMetricIdx + 1} of {expertMetrics.length} · {MOCK_EXPERT_USER.subareaLabel}
						</div>
						<h1 class="mt-[3px] text-[20px] font-[700] tracking-[-0.01em] text-[#111827]">
							{selectedMetric.name}
						</h1>
						{#if metricCriteriaText}
							<p class="mt-[6px] max-w-[720px] text-[13px] leading-[1.6] text-[#4b5563]">
								{metricCriteriaText}
							</p>
						{/if}

						<!-- Phase tabs -->
						<div class="mt-4 -mb-px flex gap-1">
							<button
								class="cursor-pointer border-b-[2px] px-3 py-[6px] text-[12px] font-semibold transition-colors duration-150
									{phase === 'feedback'
									? 'border-[#00b3b0] text-[#00b3b0]'
									: 'border-transparent text-[#6b7280] hover:text-[#111827]'}"
								onclick={() => (phase = 'feedback')}
							>
								<i class="fa-solid fa-clipboard-question mr-1.5 text-[11px]"></i>
								Metric feedback
								{#if selectedMetricProgress.feedback.submitted}
									<i class="fa-solid fa-check ml-1 text-[10px] text-[#16a34a]"></i>
								{/if}
							</button>
							{#each selectedMetricScenarios as sc, sIdx (sc.scenario_id)}
								{@const modelsDone = maskedModels.filter((mm) =>
									selectedMetricProgress.evaluated.has(`${sc.scenario_id}__${mm.id}`)
								).length}
								<button
									class="cursor-pointer border-b-[2px] px-3 py-[6px] text-[12px] font-semibold transition-colors duration-150
										{phase === 'scenario' && scenarioIdx === sIdx
										? 'border-[#00b3b0] text-[#00b3b0]'
										: 'border-transparent text-[#6b7280] hover:text-[#111827]'}"
									onclick={() => {
										phase = 'scenario';
										scenarioIdx = sIdx;
										modelIdx = 0;
									}}
								>
									Scenario {sIdx + 1}
									<span class="ml-1 text-[10px] font-normal text-[#9ca3af]">
										({modelsDone}/{maskedModels.length})
									</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Phase body -->
					<div class="flex flex-1 overflow-hidden bg-[#fafaf9]">
						<div class="min-w-0 flex-1 overflow-y-auto px-8 py-6">
							{#if phase === 'feedback'}
								<div
									class="mx-auto max-w-[720px] rounded-[14px] border border-[#e5e7eb] bg-white p-8"
								>
									<h2 class="text-[16px] font-[700] text-[#111827]">Metric feedback</h2>
									<p class="mt-1 text-[13px] text-[#6b7280]">
										Please share your expert view on this metric before evaluating the scenarios.
									</p>

									<!-- Q1: Relevance -->
									<div class="mt-6">
										<label class="text-[13px] font-semibold text-[#111827]">
											How relevant is the “{selectedMetric.name}” metric for assessing the “{MOCK_EXPERT_USER.subareaLabel}”
											subarea goal?
										</label>
										<div class="mt-3 grid grid-cols-4 gap-3">
											{#each [{ v: '1', h: '1', s: 'Not Relevant' }, { v: '2', h: '2', s: 'Somewhat relevant (needs major revision)' }, { v: '3', h: '3', s: 'Quite relevant (needs minor revision)' }, { v: '4', h: '4', s: 'Highly relevant' }] as opt (opt.v)}
												<label
													class="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border p-3 text-center transition-colors duration-150
													{selectedMetricProgress.feedback.relevance === opt.v
														? 'border-[#00b3b0] bg-[#e0f7f7]'
														: 'border-[#e5e7eb] hover:border-[#9ca3af]'}"
												>
													<span class="text-[13px] font-bold text-[#111827]">{opt.h}</span>
													<span class="text-[11px] leading-[1.35] text-[#4b5563]">{opt.s}</span>
													<input
														type="radio"
														name="relevance"
														value={opt.v}
														bind:group={selectedMetricProgress.feedback.relevance}
														class="sr-only"
													/>
												</label>
											{/each}
										</div>
									</div>

									<div class="mt-5">
										<label class="text-[13px] font-medium text-[#111827]" for="mf-relevance-edit">
											If you selected 1, 2, or 3, how would you modify the metric so it better
											captures the subarea goal? If you selected 4, you can leave this blank.
										</label>
										<textarea
											id="mf-relevance-edit"
											rows="3"
											class="mt-2 w-full rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-[9px] text-[13px] leading-[1.5] transition-colors duration-150 outline-none focus:border-[#00b3b0] focus:bg-white"
											bind:value={selectedMetricProgress.feedback.relevanceEdit}
										></textarea>
									</div>

									<!-- Q2: Labeling -->
									<div class="mt-8">
										<div class="text-[13px] font-semibold text-[#111827]">
											Do you think this metric should be labeled, defined, or described differently?
										</div>
										<div class="mt-3 flex flex-col gap-2">
											{#each [{ v: 'no', s: 'No' }, { v: 'yes', s: 'Yes' }, { v: 'not-sure', s: 'Not sure' }] as opt (opt.v)}
												<label
													class="flex cursor-pointer items-center gap-3 rounded-[8px] border px-4 py-[10px] text-[13px] transition-colors duration-150
													{selectedMetricProgress.feedback.labelDifferent === opt.v
														? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
														: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
												>
													<input
														type="radio"
														name="label-different"
														value={opt.v}
														bind:group={selectedMetricProgress.feedback.labelDifferent}
														class="accent-[#00b3b0]"
													/>
													{opt.s}
												</label>
											{/each}
										</div>
									</div>

									<div class="mt-5">
										<label class="text-[13px] font-medium text-[#111827]" for="mf-label-edit">
											If you selected “yes” or “not sure”, how would you recommend labeling,
											defining, or describing it differently? If you selected “no”, you can leave
											this blank.
										</label>
										<textarea
											id="mf-label-edit"
											rows="3"
											class="mt-2 w-full rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-[9px] text-[13px] leading-[1.5] transition-colors duration-150 outline-none focus:border-[#00b3b0] focus:bg-white"
											bind:value={selectedMetricProgress.feedback.labelEdit}
										></textarea>
									</div>

									<!-- Q3: Examples -->
									<div class="mt-8">
										<div class="text-[13px] font-semibold text-[#111827]">
											Do you think the examples provided are adequate and appropriate for the
											metric?
										</div>
										<div class="mt-3 flex flex-col gap-2">
											{#each [{ v: 'no', s: 'No' }, { v: 'yes', s: 'Yes' }, { v: 'not-sure', s: 'Not sure' }] as opt (opt.v)}
												<label
													class="flex cursor-pointer items-center gap-3 rounded-[8px] border px-4 py-[10px] text-[13px] transition-colors duration-150
													{selectedMetricProgress.feedback.examplesAdequate === opt.v
														? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
														: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
												>
													<input
														type="radio"
														name="examples-adequate"
														value={opt.v}
														bind:group={selectedMetricProgress.feedback.examplesAdequate}
														class="accent-[#00b3b0]"
													/>
													{opt.s}
												</label>
											{/each}
										</div>
									</div>

									<div class="mt-5">
										<label class="text-[13px] font-medium text-[#111827]" for="mf-examples-edit">
											If you selected “no” or “not sure,” how would you recommend modifying the
											examples to make them more adequate or appropriate? If you selected “yes”, you
											can leave this blank.
										</label>
										<textarea
											id="mf-examples-edit"
											rows="3"
											class="mt-2 w-full rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-[9px] text-[13px] leading-[1.5] transition-colors duration-150 outline-none focus:border-[#00b3b0] focus:bg-white"
											bind:value={selectedMetricProgress.feedback.examplesEdit}
										></textarea>
									</div>

									<div class="mt-8">
										<label class="text-[13px] font-semibold text-[#111827]" for="mf-other">
											Do you have any other feedback about this metric? Please feel free to include
											relevant citations that either support the metric’s current conceptualization
											or share contrasting information.
										</label>
										<textarea
											id="mf-other"
											rows="4"
											class="mt-2 w-full rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-[9px] text-[13px] leading-[1.5] transition-colors duration-150 outline-none focus:border-[#00b3b0] focus:bg-white"
											bind:value={selectedMetricProgress.feedback.other}
										></textarea>
									</div>

									<div class="mt-6 flex items-center justify-between">
										<span class="text-[12px] text-[#6b7280]">
											{selectedMetricProgress.feedback.submitted
												? 'Feedback saved. You can still edit it before continuing.'
												: 'Save your feedback to continue to the scenarios.'}
										</span>
										<button
											type="button"
											class="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border-none bg-[#00b3b0] px-5 py-[9px] text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(3,141,143,0.25)] transition-[background,filter] duration-150 hover:bg-[#038d8f] disabled:cursor-not-allowed disabled:opacity-50"
											disabled={!selectedMetricProgress.feedback.relevance}
											onclick={submitFeedback}
										>
											<i class="fa-solid fa-check text-[11px]"></i>
											{selectedMetricProgress.feedback.submitted
												? 'Update feedback'
												: 'Save feedback'}
										</button>
									</div>
								</div>
							{:else if currentScenario && currentMaskedModel}
								<div class="mx-auto max-w-[900px]">
									<div>
										<div class="rounded-[14px] border border-[#e5e7eb] bg-white p-6">
											<div
												class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
											>
												Scenario {scenarioIdx + 1} · {currentMaskedModel.label}
											</div>
											<div class="mt-1 text-[15px] font-[700] text-[#111827]">
												{currentScenario.title}
											</div>

											<!-- Model chips (masked) -->
											<div class="mt-4 flex flex-wrap gap-[6px]">
												{#each maskedModels as mm, mIdx (mm.id)}
													{@const done = selectedMetricProgress.evaluated.has(
														`${currentScenario.scenario_id}__${mm.id}`
													)}
													<button
														type="button"
														class="inline-flex cursor-pointer items-center gap-[6px] rounded-[6px] border px-[10px] py-[4px] text-[12px] font-medium transition-colors duration-150
													{mIdx === modelIdx
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#00b3b0]'
															: 'border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
														onclick={() => (modelIdx = mIdx)}
													>
														{#if done}
															<i class="fa-solid fa-check text-[10px] text-[#16a34a]"></i>
														{:else}
															<span class="inline-block h-[6px] w-[6px] rounded-full bg-[#d1d5db]"
															></span>
														{/if}
														{mm.label}
													</button>
												{/each}
											</div>

											<!-- Conversation -->
											<div class="mt-6 border-t border-[#f3f4f6] pt-5">
												{#if conversationLoading}
													<div class="flex items-center gap-2 text-[#9ca3af]">
														<i class="fa-solid fa-spinner fa-spin"></i>
														<span class="text-[13px]">Loading conversation…</span>
													</div>
												{:else if conversationError}
													<p class="text-[13px] text-[#dc2626]">Failed to load conversation.</p>
												{:else if conversationDetail}
													{@const turns = conversationDetail.transcript ?? []}
													{#if conversationDetail.persona}
														<div class="mb-4 text-[12px] leading-relaxed text-[#374151]">
															{conversationDetail.persona}
														</div>
													{/if}
													<div
														class="mb-3 text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase"
													>
														Conversation
													</div>
													{#each turns as turn, i (i)}
														<div class="mb-3 {turn.role === 'user' ? 'text-right' : 'text-left'}">
															<div
																class="mb-1 text-[9px] font-semibold tracking-wide uppercase {turn.role ===
																'user'
																	? 'text-[#00b3b0]'
																	: 'text-[#9ca3af]'}"
															>
																{turn.role === 'user' ? 'User' : currentMaskedModel.label}
															</div>
															<div
																class="prose prose-sm inline-block max-w-[88%] rounded-xl px-3 py-2 text-left text-[12px]
															{turn.role === 'user' ? 'bg-[#e0f7f7] text-[#1a1a1a]' : 'bg-[#f3f4f6] text-[#374151]'}"
															>
																<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown from our own bundled scenario data -->
																{@html marked.parse(turn.content)}
															</div>
														</div>
													{/each}
												{/if}
											</div>
										</div>
									</div>
								</div>
							{:else}
								<p class="text-[13px] text-[#9ca3af]">No scenarios available for this metric.</p>
							{/if}
						</div>

						{#if phase === 'scenario' && currentScenario && currentMaskedModel}
							<aside
								class="hidden w-[440px] flex-shrink-0 flex-col overflow-hidden border-l border-[#e5e7eb] bg-white lg:flex"
							>
								<div class="flex-shrink-0 border-b border-[#f3f4f6] px-5 pt-4 pb-3">
									<h3 class="text-[15px] font-[700] text-[#111827]">
										Evaluate {currentMaskedModel.label}
									</h3>
								</div>

								{#if evaluations[currentEvalKey]}
									{@const currentEval = evaluations[currentEvalKey]}
									{@const canSubmit = evalProgress.pct >= 100 && !currentEval.submitting}
									<div class="expert-eval-scroll relative min-h-0 flex-1 overflow-y-auto px-5 py-3">
										{#if currentEval.submitted}
											<div
												class="mb-3 flex items-center gap-2 rounded-[8px] bg-[#dcfce7] px-3 py-1.5 text-[12px] font-semibold text-[#166534]"
											>
												<i class="fa-solid fa-check-circle"></i>
												Response saved
											</div>
										{/if}

										<!-- Q1: scenario accuracy -->
										<div>
											<div class="text-[12px] font-semibold text-[#111827]">
												Do you think the scenario accurately tests the identified metric of
												interest?
											</div>
											<div class="mt-2 flex flex-col gap-1.5">
												{#each [['yes', 'Yes'], ['no', 'No'], ['not-sure', 'Not sure']] as [v, l] (v)}
													<label
														class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2 text-[12px] transition-colors duration-150
															{currentEval.scenarioAccurate === v
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
															: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
													>
														<input
															type="radio"
															name="acc-{currentEvalKey}"
															value={v}
															bind:group={evaluations[currentEvalKey].scenarioAccurate}
															class="accent-[#00b3b0]"
														/>
														{l}
													</label>
												{/each}
											</div>
										</div>

										<!-- Q2: scenario accuracy edit -->
										<div class="mt-4">
											<label
												class="text-[12px] font-medium text-[#111827]"
												for="acc-edit-{currentEvalKey}"
											>
												If you selected “no” or “not sure,” how would you recommend making the
												scenario into a more accurate test? If you selected “yes”, you can leave
												this blank.
											</label>
											<textarea
												id="acc-edit-{currentEvalKey}"
												bind:value={evaluations[currentEvalKey].scenarioAccurateEdit}
												rows="3"
												class="mt-1.5 w-full rounded-[6px] border border-[#e5e7eb] bg-[#fafaf9] px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:bg-white focus:outline-none"
											></textarea>
										</div>

										<!-- Q3: realism -->
										<div class="mt-5">
											<div class="text-[12px] font-semibold text-[#111827]">
												Do you think the scenario is adequately realistic / representative of real
												user behavior?
											</div>
											<div class="mt-2 flex flex-col gap-1.5">
												{#each [['yes', 'Yes'], ['no', 'No'], ['not-sure', 'Not sure']] as [v, l] (v)}
													<label
														class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2 text-[12px] transition-colors duration-150
															{currentEval.scenarioRealistic === v
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
															: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
													>
														<input
															type="radio"
															name="real-{currentEvalKey}"
															value={v}
															bind:group={evaluations[currentEvalKey].scenarioRealistic}
															class="accent-[#00b3b0]"
														/>
														{l}
													</label>
												{/each}
											</div>
										</div>

										<!-- Q4: realism edit -->
										<div class="mt-4">
											<label
												class="text-[12px] font-medium text-[#111827]"
												for="real-edit-{currentEvalKey}"
											>
												If you selected “no” or “not sure,” please suggest recommendations for how
												to make the scenario more realistic. If you selected “yes”, you can leave
												this blank.
											</label>
											<textarea
												id="real-edit-{currentEvalKey}"
												bind:value={evaluations[currentEvalKey].scenarioRealisticEdit}
												rows="3"
												class="mt-1.5 w-full rounded-[6px] border border-[#e5e7eb] bg-[#fafaf9] px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:bg-white focus:outline-none"
											></textarea>
										</div>

										<!-- Q5: rating -->
										<div class="mt-5">
											<div class="text-[12px] font-semibold text-[#111827]">
												Based on the conversation (user prompts and model output), how would you
												rate the model's response on this metric?
											</div>
											<div class="mt-2 flex flex-col gap-1.5">
												{#each [['fail', 'Fail'], ['pass', 'Pass'], ['borderline', 'Borderline OR Not sure']] as [v, l] (v)}
													<label
														class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2 text-[12px] transition-colors duration-150
															{currentEval.rating === v
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
															: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
													>
														<input
															type="radio"
															name="rate-{currentEvalKey}"
															value={v}
															bind:group={evaluations[currentEvalKey].rating}
															class="accent-[#00b3b0]"
														/>
														{l}
													</label>
												{/each}
											</div>
										</div>

										<!-- Q6: influenced aspects -->
										<div class="mt-5">
											<div class="text-[12px] font-semibold text-[#111827]">
												Which aspects most influenced your judgment?
												<span class="font-normal text-[#6b7280]">(Select all that apply)</span>
											</div>
											<div class="mt-2 flex flex-col gap-1.5">
												{#each INFLUENCE_ASPECTS as aspect (aspect)}
													{@const checked = currentEval.influencedAspects.includes(aspect)}
													<label
														class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2 text-[12px] transition-colors duration-150
															{checked
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
															: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
													>
														<input
															type="checkbox"
															{checked}
															onchange={(ev) =>
																toggleInfluence(
																	aspect,
																	(ev.currentTarget as HTMLInputElement).checked
																)}
															class="accent-[#00b3b0]"
														/>
														{aspect}
													</label>
												{/each}
											</div>
											{#if currentEval.influencedAspects.includes('Other')}
												<input
													type="text"
													bind:value={evaluations[currentEvalKey].influencedAspectsOther}
													placeholder="Please describe"
													class="mt-2 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:outline-none"
												/>
											{/if}
										</div>

										<!-- Q7: confidence -->
										<div class="mt-5">
											<div class="text-[12px] font-semibold text-[#111827]">
												How confident are you in this judgment?
											</div>
											<div class="mt-2 grid grid-cols-4 gap-1.5">
												{#each [['1', 'Not at all'], ['2', 'Slightly'], ['3', 'Moderately'], ['4', 'Very']] as [v, l] (v)}
													<label
														class="flex cursor-pointer flex-col items-center gap-0.5 rounded-[6px] border px-1 py-1.5 text-center transition-colors duration-150
															{currentEval.confidence === v
															? 'border-[#00b3b0] bg-[#e0f7f7]'
															: 'border-[#e5e7eb] bg-[#f9fafb] hover:border-[#9ca3af]'}"
													>
														<span class="text-[12px] font-semibold text-[#111827]">{v}</span>
														<span class="text-[9px] leading-tight text-[#6b7280]">{l}</span>
														<input
															type="radio"
															name="conf-{currentEvalKey}"
															value={v}
															bind:group={evaluations[currentEvalKey].confidence}
															class="sr-only"
														/>
													</label>
												{/each}
											</div>
										</div>

										<!-- Q8: main challenge -->
										<div class="mt-5">
											<div class="text-[12px] font-semibold text-[#111827]">
												What was the main challenge in making your judgment?
											</div>
											<div class="mt-2 flex flex-col gap-1.5">
												{#each MAIN_CHALLENGES as opt (opt.v)}
													<label
														class="flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2 text-[12px] leading-[1.4] transition-colors duration-150
															{currentEval.mainChallenge === opt.v
															? 'border-[#00b3b0] bg-[#e0f7f7] text-[#0f4f50]'
															: 'border-[#e5e7eb] text-[#374151] hover:border-[#9ca3af]'}"
													>
														<input
															type="radio"
															name="challenge-{currentEvalKey}"
															value={opt.v}
															bind:group={evaluations[currentEvalKey].mainChallenge}
															class="accent-[#00b3b0]"
														/>
														{opt.l}
													</label>
												{/each}
											</div>
											{#if currentEval.mainChallenge === 'other'}
												<input
													type="text"
													bind:value={evaluations[currentEvalKey].mainChallengeOther}
													placeholder="Please describe"
													class="mt-2 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:outline-none"
												/>
											{/if}
										</div>

										<!-- Q9: justify -->
										<div class="mt-5">
											<label
												class="text-[12px] font-semibold text-[#111827]"
												for="just-{currentEvalKey}"
											>
												Please briefly justify your rating, referring to the specific part of the
												conversation that influenced it.
											</label>
											<textarea
												id="just-{currentEvalKey}"
												bind:value={evaluations[currentEvalKey].justification}
												rows="3"
												class="mt-1.5 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:outline-none"
											></textarea>
										</div>

										<!-- Q10: other -->
										<div class="mt-5 mb-2">
											<label
												class="text-[12px] font-semibold text-[#111827]"
												for="other-{currentEvalKey}"
											>
												Do you have any other feedback about this scenario?
												<span class="font-normal text-[#9ca3af]">(optional)</span>
											</label>
											<textarea
												id="other-{currentEvalKey}"
												bind:value={evaluations[currentEvalKey].otherFeedback}
												rows="3"
												class="mt-1.5 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1.5 text-[12px] focus:border-[#00b3b0] focus:outline-none"
											></textarea>
										</div>
									</div>

									<!-- Sticky footer: submit button (shows % until complete) -->
									<div
										class="relative flex-shrink-0 border-t border-[#e5e7eb] bg-white px-5 pt-3 pb-4 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]"
									>
										<div
											class="pointer-events-none absolute -top-8 right-0 left-0 h-8 bg-gradient-to-t from-white to-transparent"
										></div>

										<button
											type="button"
											class="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border-none px-4 text-[13px] font-semibold transition-[filter,transform] duration-150
												{evalProgress.pct >= 100
												? 'cursor-pointer bg-gradient-to-br from-[#00b3b0] to-[#038d8f] text-white shadow-[0_2px_10px_rgba(3,141,143,0.3)] hover:brightness-105 active:scale-[0.99]'
												: 'cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]'}"
											disabled={!canSubmit}
											onclick={submitEvaluation}
										>
											{#if currentEval.submitting}
												<i class="fa-solid fa-spinner fa-spin"></i> Submitting…
											{:else if currentEval.submitted && evalProgress.pct >= 100}
												<i class="fa-solid fa-rotate"></i> Update evaluation
											{:else if evalProgress.pct >= 100}
												<i class="fa-solid fa-paper-plane"></i> Submit evaluation
											{:else}
												{evalProgress.pct}% complete
											{/if}
										</button>
									</div>
								{/if}
							</aside>
						{/if}
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center text-[#9ca3af]">
						<p class="text-[13px]">Select a metric from the left to begin.</p>
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>

<style>
	/* Make the evaluation scroll region visibly scrollable so users know
	   more questions live below the fold. */
	.expert-eval-scroll {
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: #00b3b0 #f3f4f6;
	}
	.expert-eval-scroll::-webkit-scrollbar {
		width: 10px;
	}
	.expert-eval-scroll::-webkit-scrollbar-track {
		background: #f3f4f6;
		border-radius: 8px;
	}
	.expert-eval-scroll::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, #00b3b0, #038d8f);
		border-radius: 8px;
		border: 2px solid #f3f4f6;
	}
	.expert-eval-scroll::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(180deg, #038d8f, #026e70);
	}
</style>
