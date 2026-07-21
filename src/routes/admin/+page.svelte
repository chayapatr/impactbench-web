<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		adminState,
		setAdminKey,
		clearAdminKey,
		armAdminPreviewHandoff,
		ADMIN_PREVIEW_PATH_ID
	} from '$lib/store/admin.svelte';
	import { appState } from '$lib/store.svelte';
	import { EXPERT_MODEL_POOL, EXPERT_SLUG_METRICS } from '$lib/expert-config';
	import { loadScenarioDetail } from '$lib/data';
	import AdminEvaluationFormPreview from '$lib/components/admin/AdminEvaluationFormPreview.svelte';
	import {
		adminOverview,
		adminMetricsSummary,
		adminMetricEvaluations,
		adminMetricFeedback,
		AdminAuthError
	} from '$lib/admin/db';
	import type {
		AdminEvaluationDetail,
		AdminMetricFeedback,
		AdminMetricSummary,
		AdminOverview
	} from '$lib/admin/types';
	import type { ScenarioDetail } from '$lib/types';

	type Phase = 'need-key' | 'validating' | 'ready' | 'invalid' | 'error';

	let phase = $state<Phase>('need-key');
	let errorMessage = $state('');
	let keyInput = $state('');

	let overview = $state<AdminOverview | null>(null);
	let metrics = $state<AdminMetricSummary[]>([]);

	let selectedMetricId = $state<string | null>(null);
	let evaluations = $state<AdminEvaluationDetail[]>([]);
	let metricFeedback = $state<AdminMetricFeedback[]>([]);
	let detailLoading = $state(false);
	let detailError = $state('');
	let feedbackError = $state('');
	let expandedEval = $state<string | null>(null);
	let expandedFeedback = $state<string | null>(null);
	let search = $state('');
	let showFormPreview = $state(false);
	let previewScenarioId = $state('');
	let previewModelId = $state('');
	let previewConversation = $state<ScenarioDetail | null>(null);
	let previewConversationLoading = $state(false);
	let previewConversationError = $state('');

	// The four metrics currently under expert review (slug routes).
	const REVIEW_METRICS = Object.values(EXPERT_SLUG_METRICS);

	const dashboardMetrics = $derived.by<AdminMetricSummary[]>(() => {
		return REVIEW_METRICS.map((metric) => {
			const existing = metrics.find((m) => m.metric_id === metric.metricId);
			return (
				existing ?? {
					metric_id: metric.metricId,
					metric_name: metric.metricName,
					evaluation_count: 0,
					expert_count: 0,
					scenario_count: 0,
					last_submitted_at: null,
					rating_breakdown: null
				}
			);
		});
	});

	// Overview eval/metric/scenario cards must match the list above — the RPC
	// counts the whole DB, which can include metric_ids outside the review set.
	const scopedOverview = $derived({
		experts_total: overview?.experts_total ?? 0,
		experts_completed: overview?.experts_completed ?? 0,
		experts_in_progress: overview?.experts_in_progress ?? 0,
		evaluations_total: dashboardMetrics.reduce((sum, m) => sum + Number(m.evaluation_count), 0),
		metrics_covered: dashboardMetrics.filter((m) => Number(m.evaluation_count) > 0).length,
		scenarios_covered: dashboardMetrics.reduce((sum, m) => sum + Number(m.scenario_count), 0),
		last_submission_at:
			dashboardMetrics
				.map((m) => m.last_submitted_at)
				.filter((v): v is string => !!v)
				.sort()
				.at(-1) ?? null
	});

	const filteredMetrics = $derived(
		search.trim()
			? dashboardMetrics.filter((m) => {
					const q = search.trim().toLowerCase();
					return (
						(m.metric_name ?? '').toLowerCase().includes(q) || m.metric_id.toLowerCase().includes(q)
					);
				})
			: dashboardMetrics
	);

	const previewScenarios = $derived(
		selectedMetricId
			? (appState.scenarioIndex?.[selectedMetricId] ?? []).filter(
					(scenario) => scenario.age === 'adult'
				)
			: []
	);

	const evaluationGroups = $derived.by(() => {
		const groups: {
			scenarioId: string;
			scenarioTitle: string;
			evaluations: AdminEvaluationDetail[];
		}[] = previewScenarios.map((scenario) => ({
			scenarioId: scenario.scenario_id,
			scenarioTitle: scenario.title,
			evaluations: []
		}));
		for (const evaluation of evaluations) {
			let group = groups.find((item) => item.scenarioId === evaluation.scenario_id);
			if (!group) {
				group = {
					scenarioId: evaluation.scenario_id,
					scenarioTitle: evaluation.scenario_title || evaluation.scenario_id,
					evaluations: []
				};
				groups.push(group);
			}
			group.evaluations.push(evaluation);
		}
		return groups.sort((a, b) => a.scenarioTitle.localeCompare(b.scenarioTitle));
	});

	function modelName(modelId: string): string {
		return appState.models.find((model) => model.id === modelId)?.name ?? modelId;
	}

	async function loadPreviewConversation(scenarioId: string, modelId: string) {
		const scenario = previewScenarios.find((item) => item.scenario_id === scenarioId);
		if (!scenario || !modelId) {
			previewConversation = null;
			return;
		}
		previewConversation = null;
		previewConversationLoading = true;
		previewConversationError = '';
		try {
			const detail = await loadScenarioDetail(scenario.benchmark, modelId, scenarioId);
			if (previewScenarioId === scenarioId && previewModelId === modelId) {
				previewConversation = detail;
			}
		} catch (e) {
			previewConversationError = e instanceof Error ? e.message : String(e);
		} finally {
			previewConversationLoading = false;
		}
	}

	function toggleFormPreview() {
		showFormPreview = !showFormPreview;
		if (!showFormPreview) return;

		const scenarioId =
			previewScenarios.find((scenario) => scenario.scenario_id === previewScenarioId)
				?.scenario_id ??
			previewScenarios[0]?.scenario_id ??
			'';
		const modelId = EXPERT_MODEL_POOL.includes(previewModelId)
			? previewModelId
			: (EXPERT_MODEL_POOL[0] ?? '');
		previewScenarioId = scenarioId;
		previewModelId = modelId;
		void loadPreviewConversation(scenarioId, modelId);
	}

	async function validateAndLoad(key: string) {
		phase = 'validating';
		errorMessage = '';
		try {
			overview = await adminOverview(key);
			metrics = await adminMetricsSummary(key);
			phase = 'ready';
		} catch (e) {
			if (e instanceof AdminAuthError) {
				phase = 'invalid';
			} else {
				phase = 'error';
				errorMessage = e instanceof Error ? e.message : String(e);
			}
		}
	}

	function submitKey() {
		const k = keyInput.trim();
		if (!k) return;
		setAdminKey(k);
		keyInput = '';
		validateAndLoad(k);
	}

	function logout() {
		clearAdminKey();
		overview = null;
		metrics = [];
		selectedMetricId = null;
		evaluations = [];
		metricFeedback = [];
		phase = 'need-key';
	}

	async function openMetric(metricId: string) {
		if (!adminState.key) return;
		selectedMetricId = metricId;
		expandedEval = null;
		expandedFeedback = null;
		showFormPreview = false;
		previewScenarioId = '';
		previewModelId = '';
		previewConversation = null;
		detailLoading = true;
		detailError = '';
		feedbackError = '';
		evaluations = [];
		metricFeedback = [];
		try {
			const key = adminState.key;
			const [evalsResult, feedbackResult] = await Promise.allSettled([
				adminMetricEvaluations(key, metricId),
				adminMetricFeedback(key, metricId)
			]);

			if (evalsResult.status === 'fulfilled') {
				evaluations = evalsResult.value;
			} else {
				const e = evalsResult.reason;
				if (e instanceof AdminAuthError) {
					phase = 'invalid';
					return;
				}
				detailError = e instanceof Error ? e.message : String(e);
			}

			if (feedbackResult.status === 'fulfilled') {
				metricFeedback = feedbackResult.value;
			} else {
				const e = feedbackResult.reason;
				if (e instanceof AdminAuthError) {
					phase = 'invalid';
					return;
				}
				feedbackError = e instanceof Error ? e.message : String(e);
			}
		} finally {
			detailLoading = false;
		}
	}

	function fmtDate(iso: string | null): string {
		if (!iso) return '—';
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
	}

	function evalKey(e: AdminEvaluationDetail): string {
		return `${e.expert_id}:${e.scenario_id}:${e.model_id}`;
	}

	const selectedMetric = $derived(
		selectedMetricId ? dashboardMetrics.find((m) => m.metric_id === selectedMetricId) : null
	);

	const selectedExpertSlug = $derived(
		selectedMetricId
			? (Object.entries(EXPERT_SLUG_METRICS).find(
					([, cfg]) => cfg.metricId === selectedMetricId
				)?.[0] ?? null)
			: null
	);

	function openTestForm() {
		if (!adminState.key || !selectedExpertSlug) return;
		armAdminPreviewHandoff();
		goto(`/experts/${selectedExpertSlug}/${ADMIN_PREVIEW_PATH_ID}`);
	}

	onMount(() => {
		if (!browser) return;
		// Capability key can arrive via ?key=<uuid>. Pull it into memory, then
		// strip it from the visible URL so it doesn't linger in the address bar
		// or browser history. It is never written to storage.
		const url = new URL(window.location.href);
		const urlKey = url.searchParams.get('key');
		if (urlKey) {
			url.searchParams.delete('key');
			history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
			setAdminKey(urlKey);
		}
		if (adminState.key) {
			validateAndLoad(adminState.key);
		}
	});
