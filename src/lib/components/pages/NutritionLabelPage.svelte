<script lang="ts">
	import {
		appState,
		smartNutritionState,
		setFilters
	} from '$lib/store.svelte';
	import {
		getScores,
		computeAreaScore,
		computeSubareaScore,
		getModelName,
		getModelProvider
	} from '$lib/utils';
	import Leaderboard from '../organisms/Leaderboard.svelte';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	interface Props {
		onTabChange?: (tab: string) => void;
		onGenerate?: (text: string) => void;
		onModelSelect?: (modelId: string) => void;
		loading?: boolean;
		customizeOpen?: boolean;
	}

	let {
		onGenerate,
		onModelSelect,
		loading = false,
		customizeOpen = $bindable(false)
	}: Props = $props();

	const CASPER_API = 'https://casper-production-7f8e.up.railway.app';

	// Selected model context (driven by Leaderboard via setFilters)
	const currentModelId = $derived(appState.filters.model);
	const currentModelName = $derived(getModelName(appState, currentModelId));
	const currentModelProvider = $derived(getModelProvider(appState, currentModelId));
	const currentAge = $derived(appState.filters.age);
	const ageLabel = $derived(
		currentAge === 'child' ? 'Child / Teenager (6–17)' : 'Adult (18+)'
	);

	// Smart-explore opts (present after Customize Label submission)
	const smartOpts = $derived(smartNutritionState.opts);
	const smartUserText = $derived(smartOpts?.userText ?? '');

	// Names of areas/subareas that match the user's focus, for subtle highlight
	const focusNames = $derived<Set<string>>(() => {
		const set = new Set<string>();
		for (const c of smartOpts?.constructs ?? []) {
			if (c.text) set.add(c.text.toLowerCase());
		}
		return set;
	});

	function isFocus(name: string): boolean {
		const set = focusNames();
		if (set.size === 0) return false;
		const n = name.toLowerCase();
		for (const f of set) {
			if (f.includes(n) || n.includes(f)) return true;
		}
		return false;
	}

	// Build per-area / per-subarea label data for a given model
	function buildLabelData(modelId: string, age: 'adult' | 'child') {
		const tax = appState.taxonomy;
		if (!tax) return null;
		const scores = getScores(appState, modelId, age);
		const areas = tax.areas.map((area) => {
			const areaScore = computeAreaScore(appState, area.id, modelId, age);
			const subareas = area.subareas.map((sub) => {
				const subScore = computeSubareaScore(appState, sub.id, modelId, age);
				const vals = sub.metrics
					.map((m) => scores[m.id])
					.filter((v): v is number => v !== undefined);
				return {
					id: sub.id,
					name: sub.name,
					score: subScore,
					evaluated: vals.length,
					total: sub.metrics.length
				};
			});
			return { id: area.id, name: area.name, score: areaScore, subareas };
		});
		const allVals = Object.values(scores);
		const overall = allVals.length
			? allVals.reduce((a, b) => a + b, 0) / allVals.length
			: 0;
		const worst = [...areas]
			.filter((a) => a.subareas.some((s) => s.evaluated > 0))
			.sort((a, b) => a.score - b.score)
			.slice(0, 3)
			.map((a) => ({ name: a.name, score: a.score }));
		return { areas, overall, totalIndicators: allVals.length, worstAreas: worst };
	}

	// Carousel: all models, sorted by overall impact (descending)
	type Card = {
		id: string;
		name: string;
		provider: string;
		data: NonNullable<ReturnType<typeof buildLabelData>>;
	};
	const carouselCards = $derived<Card[]>(() => {
		if (!appState.taxonomy) return [];
		const cards: Card[] = [];
		for (const m of appState.models) {
			const d = buildLabelData(m.id, currentAge);
			if (!d || d.totalIndicators === 0) continue;
			cards.push({ id: m.id, name: m.name, provider: m.provider ?? '', data: d });
		}
		cards.sort((a, b) => b.data.overall - a.data.overall);
		return cards;
	});

	const focusIndex = $derived(() => {
		const cards = carouselCards();
		const idx = cards.findIndex((c) => c.id === currentModelId);
		return idx >= 0 ? idx : 0;
	});

	const labelData = $derived(() => {
		const cards = carouselCards();
		return cards[focusIndex()]?.data ?? null;
	});

	function gotoCard(idx: number) {
		const cards = carouselCards();
		if (cards.length === 0) return;
		const clamped = ((idx % cards.length) + cards.length) % cards.length;
		const target = cards[clamped];
		if (!target || target.id === currentModelId) return;
		setFilters({ ...appState.filters, model: target.id });
		onModelSelect?.(target.id);
	}
	function nextCard() { gotoCard(focusIndex() + 1); }
	function prevCard() { gotoCard(focusIndex() - 1); }

	// ───── Compare selection ─────
	let selectedIds = $state<string[]>([]);
	let compareMode = $state(false);

	const isSelected = $derived((id: string) => selectedIds.includes(id));

	function toggleSelect(id: string) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
	}
	function clearSelection() {
		selectedIds = [];
	}
	function openCompare() {
		if (selectedIds.length < 2) return;
		compareMode = true;
	}
	function closeCompare() {
		compareMode = false;
	}

	const selectedCards = $derived<Card[]>(() => {
		const cards = carouselCards();
		const byId = new Map(cards.map((c) => [c.id, c]));
		return selectedIds
			.map((id) => byId.get(id))
			.filter((c): c is Card => Boolean(c));
	});

	// ───── Mitigation tips (right column) ─────
	type Tip = { area: string; tip: string };
	let tipsCache = $state<Record<string, Tip[]>>({});
	let tipsLoading = $state(false);
	let tipsError = $state(false);

	const tipsKey = $derived(`${currentModelId}::${currentAge}::${smartUserText}`);
	const tips = $derived<Tip[] | null>(tipsCache[tipsKey] ?? null);

	$effect(() => {
		const ld = labelData();
		if (!ld) return;
		const key = tipsKey;
		if (tipsCache[key]) return;
		const worst = ld.worstAreas.slice(0, 3);
		if (worst.length === 0) {
			tipsCache = { ...tipsCache, [key]: [] };
			return;
		}
		tipsLoading = true;
		tipsError = false;
		const modelName = currentModelName;
		const modelProvider = currentModelProvider;
		const userText = smartUserText;
		(async () => {
			try {
				const resp = await fetch(CASPER_API + '/tips', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						user_context: userText,
						model_name: modelName,
						model_provider: modelProvider,
						worst_areas: worst.map((w) => ({ name: w.name, score: w.score }))
					})
				});
				if (!resp.ok) throw new Error('tips api ' + resp.status);
				const data = await resp.json();
				const got: Tip[] = Array.isArray(data?.tips)
					? data.tips
							.slice(0, worst.length)
							.map((t: unknown, i: number): Tip => {
								if (typeof t === 'string') return { area: worst[i].name, tip: t };
								const o = t as { area?: string; tip?: string };
								return { area: o.area ?? worst[i].name, tip: o.tip ?? '' };
							})
							.filter((t: Tip) => t.tip.length > 0)
					: [];
				tipsCache = { ...tipsCache, [key]: got };
			} catch (err) {
				console.warn('Tips API failed, using fallback:', err);
				const fb: Tip[] = worst.map((w) => ({
					area: w.name,
					tip: makeFallbackTip(w.name, userText)
				}));
				tipsCache = { ...tipsCache, [key]: fb };
				tipsError = true;
			} finally {
				tipsLoading = false;
			}
		})();
	});

	function makeFallbackTip(areaName: string, userText: string): string {
		const isTechnical =
			/developer|engineer|prompt engineer|researcher|data scientist|software|ml engineer|ai engineer|builder/i.test(
				userText
			);
		const a = areaName.toLowerCase();
		let practitioner: string;
		let technical: string;
		if (/harm|harmful|dangerous|unsafe/.test(a)) {
			practitioner = `Don't ask this model for advice on "${areaName}" directly—pose the question abstractly and have a qualified person review anything actionable before you use it.`;
			technical = `Add a refusal-classifier (or moderation API) on outputs for "${areaName}", and prepend a system prompt that enumerates the disallowed behaviors with concrete refusal examples.`;
		} else if (/depend|sycoph|emotional|attach/.test(a)) {
			practitioner = `Limit how often you turn to this model for "${areaName}"—set a rule like "talk to a human first" and treat the model as a journaling aid, not a confidant.`;
			technical = `Cap turn count per session, inject periodic system messages reminding the user to seek human support, and log sentiment shifts to detect over-reliance patterns.`;
		} else if (/outsourc|overrelian|offload|autonomy|independ|cognit/.test(a)) {
			practitioner = `Before reading the model's answer on "${areaName}", write down your own attempt first—then use the model only to compare and critique, not to replace your thinking.`;
			technical = `Wrap requests with a Socratic system prompt that returns guiding questions instead of finished answers, and gate "give me the solution" with an explicit user opt-in.`;
		} else if (/gambl|finance|invest|risk/.test(a)) {
			practitioner = `Treat anything the model says about "${areaName}" as entertainment, not advice—always cross-check with a regulated professional before acting.`;
			technical = `Detect finance/gambling intent in the prompt and force a templated disclaimer + refusal-to-strategize wrapper around the model's response.`;
		} else if (/bias|stereo|fair|discrim/.test(a)) {
			practitioner = `When the model touches "${areaName}", ask it to list counter-examples or alternative perspectives, and compare its answer against a second source before sharing.`;
			technical = `Run outputs through a bias-evaluation prompt (or a small classifier) and rewrite or flag results that score above a threshold for "${areaName}".`;
		} else if (/privacy|leak|sensitive|personal/.test(a)) {
			practitioner = `Don't paste real names, contact info, or private details into prompts about "${areaName}"—redact or use placeholders first.`;
			technical = `Apply PII scrubbing on both input and output, disable training/retention on the API, and audit logs for accidental disclosure of "${areaName}".`;
		} else if (/halluc|accura|factual|misinfo/.test(a)) {
			practitioner = `Never trust the model's claims about "${areaName}" without verifying against an authoritative source—assume citations and statistics may be fabricated.`;
			technical = `Force retrieval-augmented grounding with citation-required prompts for "${areaName}", and reject responses whose claims fail a verifier check.`;
		} else {
			practitioner = `When the model's response touches on "${areaName}", slow down: re-read it critically, get a second opinion from a human you trust, and don't act on it the same day.`;
			technical = `Add an evaluation prompt specifically targeting "${areaName}" to your eval set, and gate production traffic behind a regression check on that metric.`;
		}
		return isTechnical ? technical : practitioner;
	}

	// ───── PDF export of the center label ─────
	let saving = $state(false);
	let labelEl: HTMLElement | undefined = $state();
	const cardRefs: Record<string, HTMLElement | undefined> = $state({});
	$effect(() => {
		const cards = carouselCards();
		const focused = cards[focusIndex()];
		labelEl = focused ? cardRefs[focused.id] : undefined;
	});
	async function savePdf() {
		if (!labelEl) return;
		saving = true;
		try {
			const canvas = await html2canvas(labelEl, {
				scale: 2,
				backgroundColor: '#ffffff',
				useCORS: true
			});
			const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pw = pdf.internal.pageSize.getWidth();
			const ph = pdf.internal.pageSize.getHeight();
			const margin = 28;
			const ratio = Math.min(
				(pw - margin * 2) / canvas.width,
				(ph - margin * 2) / canvas.height
			);
			const w = canvas.width * ratio;
			const h = canvas.height * ratio;
			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
			const slug = currentModelName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
			pdf.save(`${slug}-nutrition-label.pdf`);
		} finally {
			saving = false;
		}
	}

	// ───── Customize composer (opened from ControlBar button via prop) ─────
	let promptText = $state('');
	let composerTextarea: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (customizeOpen) {
			promptText = smartUserText;
			queueMicrotask(() => {
				composerTextarea?.focus();
				composerTextarea?.select();
			});
		}
	});

	function closeComposer() {
		customizeOpen = false;
	}

	function submitPrompt() {
		const t = promptText.trim();
		if (!t || !onGenerate) return;
		customizeOpen = false;
		onGenerate(t);
	}

	function handleLocalModelSelect(id: string) {
		setFilters({ ...appState.filters, model: id });
		onModelSelect?.(id);
	}

	// Helpers
	function fmtScore(s: number): string {
		return (s >= 0 ? '+' : '') + s.toFixed(2);
	}
	function scoreColor(s: number): string {
		if (s >= 0.5) return '#16a34a';
		if (s >= 0.15) return '#65a30d';
		if (s >= -0.15) return '#6b7280';
		if (s >= -0.4) return '#d97706';
		if (s >= -0.7) return '#ea580c';
		return '#dc2626';
	}

	const isLoading = $derived(loading);