</script>

<svelte:head>
	<title>Admin · ImpactBench</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="flex h-screen flex-col overflow-hidden bg-[#fafaf9] font-[Inter,system-ui,sans-serif]">
	<!-- Header -->
	<header
		class="flex flex-shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-6 py-3"
	>
		<div class="flex items-center gap-2.5">
			<i class="fa-solid fa-shield-halved text-[#00b3b0]"></i>
			<span class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
				ImpactBench Admin
			</span>
			<span class="rounded-full bg-[#e0f7f7] px-2 py-[2px] text-[10px] font-bold text-[#038d8f]">
				Evaluations
			</span>
		</div>
		{#if phase === 'ready'}
			<button
				class="flex items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-[6px] text-[12px] font-semibold text-[#6b7280] transition-colors hover:border-[#dc2626] hover:text-[#dc2626]"
				onclick={logout}
			>
				<i class="fa-solid fa-arrow-right-from-bracket text-[11px]"></i> Lock
			</button>
		{/if}
	</header>

	{#if phase !== 'ready'}
		<!-- Key entry / status gate -->
		<div class="flex flex-1 items-center justify-center px-6">
			<div
				class="w-full max-w-[420px] rounded-[16px] border border-[#e5e7eb] bg-white p-8 shadow-[0_10px_32px_rgba(15,23,42,0.07)]"
			>
				<div class="mb-1 flex items-center gap-2 text-[#111827]">
					<i class="fa-solid fa-key text-[#00b3b0]"></i>
					<h1 class="text-[18px] font-[800] tracking-[-0.01em]">Admin key required</h1>
				</div>
				<p class="mb-5 text-[13px] leading-[1.6] text-[#6b7280]">
					Paste your admin capability key to view the evaluation dashboard. The key is held in
					memory only — it is never saved, so you'll re-enter it after a reload.
				</p>

				{#if phase === 'invalid'}
					<div
						class="mb-4 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-medium text-[#b91c1c]"
					>
						That key is invalid or has been revoked.
					</div>
				{:else if phase === 'error'}
					<div
						class="mb-4 rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[12px] font-medium text-[#c2410c]"
					>
						Couldn't reach the server: {errorMessage}
					</div>
				{/if}

				<div class="flex gap-2">
					<input
						type="password"
						placeholder="Admin key (UUID)…"
						bind:value={keyInput}
						disabled={phase === 'validating'}
						onkeydown={(e) => {
							if (e.key === 'Enter') submitKey();
						}}
						class="flex-1 rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-3 py-[10px] text-[14px] text-[#111827] transition-colors outline-none focus:border-[#00b3b0]"
					/>
					<button
						class="rounded-[10px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[10px] text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter] hover:brightness-105 disabled:opacity-60"
						disabled={phase === 'validating' || !keyInput.trim()}
						onclick={submitKey}
					>
						{#if phase === 'validating'}
							<i class="fa-solid fa-spinner fa-spin"></i>
						{:else}
							<i class="fa-solid fa-arrow-right"></i>
						{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- Overview stat cards -->
		<div class="flex-shrink-0 border-b border-[#e5e7eb] bg-white px-6 py-4">
			<div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
				{#each [['Experts', scopedOverview.experts_total, 'fa-users'], ['Completed', scopedOverview.experts_completed, 'fa-circle-check'], ['In progress', scopedOverview.experts_in_progress, 'fa-hourglass-half'], ['Evaluations', scopedOverview.evaluations_total, 'fa-clipboard-check'], ['Metrics covered', scopedOverview.metrics_covered, 'fa-list-check'], ['Scenarios covered', scopedOverview.scenarios_covered, 'fa-comments']] as [label, value, icon] (label)}
					<div class="rounded-[12px] border border-[#f3f4f6] bg-[#fafaf9] px-4 py-3">
						<div
							class="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.06em] text-[#9ca3af] uppercase"
						>
							<i class="fa-solid {icon} text-[#00b3b0]"></i>{label}
						</div>
						<div class="mt-1 text-[24px] leading-none font-[800] text-[#111827]">{value}</div>
					</div>
				{/each}
			</div>
			{#if scopedOverview.last_submission_at}
				<div class="mt-2 text-[11px] text-[#9ca3af]">
					Last submission: {fmtDate(scopedOverview.last_submission_at)}
				</div>
			{/if}
		</div>

		<!-- Two-column: metrics list + detail -->
		<div class="flex min-h-0 flex-1 overflow-hidden">
			<!-- Metrics list -->
			<aside
				class="flex w-[320px] flex-shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white"
			>
				<div class="flex-shrink-0 border-b border-[#f3f4f6] px-4 py-3">
					<div class="mb-2 flex items-baseline justify-between">
						<h2 class="text-[13px] font-[800] text-[#111827]">Metrics</h2>
						<span class="text-[11px] text-[#9ca3af]">{filteredMetrics.length}</span>
					</div>
					<div class="relative">
						<i
							class="fa-solid fa-magnifying-glass absolute top-1/2 left-[8px] -translate-y-1/2 text-[10px] text-[#b0b8c4]"
						></i>
						<input
							type="text"
							placeholder="Search metrics…"
							bind:value={search}
							class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-[#fafaf9] py-[5px] pr-3 pl-[24px] text-[12px] outline-none focus:border-[#00b3b0] focus:bg-white"
						/>
					</div>
				</div>
				<div class="flex-1 overflow-y-auto">
					{#if filteredMetrics.length === 0}
						<div
							class="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#9ca3af]"
						>
							<i class="fa-solid fa-inbox text-xl opacity-30"></i>
							<p class="text-[12px]">No submitted evaluations yet.</p>
						</div>
					{:else}
						{#each filteredMetrics as m (m.metric_id)}
							<button
								class="flex w-full flex-col items-start gap-[3px] border-b border-[#f3f4f6] px-4 py-[10px] text-left transition-colors
									{selectedMetricId === m.metric_id ? 'bg-[#e0f7f7]' : 'hover:bg-[#f9fafb]'}"
								onclick={() => openMetric(m.metric_id)}
							>
								<span class="flex w-full items-start justify-between gap-2">
									<span class="line-clamp-2 text-[12px] font-medium text-[#1a1a1a]">
										{m.metric_name || m.metric_id}
									</span>
									{#if Number(m.evaluation_count) > 0}
										<span
											class="flex-shrink-0 rounded-full bg-[#dcfce7] px-1.5 py-[1px] text-[9px] font-bold text-[#166534]"
										>
											{m.evaluation_count}
										</span>
									{/if}
								</span>
								<span class="text-[10px] text-[#9ca3af]">
									{m.evaluation_count} eval{m.evaluation_count === 1 ? '' : 's'} ·
									{m.expert_count} expert{m.expert_count === 1 ? '' : 's'} ·
									{m.scenario_count} scenario{m.scenario_count === 1 ? '' : 's'}
								</span>
							</button>
						{/each}
					{/if}
				</div>
			</aside>

			<!-- Detail -->
			<section class="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
				{#if !selectedMetricId}
					<div class="flex h-full flex-col items-center justify-center gap-3 text-[#9ca3af]">
						<i class="fa-solid fa-hand-pointer text-3xl opacity-20"></i>
						<p class="text-[13px] font-medium">Select a metric to see its evaluations</p>
					</div>
				{:else}
					<div class="flex-shrink-0 border-b border-[#e5e7eb] px-6 pt-3 pb-3">
						<div class="flex items-start justify-between gap-4">
							<div>
								<div class="text-[15px] font-[700] tracking-[-0.01em] text-[#1a1a1a]">
									{selectedMetric?.metric_name || selectedMetricId}
								</div>
								<div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#9ca3af]">
									<span>{selectedMetricId}</span>
									{#if selectedMetric?.rating_breakdown}
										{#each Object.entries(selectedMetric.rating_breakdown) as [rating, count] (rating)}
											<span
												class="rounded-full bg-[#f3f4f6] px-2 py-[1px] font-semibold text-[#4b5563]"
												>{rating}: {count}</span
											>
										{/each}
									{/if}
								</div>
							</div>
							<div class="flex flex-shrink-0 items-center gap-2">
								{#if selectedExpertSlug && adminState.key}
									<button
										type="button"
										class="inline-flex items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 py-[6px] text-[11px] font-semibold text-[#4b5563] transition-colors hover:border-[#00b3b0] hover:text-[#038d8f]"
										onclick={openTestForm}
									>
										<i class="fa-solid fa-flask"></i>
										Test form
									</button>
								{/if}
								<button
									type="button"
									class="inline-flex items-center gap-2 rounded-[8px] border px-3 py-[6px] text-[11px] font-semibold transition-colors
									{showFormPreview
										? 'border-[#00b3b0] bg-[#e0f7f7] text-[#038d8f]'
										: 'border-[#e5e7eb] bg-white text-[#4b5563] hover:border-[#00b3b0] hover:text-[#038d8f]'}"
									onclick={toggleFormPreview}
								>
									<i class="fa-solid {showFormPreview ? 'fa-list-check' : 'fa-file-lines'}"></i>
									{showFormPreview ? 'View responses' : 'View form'}
								</button>
							</div>
						</div>
					</div>
					<div class="flex-1 overflow-y-auto px-6 py-4">
						{#if showFormPreview}
							<div
								class="mx-auto mb-4 grid max-w-[760px] grid-cols-1 gap-3 rounded-[12px] border border-[#e5e7eb] bg-[#fafaf9] p-4 sm:grid-cols-2"
							>
								<label class="text-[11px] font-semibold text-[#374151]">
									Scenario
									<select
										class="mt-1 block w-full rounded-[7px] border border-[#d1d5db] bg-white px-2 py-2 text-[12px] font-normal text-[#111827] outline-none focus:border-[#00b3b0]"
										value={previewScenarioId}
										onchange={(event) => {
											previewScenarioId = event.currentTarget.value;
											void loadPreviewConversation(previewScenarioId, previewModelId);
										}}
									>
										{#each previewScenarios as scenario (scenario.scenario_id)}
											<option value={scenario.scenario_id}>{scenario.title}</option>
										{/each}
									</select>
								</label>
								<label class="text-[11px] font-semibold text-[#374151]">
									Model being evaluated
									<select
										class="mt-1 block w-full rounded-[7px] border border-[#d1d5db] bg-white px-2 py-2 text-[12px] font-normal text-[#111827] outline-none focus:border-[#00b3b0]"
										value={previewModelId}
										onchange={(event) => {
											previewModelId = event.currentTarget.value;
											void loadPreviewConversation(previewScenarioId, previewModelId);
										}}
									>
										{#each EXPERT_MODEL_POOL as modelId (modelId)}
											<option value={modelId}>{modelName(modelId)} ({modelId})</option>
										{/each}
									</select>
								</label>
							</div>
							<AdminEvaluationFormPreview
								metricName={selectedMetric?.metric_name || selectedMetricId}
								scenarioTitle={previewScenarios.find(
									(scenario) => scenario.scenario_id === previewScenarioId
								)?.title ?? ''}
								modelLabel={modelName(previewModelId)}
								conversation={previewConversation}
								conversationLoading={previewConversationLoading}
								conversationError={previewConversationError}
							/>
						{:else if detailLoading}
							<div class="flex items-center gap-2 text-[13px] text-[#9ca3af]">
								<i class="fa-solid fa-spinner fa-spin"></i> Loading evaluations…
							</div>
						{:else if detailError}
							<div
								class="rounded-[10px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[12px] text-[#c2410c]"
							>
								{detailError}
							</div>
						{:else}
							<div class="flex flex-col gap-6">
								<section>
									<div class="mb-2 flex items-center gap-2">
										<i class="fa-solid fa-clipboard-list text-[11px] text-[#00b3b0]"></i>
										<h3 class="text-[12px] font-[800] text-[#111827]">Metric feedback</h3>
										<span class="text-[10px] text-[#9ca3af]"
											>{metricFeedback.length} response{metricFeedback.length === 1
												? ''
												: 's'}</span
										>
									</div>
									{#if feedbackError}
										<div
											class="mb-2 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[11px] text-[#c2410c]"
										>
											Metric feedback unavailable: {feedbackError}
										</div>
									{:else if metricFeedback.length === 0}
										<div
											class="rounded-[8px] border border-dashed border-[#e5e7eb] bg-[#fafaf9] px-3 py-2 text-[11px] text-[#9ca3af]"
										>
											No metric feedback submitted yet.
										</div>
									{:else}
										<div class="flex flex-col gap-2">
											{#each metricFeedback as fb (fb.expert_id)}
												<div class="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
													<button
														class="flex w-full items-center gap-3 bg-[#fafaf9] px-4 py-[10px] text-left transition-colors hover:bg-[#f3f4f6]"
														onclick={() =>
															(expandedFeedback =
																expandedFeedback === fb.expert_id ? null : fb.expert_id)}
													>
														<div class="min-w-0 flex-1">
															<div class="truncate text-[12px] font-semibold text-[#1a1a1a]">
																{fb.expert_name || 'Unknown expert'}
															</div>
															<div class="mt-[1px] truncate text-[10px] text-[#9ca3af]">
																{fb.expert_subarea ? `${fb.expert_subarea} · ` : ''}Relevance:
																{fb.relevance || '—'} · Updated {fmtDate(fb.updated_at)}
															</div>
														</div>
														<i
															class="fa-solid {expandedFeedback === fb.expert_id
																? 'fa-chevron-up'
																: 'fa-chevron-down'} flex-shrink-0 text-[9px] text-[#c4c9d1]"
														></i>
													</button>
													{#if expandedFeedback === fb.expert_id}
														<div class="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 md:grid-cols-2">
															{#each [['Relevance', fb.relevance], ['Label differently?', fb.label_different], ['Examples adequate?', fb.examples_adequate], ['Updated', fmtDate(fb.updated_at)]] as [label, value] (label)}
																{#if value}
																	<div>
																		<div
																			class="mb-[2px] text-[10px] font-bold tracking-[0.06em] text-[#9ca3af] uppercase"
																		>
																			{label}
																		</div>
																		<div class="text-[12px] leading-[1.5] text-[#374151]">
																			{value}
																		</div>
																	</div>
																{/if}
															{/each}
															{#each [['Relevance edit', fb.relevance_edit], ['Label edit', fb.label_edit], ['Examples edit', fb.examples_edit], ['Other feedback', fb.other_feedback]] as [label, value] (label)}
																{#if value}
																	<div class="md:col-span-2">
																		<div
																			class="mb-[2px] text-[10px] font-bold tracking-[0.06em] text-[#9ca3af] uppercase"
																		>
																			{label}
																		</div>
																		<div
																			class="rounded-[8px] border-l-[2px] border-[#e5e7eb] bg-[#fafaf9] px-3 py-2 text-[12px] leading-[1.6] whitespace-pre-line text-[#374151]"
																		>
																			{value}
																		</div>
																	</div>
																{/if}
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</section>

								<section>
									<div class="mb-2 flex items-center gap-2">
										<i class="fa-solid fa-comments text-[11px] text-[#00b3b0]"></i>
										<h3 class="text-[12px] font-[800] text-[#111827]">Scenario evaluations</h3>
									</div>
									{#if evaluationGroups.length === 0}
										<p class="text-[12px] text-[#9ca3af]">
											No scenarios available for this metric.
										</p>
									{:else}
										<div class="flex flex-col gap-5">
											{#each evaluationGroups as group (group.scenarioId)}
												<section>
													<div class="mb-2 flex items-center gap-2">
														<h4 class="text-[12px] font-semibold text-[#374151]">
															{group.scenarioTitle}
														</h4>
														<span class="text-[10px] text-[#9ca3af]"
															>{group.evaluations.length} response{group.evaluations.length === 1
																? ''
																: 's'}</span
														>
													</div>
													<div class="flex flex-col gap-2 border-l-2 border-[#e0f7f7] pl-3">
														{#if group.evaluations.length === 0}
															<div
																class="rounded-[8px] border border-dashed border-[#e5e7eb] bg-[#fafaf9] px-3 py-2 text-[11px] text-[#9ca3af]"
															>
																No responses yet
															</div>
														{:else}
															{#each group.evaluations as ev (evalKey(ev))}
																{@const k = evalKey(ev)}
																<div class="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
																	<button
																		class="flex w-full items-center gap-3 bg-[#fafaf9] px-4 py-[10px] text-left transition-colors hover:bg-[#f3f4f6]"
																		onclick={() => (expandedEval = expandedEval === k ? null : k)}
																	>
																		<div class="min-w-0 flex-1">
																			<div
																				class="truncate text-[12px] font-semibold text-[#1a1a1a]"
																			>
																				{ev.expert_name || 'Unknown expert'}
																			</div>
																			<div class="mt-[1px] truncate text-[10px] text-[#9ca3af]">
																				{ev.expert_subarea ? `${ev.expert_subarea} · ` : ''}
																				{ev.masked_model_label
																					? `${ev.masked_model_label} · `
																					: ''}{modelName(ev.model_id)} ({ev.model_id})
																			</div>
																		</div>
																		{#if ev.rating}
																			<span
																				class="flex-shrink-0 rounded-full bg-[#e0f7f7] px-2 py-[2px] text-[10px] font-bold text-[#038d8f]"
																				>{ev.rating}</span
																			>
																		{/if}
																		<i
																			class="fa-solid {expandedEval === k
																				? 'fa-chevron-up'
																				: 'fa-chevron-down'} flex-shrink-0 text-[9px] text-[#c4c9d1]"
																		></i>
																	</button>
																	{#if expandedEval === k}
																		<div
																			class="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 md:grid-cols-2"
																		>
																			{#each [['Rating', ev.rating], ['Confidence', ev.confidence], ['Scenario accurate?', ev.scenario_accurate], ['Scenario realistic?', ev.scenario_realistic], ['Main challenge', ev.main_challenge === 'Other' ? ev.main_challenge_other : ev.main_challenge], ['Influenced aspects', ev.influenced_aspects], ['Submitted', fmtDate(ev.submitted_at)]] as [label, value] (label)}
																				{#if value}
																					<div>
																						<div
																							class="mb-[2px] text-[10px] font-bold tracking-[0.06em] text-[#9ca3af] uppercase"
																						>
																							{label}
																						</div>
																						<div class="text-[12px] leading-[1.5] text-[#374151]">
																							{value}
																						</div>
																					</div>
																				{/if}
																			{/each}
																			{#each [['Accuracy edit', ev.scenario_accurate_edit], ['Realism edit', ev.scenario_realistic_edit], ['Justification', ev.justification], ['Other feedback', ev.other_feedback]] as [label, value] (label)}
																				{#if value}
																					<div class="md:col-span-2">
																						<div
																							class="mb-[2px] text-[10px] font-bold tracking-[0.06em] text-[#9ca3af] uppercase"
																						>
																							{label}
																						</div>
																						<div
																							class="rounded-[8px] border-l-[2px] border-[#e5e7eb] bg-[#fafaf9] px-3 py-2 text-[12px] leading-[1.6] whitespace-pre-line text-[#374151]"
																						>
																							{value}
																						</div>
																					</div>
																				{/if}
																			{/each}
																		</div>
																	{/if}
																</div>
															{/each}
														{/if}
													</div>
												</section>
											{/each}
										</div>
									{/if}
								</section>
							</div>
						{/if}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>