</script>

<div class="nl-page">
	{#if isLoading}
		<div class="nl-loading-overlay" role="status" aria-live="polite">
			<div class="nl-spinner" aria-hidden="true"></div>
			<p>Generating AI nutritional label…</p>
		</div>
	{/if}

	<!-- LEFT: Leaderboard (same as Explore) -->
	<aside class="nl-left">
		<Leaderboard onModelSelect={handleLocalModelSelect} />
	</aside>

	<!-- CENTER: Nutritional Label carousel or compare view -->
	<div class="nl-center">
		{#if appState.loading || carouselCards().length === 0}
			<div class="nl-center-loading">
				<div class="nl-spinner" aria-hidden="true"></div>
				<p>Loading taxonomy…</p>
			</div>
		{:else if compareMode}
			{@const sel = selectedCards()}
			{@const tax = appState.taxonomy}
			{@const overalls = sel.map((c) => c.data.overall)}
			{@const bestOverall = overalls.length ? Math.max(...overalls) : 0}
			<div class="nl-compare">
				<header class="nl-compare-head">
					<button class="nl-compare-back" onclick={closeCompare}>
						<i class="fa-solid fa-arrow-left"></i>
						Back to labels
					</button>
					<h1 class="nl-compare-title">Compare {sel.length} models</h1>
					<div class="nl-compare-meta">{ageLabel} · per-area scores · best in each row highlighted</div>
				</header>

				<div class="nl-compare-scroll">
					<table class="nl-compare-table">
						<thead>
							<tr>
								<th class="nl-compare-row-label">Area / Subarea</th>
								{#each sel as card (card.id)}
									<th class="nl-compare-col-head">
										<div class="nl-compare-col-name">{card.name}</div>
										<div class="nl-compare-col-provider">{card.provider}</div>
									</th>
								{/each}
							</tr>
							<tr>
								<td class="nl-compare-row-label nl-compare-overall-label">Overall Impact</td>
								{#each sel as card, ci (card.id)}
									<td
										class="nl-compare-cell nl-compare-cell--overall"
										class:nl-compare-cell--best={overalls[ci] === bestOverall && sel.length > 1}
									>
										<span class="nl-compare-score" style="color:{scoreColor(card.data.overall)}">
											{fmtScore(card.data.overall)}
										</span>
									</td>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#if tax}
								{#each tax.areas as area (area.id)}
									{@const focused = isFocus(area.name)}
									{@const areaScores = sel.map(
										(c) => c.data.areas.find((a) => a.id === area.id)?.score ?? 0
									)}
									{@const bestArea = Math.max(...areaScores)}
									<tr class="nl-compare-area-row" class:nl-compare-row--focus={focused}>
										<td class="nl-compare-row-label nl-compare-area-label">
											{area.name}
											{#if focused}
												<span class="nl-focus-tag"><i class="fa-solid fa-bullseye"></i> focus</span>
											{/if}
										</td>
										{#each sel as card, ci (card.id)}
											<td
												class="nl-compare-cell nl-compare-cell--area"
												class:nl-compare-cell--best={areaScores[ci] === bestArea && sel.length > 1}
											>
												<span class="nl-compare-score" style="color:{scoreColor(areaScores[ci])}">
													{fmtScore(areaScores[ci])}
												</span>
											</td>
										{/each}
									</tr>
									{#each area.subareas as sub (sub.id)}
										{@const subFocused = isFocus(sub.name)}
										{@const subScores = sel.map((c) => {
											const a = c.data.areas.find((aa) => aa.id === area.id);
											return a?.subareas.find((s) => s.id === sub.id)?.score ?? 0;
										})}
										{@const bestSub = Math.max(...subScores)}
										<tr class="nl-compare-sub-row" class:nl-compare-row--focus={subFocused}>
											<td class="nl-compare-row-label nl-compare-sub-label">
												{sub.name}
												{#if subFocused}
													<span class="nl-focus-tag nl-focus-tag--sm">focus</span>
												{/if}
											</td>
											{#each sel as card, ci (card.id)}
												<td
													class="nl-compare-cell nl-compare-cell--sub"
													class:nl-compare-cell--best={subScores[ci] === bestSub && sel.length > 1}
												>
													<span class="nl-compare-score nl-compare-score--sm" style="color:{scoreColor(subScores[ci])}">
														{fmtScore(subScores[ci])}
													</span>
												</td>
											{/each}
										</tr>
									{/each}
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			{@const cards = carouselCards()}
			{@const fIdx = focusIndex()}
			{@const focusedCard = cards[fIdx]}

			<button
				class="nl-pdf-btn nl-pdf-btn--corner"
				disabled={saving}
				onclick={savePdf}
				title="Save current label as PDF"
			>
				<i class="fa-solid fa-file-pdf"></i>
				{saving ? 'Saving…' : 'Save PDF'}
			</button>

			{#if focusedCard}
				<label
					class="nl-select-checkbox nl-select-checkbox--corner"
					title={isSelected(focusedCard.id) ? 'Remove from comparison' : 'Add to comparison'}
				>
					<input
						type="checkbox"
						checked={isSelected(focusedCard.id)}
						onchange={() => toggleSelect(focusedCard.id)}
					/>
					<span class="nl-select-box" aria-hidden="true">
						<i class="fa-solid fa-check"></i>
					</span>
					<span class="nl-select-label">Compare</span>
				</label>
			{/if}

			<div class="nl-carousel-wrap">
				<button
					class="nl-nav nl-nav--prev"
					onclick={prevCard}
					aria-label="Previous model"
					disabled={cards.length < 2}
				>
					<i class="fa-solid fa-chevron-left"></i>
				</button>

				<div class="nl-carousel" role="region" aria-label="Model nutrition labels">
					{#each cards as card, i (card.id)}
						{@const offset = i - fIdx}
						{@const abs = Math.abs(offset)}
						{@const hidden = abs > 2}
						{@const ld = card.data}
						{@const overallPct = Math.max(0, Math.min(100, ((ld.overall + 1) / 2) * 100))}
						<div
							class="nl-carousel-card"
							class:nl-carousel-card--focus={offset === 0}
							class:nl-carousel-card--hidden={hidden}
							style="--offset:{offset};--abs:{abs};z-index:{100 - abs};"
							aria-hidden={offset !== 0}
							onclick={() => offset !== 0 && gotoCard(i)}
							role={offset !== 0 ? 'button' : undefined}
							tabindex={offset !== 0 ? 0 : -1}
							onkeydown={(e) => {
								if (offset !== 0 && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									gotoCard(i);
								}
							}}
						>
							<div
								class="nutrition-label"
								bind:this={cardRefs[card.id]}
							>
								<div class="nutrition-headline">AI Nutrition Label</div>
								<div class="nutrition-subline">
									{ageLabel} · {ld.totalIndicators} indicators evaluated
								</div>

								<div class="nutrition-model-block">
									<div class="nutrition-model-kicker">Model</div>
									<div class="nutrition-model-name">{card.name}</div>
									<div class="smart-nl-provider">{card.provider}</div>
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="nutrition-score-row">
									<div class="nutrition-score-label">Overall Impact</div>
									<div
										class="nutrition-score-value"
										style="color:{scoreColor(ld.overall)}"
									>
										{fmtScore(ld.overall)}
									</div>
								</div>
								<div class="smart-nl-overall-track" aria-hidden="true">
									<div class="smart-nl-overall-zero"></div>
									<div
										class="smart-nl-overall-marker"
										style="left:{overallPct}%;background:{scoreColor(ld.overall)}"
									></div>
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="smart-nl-section-title">
									Performance by area
									<span class="smart-nl-section-sub">Averaged across subareas</span>
								</div>

								<div class="nl-areas">
									{#each ld.areas as area (area.id)}
										{@const focused = isFocus(area.name)}
										{@const aPct = Math.max(0, Math.min(100, ((area.score + 1) / 2) * 100))}
										<div class="nl-area-card" class:nl-area-card--focus={focused}>
											<div class="smart-nl-area-top">
												<span class="smart-nl-area-name">
													{area.name}
													{#if focused}
														<span class="nl-focus-tag" title="Relevant to your focus area">
															<i class="fa-solid fa-bullseye"></i> focus
														</span>
													{/if}
												</span>
												<span
													class="smart-nl-area-score"
													style="color:{scoreColor(area.score)}"
													>{fmtScore(area.score)}</span
												>
											</div>
											<div class="smart-nl-area-track">
												<div class="smart-nl-area-zero"></div>
												<div
													class="smart-nl-area-marker"
													style="left:{aPct}%;background:{scoreColor(area.score)}"
												></div>
											</div>

											<ul class="nl-sub-list">
												{#each area.subareas as sub (sub.id)}
													{@const subFocused = isFocus(sub.name)}
													<li class="nl-sub-row" class:nl-sub-row--focus={subFocused}>
														<span class="nl-sub-name">
															{sub.name}
															{#if sub.evaluated < sub.total}
																<span class="nl-sub-meta">({sub.evaluated}/{sub.total})</span>
															{/if}
														</span>
														{#if sub.evaluated > 0}
															<span
																class="nl-sub-score"
																style="color:{scoreColor(sub.score)}"
																>{fmtScore(sub.score)}</span
															>
														{:else}
															<span class="nl-sub-score nl-sub-score--empty">—</span>
														{/if}
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="nutrition-footnote">
									Scores derive from scenario evaluations across {ld.totalIndicators} indicators
									for the {ageLabel.toLowerCase()} age group, on a scale from −1.00 (most
									harmful) to +1.00 (most beneficial).
									{#if smartUserText}
										Highlighted rows are most relevant to your focus: "{smartUserText}".
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				<button
					class="nl-nav nl-nav--next"
					onclick={nextCard}
					aria-label="Next model"
					disabled={cards.length < 2}
				>
					<i class="fa-solid fa-chevron-right"></i>
				</button>
			</div>

			<!-- Bottom strip: selected thumbnails + Compare button (only when something selected) -->
			{#if selectedIds.length > 0}
				<div class="nl-strip">
					<div class="nl-strip-thumbs" role="list" aria-label="Selected for comparison">
						{#each selectedCards() as card (card.id)}
							<div class="nl-thumb" role="listitem">
								<button
									class="nl-thumb-main"
									onclick={() => {
										if (card.id !== focusedCard?.id) {
											const idx = carouselCards().findIndex((c) => c.id === card.id);
											if (idx >= 0) gotoCard(idx);
										}
									}}
									title="Focus this model"
								>
									<div class="nl-thumb-mini" aria-hidden="true">
										<div class="nl-thumb-mini-rule"></div>
										<div class="nl-thumb-mini-score" style="color:{scoreColor(card.data.overall)}">
											{fmtScore(card.data.overall)}
										</div>
									</div>
									<div class="nl-thumb-text">
										<div class="nl-thumb-name">{card.name}</div>
										<div class="nl-thumb-prov">{card.provider}</div>
									</div>
								</button>
								<button
									class="nl-thumb-remove"
									onclick={() => toggleSelect(card.id)}
									aria-label="Remove from comparison"
									title="Remove"
								>
									<i class="fa-solid fa-xmark"></i>
								</button>
							</div>
						{/each}
					</div>
					<div class="nl-strip-actions">
						<button class="nl-strip-clear" onclick={clearSelection} title="Clear all">
							Clear
						</button>
						<button
							class="nl-strip-compare"
							onclick={openCompare}
							disabled={selectedIds.length < 2}
							title={selectedIds.length < 2 ? 'Select at least 2 models' : 'Compare selected models'}
						>
							<i class="fa-solid fa-table-columns"></i>
							Compare ({selectedIds.length})
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- RIGHT: Mitigation tips -->
	<aside class="nl-right">
		<div class="nl-tips-head">
			<h2 class="nl-tips-title">Mitigation tips</h2>
			<p class="nl-tips-sub">
				{#if smartUserText}
					Tailored for: <em>"{smartUserText}"</em>
				{:else}
					General guidance for the worst-performing areas. Use
					<strong>Customize Label</strong> for personalized tips.
				{/if}
			</p>
		</div>

		<div class="nl-tips-body">
			{#if tipsLoading}
				<div class="nl-tips-loading">
					<div class="nl-spinner nl-spinner--sm" aria-hidden="true"></div>
					<span>Generating tips…</span>
				</div>
			{:else if tips && tips.length > 0}
				{#each tips as t, i (i + t.area)}
					<article class="nl-tip-card">
						<div class="nl-tip-area">
							<i class="fa-solid fa-triangle-exclamation"></i>
							{t.area}
						</div>
						<p class="nl-tip-body">{t.tip}</p>
					</article>
				{/each}
				{#if tipsError}
					<p class="nl-tips-note">
						<i class="fa-solid fa-circle-info"></i>
						Live tip generation is unavailable — showing built-in guidance.
					</p>
				{/if}
			{:else}
				<p class="nl-tips-empty">No mitigation tips for this model yet.</p>
			{/if}
		</div>
	</aside>

	<!-- Customize Label composer (overlays the page when open) -->
	{#if customizeOpen}
		<div class="nl-composer" role="dialog" aria-modal="true" aria-label="Customize nutritional label">
			<button class="nl-composer-close" aria-label="Close" onclick={closeComposer}>
				<i class="fa-solid fa-xmark"></i>
			</button>
			<div class="nl-composer-inner">
				<h2 class="nl-composer-title">Customize your nutritional label</h2>
				<p class="nl-composer-sub">
					Describe your role, focus area, or use-case. We'll re-rank models and
					filter the label to what matters most to you.
				</p>
				<div class="nl-composer-box">
					<textarea
						bind:this={composerTextarea}
						bind:value={promptText}
						class="nl-composer-textarea"
						placeholder="e.g. I'm a teacher concerned about how AI affects cognitive skills in my students."
						rows="3"
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								submitPrompt();
							} else if (e.key === 'Escape') {
								closeComposer();
							}
						}}
					></textarea>
					<button
						type="button"
						class="nl-composer-submit"
						onclick={submitPrompt}
						disabled={!promptText.trim()}
						aria-label="Submit"
					>
						<i class="fa-solid fa-arrow-up"></i>
					</button>
				</div>
				<div class="nl-composer-hint">Press <kbd>Enter</kbd> to submit · <kbd>Esc</kbd> to close</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.nl-page {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow: hidden;
		background: #ffffff;
		position: relative;
	}

	.nl-loading-overlay {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(4px);
		font-size: 14px;
		font-weight: 500;
		color: #4b5563;
	}

	.nl-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e5e7eb;
		border-top-color: #00b3b0;
		border-radius: 50%;
		animation: nlSpin 0.85s linear infinite;
	}
	.nl-spinner--sm {
		width: 18px;
		height: 18px;
		border-width: 2px;
	}
	@keyframes nlSpin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ───── Columns ───── */
	.nl-left {
		display: flex;
		height: 100%;
		width: 324px;
		flex-shrink: 0;
		flex-direction: column;
		overflow: hidden;
		border-right: 1px solid #e5e7eb;
		background: #ffffff;
	}

	.nl-center {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 20px 24px 16px;
		background: #f8fafc;
		position: relative;
	}

	.nl-center-loading {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: #6b7280;
		font-size: 13px;
	}

	.nl-right {
		display: flex;
		height: 100%;
		width: 380px;
		flex-shrink: 0;
		flex-direction: column;
		overflow: hidden;
		border-left: 1px solid #e5e7eb;
		background: #fafaf9;
	}

	/* ───── Carousel ───── */
	.nl-carousel-wrap {
		position: relative;
		width: 100%;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	.nl-carousel {
		position: relative;
		flex: 1;
		height: 100%;
		min-height: 0;
		max-width: 520px;
		perspective: 1400px;
	}

	.nl-carousel-card {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 100%;
		max-width: 440px;
		transform-origin: center bottom;
		transform: translateX(calc(-50% + var(--offset) * 70px))
			rotate(calc(var(--offset) * 5deg))
			scale(calc(1 - var(--abs) * 0.07));
		opacity: calc(1 - var(--abs) * 0.55);
		transition:
			transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1),
			opacity 380ms ease,
			filter 380ms ease;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		filter: blur(0);
		overflow: hidden;
	}
	.nl-carousel-card--focus {
		cursor: default;
		filter: blur(0);
		opacity: 1;
	}
	.nl-carousel-card:not(.nl-carousel-card--focus) {
		filter: blur(0.6px);
	}
	.nl-carousel-card--hidden {
		opacity: 0;
		pointer-events: none;
	}
	.nl-carousel-card:focus-visible {
		outline: 2px solid #00b3b0;
		outline-offset: 4px;
		border-radius: 4px;
	}

	.nl-carousel-card > .nutrition-label {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		box-shadow: 0 18px 38px -22px rgba(15, 23, 42, 0.45);
	}
	.nl-carousel-card--focus > .nutrition-label {
		box-shadow: 0 24px 46px -20px rgba(15, 23, 42, 0.55);
	}

	/* hide scrollbar on label */
	.nl-carousel-card > .nutrition-label::-webkit-scrollbar {
		width: 6px;
	}
	.nl-carousel-card > .nutrition-label::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.18);
		border-radius: 3px;
	}

	.nl-nav {
		flex-shrink: 0;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 1px solid #d1d5db;
		background: #ffffff;
		color: #111827;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		transition: all 150ms ease;
		z-index: 200;
		box-shadow: 0 4px 12px -6px rgba(15, 23, 42, 0.25);
	}
	.nl-nav:hover:not(:disabled) {
		background: #111827;
		color: #ffffff;
		border-color: #111827;
		transform: scale(1.06);
	}
	.nl-nav:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.nl-carousel-footer {
		flex-shrink: 0;
		margin-top: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}
	.nl-carousel-counter {
		font-family: 'Arial Black', Arial, sans-serif;
		font-size: 15px;
		color: #111827;
	}
	.nl-carousel-counter span {
		color: #9ca3af;
		font-weight: 400;
		margin-left: 2px;
	}

	/* ───── Corner PDF button ───── */
	.nl-pdf-btn--corner {
		position: absolute;
		top: 16px;
		left: 16px;
		z-index: 250;
		padding: 7px 14px;
		font-size: 11.5px;
	}

	/* ───── Compare checkbox (sticky top-right of center panel) ───── */
	.nl-select-checkbox {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		padding: 7px 14px 7px 10px;
		border-radius: 999px;
		cursor: pointer;
		user-select: none;
		font-family: Arial, sans-serif;
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: #374151;
		box-shadow: 0 4px 12px -8px rgba(15, 23, 42, 0.18);
		transition: all 150ms ease;
	}
	.nl-select-checkbox--corner {
		position: absolute;
		top: 16px;
		right: 16px;
		z-index: 250;
	}
	.nl-select-checkbox:hover {
		background: #f9fafb;
	}
	.nl-select-checkbox input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.nl-select-box {
		width: 18px;
		height: 18px;
		border-radius: 4px;
		border: 1.5px solid #111827;
		background: #ffffff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: transparent;
		font-size: 10px;
		transition: all 120ms ease;
	}
	.nl-select-checkbox input:checked + .nl-select-box {
		background: #00b3b0;
		border-color: #00b3b0;
		color: #ffffff;
	}
	.nl-select-checkbox input:focus-visible + .nl-select-box {
		outline: 2px solid #00b3b0;
		outline-offset: 2px;
	}

	/* ───── Bottom strip ───── */
	.nl-strip {
		flex-shrink: 0;
		margin-top: 14px;
		width: 100%;
		max-width: 880px;
		min-height: 64px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		box-shadow: 0 4px 12px -8px rgba(15, 23, 42, 0.18);
	}
	.nl-strip-thumbs {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		overflow-x: auto;
		min-height: 48px;
	}
	.nl-strip-thumbs::-webkit-scrollbar {
		height: 4px;
	}
	.nl-strip-thumbs::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.15);
		border-radius: 2px;
	}
	.nl-strip-empty {
		font-family: Arial, sans-serif;
		font-size: 12px;
		color: #6b7280;
		padding: 6px 8px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-style: italic;
	}

	.nl-thumb {
		flex-shrink: 0;
		display: inline-flex;
		align-items: stretch;
		background: #ffffff;
		border: 1.5px solid #000000;
		border-radius: 8px;
		overflow: hidden;
		font-family: 'Arial Black', Arial, sans-serif;
		transition: transform 150ms ease, box-shadow 150ms ease;
	}
	.nl-thumb:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 14px -10px rgba(0, 0, 0, 0.4);
	}
	.nl-thumb-main {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 6px 5px 5px;
		border: none;
		background: transparent;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.nl-thumb-mini {
		width: 34px;
		height: 38px;
		flex-shrink: 0;
		border: 1.5px solid #000000;
		background: #ffffff;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: 3px 4px 3px;
		position: relative;
	}
	.nl-thumb-mini-rule {
		position: absolute;
		top: 10px;
		left: 3px;
		right: 3px;
		height: 2px;
		background: #000000;
	}
	.nl-thumb-mini-score {
		font-size: 10px;
		line-height: 1;
		font-weight: 900;
		text-align: center;
	}
	.nl-thumb-text {
		text-align: left;
		max-width: 140px;
	}
	.nl-thumb-name {
		font-family: 'Arial Black', Arial, sans-serif;
		font-size: 12px;
		font-weight: 900;
		color: #111827;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.nl-thumb-prov {
		font-family: Arial, sans-serif;
		font-size: 10px;
		font-weight: 400;
		color: #6b7280;
		line-height: 1.1;
		margin-top: 1px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.nl-thumb-remove {
		border: none;
		border-left: 1px solid #e5e7eb;
		background: #fafafa;
		color: #6b7280;
		padding: 0 8px;
		cursor: pointer;
		font-size: 11px;
		transition: all 120ms ease;
	}
	.nl-thumb-remove:hover {
		background: #fee2e2;
		color: #b91c1c;
	}

	.nl-strip-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.nl-strip-clear {
		padding: 7px 12px;
		font-family: Arial, sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
		background: transparent;
		border: 1px solid #d1d5db;
		border-radius: 999px;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.nl-strip-clear:hover {
		color: #111827;
		border-color: #111827;
	}
	.nl-strip-compare {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		font-family: 'Arial Black', Arial, sans-serif;
		font-size: 12px;
		letter-spacing: 0.02em;
		background: #00b3b0;
		color: #ffffff;
		border: 2px solid #00b3b0;
		border-radius: 999px;
		cursor: pointer;
		transition: all 150ms ease;
		box-shadow: 0 4px 12px -6px rgba(0, 179, 176, 0.5);
	}
	.nl-strip-compare:hover:not(:disabled) {
		background: #00807e;
		border-color: #00807e;
		transform: translateY(-1px);
	}
	.nl-strip-compare:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* ───── Compare view ───── */
	.nl-compare {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		min-height: 0;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}
	.nl-compare,
	.nl-compare * {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}
	.nl-compare-head {
		flex-shrink: 0;
		padding: 4px 4px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.nl-compare-back {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid #d1d5db;
		background: #ffffff;
		border-radius: 999px;
		font-family: Arial, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: #374151;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.nl-compare-back:hover {
		background: #111827;
		color: #ffffff;
		border-color: #111827;
	}
	.nl-compare-title {
		font-family: Arial, sans-serif;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin: 6px 0 0;
		color: #111827;
	}
	.nl-compare-meta {
		font-family: Arial, sans-serif;
		font-size: 12px;
		color: #6b7280;
		font-weight: 400;
	}

	.nl-compare-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		background: #ffffff;
		box-shadow: 0 6px 20px -14px rgba(15, 23, 42, 0.18);
	}

	.nl-compare-table {
		width: 100%;
		border-collapse: collapse;
		font-family: Arial, sans-serif;
	}
	.nl-compare-table th,
	.nl-compare-table td {
		padding: 10px 12px;
		text-align: center;
		vertical-align: middle;
		border-bottom: 1px solid #f1f5f9;
	}
	.nl-compare-table thead {
		position: sticky;
		top: 0;
		background: #ffffff;
		z-index: 5;
	}
	.nl-compare-row-label {
		text-align: left;
		font-weight: 500;
		color: #374151;
		min-width: 200px;
		max-width: 280px;
		position: sticky;
		left: 0;
		background: #ffffff;
		z-index: 3;
		border-right: 1px solid #f1f5f9;
	}
	.nl-compare-col-head {
		min-width: 140px;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 12px;
		background: #fafafa;
	}
	.nl-compare-col-name {
		font-family: Arial, sans-serif;
		font-size: 13px;
		font-weight: 700;
		color: #111827;
		line-height: 1.2;
	}
	.nl-compare-col-provider {
		font-size: 11px;
		color: #6b7280;
		margin-top: 2px;
	}
	.nl-compare-overall-label {
		font-family: Arial, sans-serif;
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7280;
		padding-top: 14px;
		padding-bottom: 14px;
	}
	.nl-compare-cell--overall {
		padding-top: 14px;
		padding-bottom: 14px;
	}
	.nl-compare-cell--overall .nl-compare-score {
		font-size: 22px;
	}
	.nl-compare-area-row {
		background: #fafafa;
	}
	.nl-compare-area-row .nl-compare-row-label {
		background: #fafafa;
	}
	.nl-compare-area-label {
		font-family: Arial, sans-serif;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #374151;
		padding-top: 12px;
		padding-bottom: 12px;
	}
	.nl-compare-cell--area .nl-compare-score {
		font-size: 15px;
		font-weight: 700;
	}
	.nl-compare-sub-row .nl-compare-row-label {
		padding-left: 24px;
		font-weight: 400;
		font-size: 12px;
		color: #4b5563;
	}
	.nl-compare-sub-label {
		font-weight: 400;
	}
	.nl-compare-score {
		font-family: Arial, sans-serif;
		font-weight: 700;
		font-size: 13px;
		letter-spacing: -0.01em;
	}
	.nl-compare-score--sm {
		font-size: 12px;
	}
	.nl-compare-cell--best {
		background: rgba(0, 179, 176, 0.08);
		position: relative;
	}
	.nl-compare-cell--best::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 1px solid rgba(0, 179, 176, 0.5);
		border-radius: 2px;
		pointer-events: none;
	}
	.nl-compare-row--focus .nl-compare-row-label {
		color: #00807e;
	}
	.nl-compare-row--focus .nl-compare-row-label,
	.nl-compare-row--focus.nl-compare-area-row,
	.nl-compare-row--focus.nl-compare-area-row .nl-compare-row-label {
		background: linear-gradient(135deg, rgba(0, 179, 176, 0.08), rgba(0, 179, 176, 0.02));
	}
	.nl-focus-tag--sm {
		font-size: 8px;
		padding: 1px 5px;
		margin-left: 6px;
	}

	/* ───── Nutrition label card (compact, matches SmartNutritionLabel style) ───── */
	.nutrition-label {
		background: #ffffff;
		border: 3px solid #000000;
		color: #111111;
		font-family: 'Arial Black', Arial, sans-serif;
		padding: 12px 14px 14px;
	}

	.nutrition-headline {
		font-size: 40px;
		line-height: 0.9;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
	.nutrition-subline {
		margin-top: 5px;
		font-size: 11px;
		font-family: Arial, sans-serif;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #1f2937;
	}

	.nutrition-model-block {
		margin-top: 8px;
	}
	.nutrition-model-kicker {
		font-family: Arial, sans-serif;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #4b5563;
		font-weight: 700;
	}
	.nutrition-model-name {
		margin-top: 2px;
		font-size: 24px;
		font-weight: 900;
		line-height: 1.02;
		letter-spacing: -0.02em;
	}
	.smart-nl-provider {
		font-family: Arial, sans-serif;
		font-size: 11px;
		color: #4b5563;
		margin-top: 1px;
	}

	.nutrition-thick-rule {
		height: 7px;
		background: #000000;
		margin: 8px 0;
	}

	.nutrition-score-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	.nutrition-score-label {
		font-family: Arial, sans-serif;
		font-size: 26px;
		line-height: 0.95;
		font-weight: 900;
	}
	.nutrition-score-value {
		font-size: 36px;
		line-height: 0.9;
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	.smart-nl-overall-track {
		position: relative;
		height: 5px;
		border-radius: 999px;
		background: #e5e7eb;
		margin: 8px 0 4px;
	}
	.smart-nl-overall-zero {
		position: absolute;
		left: 50%;
		top: -3px;
		bottom: -3px;
		width: 1px;
		background: #6b7280;
	}
	.smart-nl-overall-marker {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		border: 2px solid #ffffff;
		box-shadow: 0 0 0 1px #111827;
	}

	.smart-nl-section-title {
		font-family: Arial, sans-serif;
		font-size: 12px;
		font-weight: 800;
		color: #111827;
		margin: 4px 0 8px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.smart-nl-section-sub {
		font-size: 10px;
		font-weight: 500;
		color: #6b7280;
		text-transform: none;
		letter-spacing: 0;
	}

	.nl-areas {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.nl-area-card {
		padding: 8px 10px 10px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #ffffff;
	}
	.nl-area-card--focus {
		border-color: rgba(0, 179, 176, 0.55);
		background: linear-gradient(
			135deg,
			rgba(0, 179, 176, 0.06),
			rgba(3, 141, 143, 0.04)
		);
		box-shadow: 0 1px 4px rgba(0, 179, 176, 0.14);
	}

	.smart-nl-area-top {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: Arial, sans-serif;
		font-size: 12px;
	}
	.smart-nl-area-name {
		flex: 1;
		font-weight: 800;
		color: #111827;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.smart-nl-area-score {
		font-weight: 900;
		font-size: 13px;
		letter-spacing: -0.01em;
	}

	.smart-nl-area-track {
		position: relative;
		margin: 6px 0 8px;
		height: 4px;
		background: #f3f4f6;
		border-radius: 999px;
	}
	.smart-nl-area-zero {
		position: absolute;
		left: 50%;
		top: -2px;
		bottom: -2px;
		width: 1px;
		background: #9ca3af;
	}
	.smart-nl-area-marker {
		position: absolute;
		top: 50%;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		border: 2px solid #ffffff;
		box-shadow: 0 0 0 1px #111827;
	}

	.nl-focus-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: Arial, sans-serif;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 700;
		color: #00807e;
		background: rgba(0, 179, 176, 0.12);
		padding: 2px 6px;
		border-radius: 999px;
	}

	.nl-sub-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid #e5e7eb;
	}
	.nl-sub-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 4px 0;
		border-bottom: 1px dashed #f1f5f9;
		font-family: Arial, sans-serif;
	}
	.nl-sub-row:last-child {
		border-bottom: none;
	}
	.nl-sub-row--focus {
		background: rgba(0, 179, 176, 0.05);
		border-radius: 6px;
		padding: 4px 8px;
		margin: 0 -8px;
	}
	.nl-sub-name {
		font-size: 11.5px;
		color: #374151;
		line-height: 1.35;
		font-weight: 600;
	}
	.nl-sub-meta {
		font-size: 10px;
		color: #9ca3af;
		font-weight: 500;
		margin-left: 4px;
	}
	.nl-sub-score {
		font-size: 11.5px;
		font-weight: 800;
		flex-shrink: 0;
		letter-spacing: -0.01em;
	}
	.nl-sub-score--empty {
		color: #9ca3af;
		font-weight: 500;
	}

	.nutrition-footnote {
		font-family: Arial, sans-serif;
		font-size: 10px;
		line-height: 1.4;
		color: #374151;
	}

	.nl-pdf-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 999px;
		background: #111827;
		color: #ffffff;
		font-size: 12px;
		font-weight: 700;
		border: 1.5px solid #111827;
		cursor: pointer;
		transition: background 150ms;
		font-family: inherit;
	}
	.nl-pdf-btn:hover:not(:disabled) {
		background: #1f2937;
		border-color: #1f2937;
	}
	.nl-pdf-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	/* ───── Right: tips column ───── */
	.nl-tips-head {
		padding: 20px 20px 12px;
		border-bottom: 1px solid #e5e7eb;
	}
	.nl-tips-title {
		font-family:
			'Source Serif Pro', 'Source Serif 4', Georgia, serif;
		font-size: 18px;
		font-weight: 600;
		color: #0f172a;
		margin: 0 0 4px;
		letter-spacing: -0.01em;
	}
	.nl-tips-sub {
		font-size: 12px;
		line-height: 1.5;
		color: #6b7280;
		margin: 0;
	}
	.nl-tips-sub em {
		font-style: normal;
		color: #00807e;
		font-weight: 500;
	}

	.nl-tips-body {
		flex: 1;
		overflow-y: auto;
		padding: 14px 18px 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.nl-tip-card {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 12px 14px;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}
	.nl-tip-area {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		font-weight: 700;
		color: #b45309;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 6px;
	}
	.nl-tip-area i {
		color: #d97706;
	}
	.nl-tip-body {
		font-size: 13px;
		line-height: 1.5;
		color: #1f2937;
		margin: 0;
	}

	.nl-tips-loading {
		display: flex;
		align-items: center;
		gap: 10px;
		color: #6b7280;
		font-size: 13px;
		padding: 6px 2px;
	}
	.nl-tips-empty,
	.nl-tips-note {
		font-size: 12px;
		color: #6b7280;
		line-height: 1.5;
		margin: 0;
		padding: 6px 2px;
	}
	.nl-tips-note {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		color: #9ca3af;
		font-style: italic;
	}

	/* ───── Composer overlay ───── */
	.nl-composer {
		position: absolute;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(
			120% 80% at 50% 0%,
			#142036 0%,
			#0b1224 60%,
			#070b16 100%
		);
		animation: nlComposerIn 0.28s ease-out;
	}
	@keyframes nlComposerIn {
		from {
			opacity: 0;
			transform: scale(0.99);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	.nl-composer-close {
		position: absolute;
		top: 18px;
		right: 22px;
		width: 36px;
		height: 36px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
		color: #f9fafb;
		border-radius: 999px;
		cursor: pointer;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms;
	}
	.nl-composer-close:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.nl-composer-inner {
		width: 100%;
		max-width: 640px;
		padding: 0 24px;
		text-align: center;
		animation: nlComposerInnerIn 0.36s 0.05s ease-out both;
	}
	@keyframes nlComposerInnerIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.nl-composer-title {
		font-family: 'Source Serif Pro', 'Source Serif 4', Georgia, serif;
		font-size: clamp(1.5rem, 2.4vw, 2rem);
		font-weight: 550;
		color: #f9fafb;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.nl-composer-sub {
		font-size: 14px;
		line-height: 1.55;
		color: #cbd5e1;
		max-width: 480px;
		margin: 0 auto 22px;
	}
	.nl-composer-box {
		position: relative;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		padding: 14px 60px 14px 18px;
		transition:
			border-color 150ms,
			box-shadow 150ms;
	}
	.nl-composer-box:focus-within {
		border-color: rgba(0, 212, 209, 0.6);
		box-shadow: 0 0 0 4px rgba(0, 179, 176, 0.18);
	}
	.nl-composer-textarea {
		width: 100%;
		min-height: 78px;
		max-height: 200px;
		resize: none;
		background: transparent;
		border: none;
		outline: none;
		color: #f9fafb;
		font-size: 15px;
		line-height: 1.5;
		font-family: inherit;
		caret-color: #00d4d1;
	}
	.nl-composer-textarea::placeholder {
		color: #64748b;
	}
	.nl-composer-submit {
		position: absolute;
		right: 12px;
		bottom: 12px;
		width: 38px;
		height: 38px;
		border-radius: 999px;
		border: none;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #ffffff;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 12px -4px rgba(0, 179, 176, 0.5);
		transition:
			transform 150ms,
			box-shadow 150ms,
			opacity 150ms;
	}
	.nl-composer-submit:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px -4px rgba(0, 179, 176, 0.6);
	}
	.nl-composer-submit:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.nl-composer-hint {
		margin-top: 14px;
		font-size: 12px;
		color: #94a3b8;
	}
	.nl-composer-hint kbd {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 11px;
		padding: 1px 6px;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e5e7eb;
		margin: 0 2px;
	}

	@media (max-width: 900px) {
		.nl-left,
		.nl-right {
			display: none;
		}
		.nl-center {
			padding: 18px;
		}
	}
</style>
