<script lang="ts">
	import { tick } from 'svelte';
	import { appState, setFilters } from '$lib/store.svelte';
	import { getModelName } from '$lib/utils';
	import Leaderboard from '../organisms/Leaderboard.svelte';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';
	import { scoreToLetterGrade, letterGradeRange } from '$lib/scores';

	interface Props {
		onModelSelect?: (modelId: string) => void;
		onCatSelect?: (catId: string, modelId: string) => void;
		loading?: boolean;
	}

	let { onModelSelect, onCatSelect, loading = false }: Props = $props();

	// Selected model context (driven by Leaderboard via setFilters)
	const currentModelId = $derived(appState.filters.model);
	const currentModelName = $derived(getModelName(appState, currentModelId));

	type NutritionCategory = { id: string; label: string; score: number };

	type LabelData = {
		harmful: NutritionCategory[];
		positive: NutritionCategory[];
		overall: number;
		worstAreas: { name: string; score: number }[];
	};

	function buildLabelData(modelId: string): LabelData | null {
		const cats = appState.nutritionScore;
		if (!cats.length) return null;
		const age = appState.filters.age;

		const scored: NutritionCategory[] = cats
			.map((c) => ({ id: c.id, label: c.label, score: c.models[modelId]?.[age] ?? NaN }))
			.filter((c) => !isNaN(c.score));

		if (!scored.length) return null;

		const harmful = scored.filter((c) => c.label.startsWith('Avoids'));
		const positive = scored.filter((c) => c.label.startsWith('Promotes'));

		// Overall = average of the 9 nutritional-label category scores, for every
		// model — not the full taxonomy average, so partial-coverage models
		// (nutritional-label-only) rank on the same basis as full-coverage ones.
		const overall = scored.reduce((s, c) => s + c.score, 0) / scored.length;

		const worst = [...scored]
			.sort((a, b) => a.score - b.score)
			.slice(0, 3)
			.map((c) => ({ name: c.label, score: c.score }));

		return { harmful, positive, overall, worstAreas: worst };
	}

	// Carousel: all models with nutrition scores, sorted by overall impact (descending)
	type Card = {
		id: string;
		name: string;
		provider: string;
		data: LabelData;
	};
	const carouselCards = $derived.by<Card[]>(() => {
		if (!appState.nutritionScore.length) return [];
		const cards: Card[] = [];
		for (const m of appState.models) {
			const d = buildLabelData(m.id);
			if (!d) continue;
			cards.push({ id: m.id, name: m.name, provider: m.provider ?? '', data: d });
		}
		cards.sort((a, b) => b.data.overall - a.data.overall);
		return cards;
	});

	let focusIndex = $state(0);
	let carouselDrivenModel = $state('');

	// Only sync focusIndex when model was changed externally (e.g. Leaderboard)
	$effect(() => {
		const id = currentModelId;
		if (id === carouselDrivenModel) return;
		const idx = carouselCards.findIndex((c) => c.id === id);
		if (idx >= 0) focusIndex = idx;
	});

	function gotoCard(idx: number) {
		const cards = carouselCards;
		if (cards.length === 0) return;
		const clamped = ((idx % cards.length) + cards.length) % cards.length;
		const target = cards[clamped];
		if (!target) return;
		focusIndex = clamped;
		carouselDrivenModel = target.id;
		setFilters({ ...appState.filters, model: target.id });
		onModelSelect?.(target.id);
	}
	function nextCard() {
		gotoCard(focusIndex + 1);
	}
	function prevCard() {
		gotoCard(focusIndex - 1);
	}

	// ───── Compare selection ─────
	let selectedIds = $state<string[]>([]);
	let compareMode = $state(false);

	// ───── Grade legend modal ─────
	let showLegendModal = $state(false);

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

	const selectedCards = $derived.by<Card[]>(() => {
		const byId = new Map(carouselCards.map((c) => [c.id, c]));
		return selectedIds.map((id) => byId.get(id)).filter((c): c is Card => Boolean(c));
	});

	// ───── PDF export of the center label ─────
	let saving = $state(false);
	let pdfMode = $state(false);
	let labelEl: HTMLElement | undefined = $state();
	const cardRefs: Record<string, HTMLElement | undefined> = $state({});
	$effect(() => {
		const cards = carouselCards;
		const focused = cards[focusIndex];
		labelEl = focused ? cardRefs[focused.id] : undefined;
	});
	async function savePdf() {
		if (!labelEl) return;
		saving = true;
		pdfMode = true;
		await tick();
		try {
			const canvas = await html2canvas(labelEl, {
				scale: 2,
				backgroundColor: '#ffffff',
				useCORS: true
			});
			const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			pdf.setProperties({ title: 'Nutrition Label' });
			const pw = pdf.internal.pageSize.getWidth();
			const ph = pdf.internal.pageSize.getHeight();
			const margin = 28;
			const ratio = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height);
			const w = canvas.width * ratio;
			const h = canvas.height * ratio;
			const originX = (pw - w) / 2;
			const originY = (ph - h) / 2;
			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', originX, originY, w, h);
			// Overlay clickable link annotations on top of the rasterized image
			const labelRect = labelEl.getBoundingClientRect();
			const ptPerDom = w / labelRect.width;
			const anchors = labelEl.querySelectorAll<HTMLAnchorElement>('a[href]');
			for (const a of anchors) {
				const r = a.getBoundingClientRect();
				pdf.link(
					originX + (r.left - labelRect.left) * ptPerDom,
					originY + (r.top - labelRect.top) * ptPerDom,
					r.width * ptPerDom,
					r.height * ptPerDom,
					{ url: a.href }
				);
			}
			const slug = currentModelName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
			pdf.save(`${slug}-nutrition-label.pdf`);
		} finally {
			pdfMode = false;
			saving = false;
		}
	}

	function handleLocalModelSelect(id: string) {
		setFilters({ ...appState.filters, model: id });
		onModelSelect?.(id);
	}

	// Helpers
	function fmtScore(s: number): string {
		return s.toFixed(2);
	}
	function scoreColor(s: number): string {
		if (!Number.isFinite(s)) return '#6b7280';
		if (s >= 0.85) return '#16a34a'; // A / A+
		if (s >= 0.7) return '#65a30d'; // B / B+
		if (s >= 0.55) return '#d97706'; // C / C+
		if (s >= 0.4) return '#ea580c'; // D
		return '#dc2626'; // F
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

	<!-- LEFT: Leaderboard (same as Explore, but lists every model with
	     nutrition-label data — not just full-taxonomy ones) -->
	<aside class="nl-left">
		<Leaderboard onModelSelect={handleLocalModelSelect} surface="all" />
	</aside>

	<!-- CENTER: Nutritional Label carousel or compare view -->
	<div class="nl-center">
		{#if appState.loading || carouselCards.length === 0}
			<div class="nl-center-loading">
				<div class="nl-spinner" aria-hidden="true"></div>
				<p>Loading taxonomy…</p>
			</div>
		{:else if compareMode}
			{@const sel = selectedCards}
			{@const refCard = sel[0]}
			<div class="nl-compare">
				<header class="nl-compare-head">
					<button class="nl-compare-back" onclick={closeCompare}>
						<i class="fa-solid fa-arrow-left"></i>
						Back to labels
					</button>
					<h1 class="nl-compare-title">Compare {sel.length} models</h1>
				</header>

				<div class="nl-compare-scroll">
					<table class="nl-compare-table">
						<thead>
							<tr>
								<th class="nl-compare-row-label">Trait</th>
								{#each sel as card (card.id)}
									<th class="nl-compare-col-head">
										<div class="nl-compare-col-name">{card.name}</div>
										<div class="nl-compare-col-provider">{card.provider}</div>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<tr class="nl-compare-area-row">
								<td class="nl-compare-row-label nl-compare-area-label">Avoiding Negative Impact</td>
								{#each sel as card (card.id + ':harm-header')}
									<td class="nl-compare-cell"></td>
								{/each}
							</tr>
							{#each refCard.data.harmful as cat (cat.id)}
								<tr class="nl-compare-sub-row">
									<td class="nl-compare-row-label nl-compare-sub-label">{cat.label}</td>
									{#each sel as card (card.id + ':' + cat.id)}
										{@const s =
											card.data.harmful.find((c: NutritionCategory) => c.id === cat.id)?.score ??
											NaN}
										<td class="nl-compare-cell">
											<span
												class="nl-compare-score nl-compare-score--sm"
												style="color:{scoreColor(s)}">{isNaN(s) ? '—' : scoreToLetterGrade(s)}</span
											>
										</td>
									{/each}
								</tr>
							{/each}

							<tr class="nl-compare-area-row">
								<td class="nl-compare-row-label nl-compare-area-label">Promoting Positive Impact</td
								>
								{#each sel as card (card.id + ':pos-header')}
									<td class="nl-compare-cell"></td>
								{/each}
							</tr>
							{#each refCard.data.positive as cat (cat.id)}
								<tr class="nl-compare-sub-row">
									<td class="nl-compare-row-label nl-compare-sub-label">{cat.label}</td>
									{#each sel as card (card.id + ':' + cat.id)}
										{@const s =
											card.data.positive.find((c: NutritionCategory) => c.id === cat.id)?.score ??
											NaN}
										<td class="nl-compare-cell">
											<span
												class="nl-compare-score nl-compare-score--sm"
												style="color:{scoreColor(s)}">{isNaN(s) ? '—' : scoreToLetterGrade(s)}</span
											>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			{@const cards = carouselCards}
			{@const fIdx = focusIndex}
			{@const focusedCard = cards[fIdx]}

			{#if !isLoading}
				<button
					class="nl-pdf-btn nl-pdf-btn--corner"
					disabled={saving}
					onclick={savePdf}
					title="Save current label as PDF"
				>
					<i class="fa-solid fa-file-pdf"></i>
					{saving ? 'Saving…' : 'Save PDF'}
				</button>
			{/if}

			{#if !isLoading && focusedCard}
				<div class="nl-corner-actions">
					<button
						type="button"
						class="nl-legend-btn"
						onclick={() => (showLegendModal = true)}
						title="How to interpret the AI Nutrition Label"
					>
						<i class="fa-regular fa-circle-question" aria-hidden="true"></i>
						<span>How to interpret</span>
					</button>
					<label
						class="nl-select-checkbox"
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
				</div>
			{/if}

			<div class="nl-carousel-wrap">
				{#if !isLoading}
					<button
						class="nl-nav nl-nav--prev"
						onclick={prevCard}
						aria-label="Previous model"
						disabled={cards.length < 2}
					>
						<i class="fa-solid fa-chevron-left"></i>
					</button>
				{/if}

				<div class="nl-carousel" role="region" aria-label="Model nutrition labels">
					{#each cards as card, i (card.id)}
						{@const offset = i - fIdx}
						{@const abs = Math.abs(offset)}
						{@const hidden = abs > 2}
						{@const ld = card.data}
						{@const overallPct = Math.max(0, Math.min(100, ld.overall * 100))}
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
								class:nutrition-label--pdf={pdfMode}
								bind:this={cardRefs[card.id]}
							>
								<div class="nutrition-headline">AI Nutrition Label</div>

								<div class="nutrition-model-block">
									<div class="nutrition-model-name">{card.name}</div>
									<div class="smart-nl-provider">{card.provider}</div>
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="nutrition-score-row">
									<div class="nutrition-score-label">Overall Impact</div>
									<div class="nutrition-score-value">
										<span class="nutrition-grade-wrap">
											{#if !pdfMode}
												<button
													type="button"
													class="nutrition-info-btn"
													aria-label="How this grade was calculated"
													aria-describedby={`nl-overall-tt-${card.id}`}
												>
													<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
												</button>
											{/if}
											<span class="nutrition-grade-value" style="color:{scoreColor(ld.overall)}">
												{scoreToLetterGrade(ld.overall)}
											</span>
										</span>
										<span class="nutrition-score-numeric">{fmtScore(ld.overall)}</span>
									</div>
								</div>
								{#if !pdfMode}
									{@const range = letterGradeRange(ld.overall)}
									{#if range}
										<span class="nutrition-grade-tt" id={`nl-overall-tt-${card.id}`} role="tooltip">
											This model was graded a
											<span class="nutrition-grade-tt-strong" style="color:{scoreColor(ld.overall)}"
												>{scoreToLetterGrade(ld.overall)}</span
											>
											because it returned an average of
											<span class="nutrition-grade-tt-strong"
												>{range.lower.toFixed(2)}&ndash;{range.upper.toFixed(2)}</span
											>
											on the following metric categories.
										</span>
									{/if}
								{/if}
								<div class="smart-nl-overall-track" aria-hidden="true">
									<div
										class="smart-nl-overall-marker"
										style="left:{overallPct}%;background:{scoreColor(ld.overall)}"
									></div>
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="nl-trait-block">
									<div class="nl-trait-heading">Avoiding Negative Impact</div>
									<div class="nl-trait-rule"></div>
									{#each ld.harmful as cat (cat.id)}
										<button
											class="nl-trait-row nl-trait-row--btn"
											onclick={() => onCatSelect?.(cat.id, card.id)}
										>
											<span class="nl-trait-name">{cat.label}</span>
											<span class="nl-trait-row-right">
												<span class="nl-trait-grade" style="color:{scoreColor(cat.score)}"
													>{scoreToLetterGrade(cat.score)}</span
												>
												<i class="fa-solid fa-chevron-right nl-trait-chevron"></i>
											</span>
										</button>
									{/each}
								</div>

								<div class="nutrition-thick-rule"></div>

								<div class="nl-trait-block">
									<div class="nl-trait-heading">Promoting Positive Impact</div>
									<div class="nl-trait-rule"></div>
									{#each ld.positive as cat (cat.id)}
										<button
											class="nl-trait-row nl-trait-row--btn"
											onclick={() => onCatSelect?.(cat.id, card.id)}
										>
											<span class="nl-trait-name">{cat.label}</span>
											<span class="nl-trait-row-right">
												<span class="nl-trait-grade" style="color:{scoreColor(cat.score)}"
													>{scoreToLetterGrade(cat.score)}</span
												>
												<i class="fa-solid fa-chevron-right nl-trait-chevron"></i>
											</span>
										</button>
									{/each}
								</div>

								{#if pdfMode}
									<div class="nl-grade-legend">
										<div class="nl-grade-legend-heading">How grades were compiled</div>
										<ul class="nl-grade-legend-list">
											<li><span style="color:#16a34a">A+</span> 0.95&ndash;1.00</li>
											<li><span style="color:#16a34a">A</span> 0.90&ndash;0.95</li>
											<li><span style="color:#16a34a">A&minus;</span> 0.85&ndash;0.90</li>
											<li><span style="color:#16a34a">B+</span> 0.80&ndash;0.85</li>
											<li><span style="color:#16a34a">B</span> 0.75&ndash;0.80</li>
											<li><span style="color:#d97706">B&minus;</span> 0.70&ndash;0.75</li>
											<li><span style="color:#d97706">C+</span> 0.65&ndash;0.70</li>
											<li><span style="color:#d97706">C</span> 0.60&ndash;0.65</li>
											<li><span style="color:#d97706">C&minus;</span> 0.55&ndash;0.60</li>
											<li><span style="color:#6b7280">D+</span> 0.50&ndash;0.55</li>
											<li><span style="color:#6b7280">D</span> 0.45&ndash;0.50</li>
											<li><span style="color:#dc2626">D&minus;</span> 0.40&ndash;0.45</li>
											<li><span style="color:#dc2626">F</span> below 0.40</li>
										</ul>
									</div>
								{/if}

								<div class="nl-source-footer">
									<p>
										This label is part of the Open Benchmark of AI Impact on Humans (ImpactBench)
										led by researchers at the MIT Media Lab, USC Marshall Neely Center, The
										Psychology of Technology Institute, and UC Berkeley.
									</p>
									{#if pdfMode}
										<p class="nl-source-footer-link">
											To learn more, visit
											<a href="https://impactbench.media.mit.edu">impactbench.media.mit.edu</a>
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>

				{#if !isLoading}
					<button
						class="nl-nav nl-nav--next"
						onclick={nextCard}
						aria-label="Next model"
						disabled={cards.length < 2}
					>
						<i class="fa-solid fa-chevron-right"></i>
					</button>
				{/if}
			</div>

			<!-- Bottom strip: selected thumbnails + Compare button (only when something selected) -->
			{#if !isLoading && selectedIds.length > 0}
				<div class="nl-strip">
					<div class="nl-strip-thumbs" role="list" aria-label="Selected for comparison">
						{#each selectedCards as card (card.id)}
							<div class="nl-thumb" role="listitem">
								<button
									class="nl-thumb-main"
									onclick={() => {
										if (card.id !== focusedCard?.id) {
											const idx = carouselCards.findIndex((c) => c.id === card.id);
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
							title={selectedIds.length < 2
								? 'Select at least 2 models'
								: 'Compare selected models'}
						>
							<i class="fa-solid fa-table-columns"></i>
							Compare ({selectedIds.length})
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

{#if showLegendModal}
	<div
		class="nl-legend-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="nl-legend-title"
		onclick={() => (showLegendModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showLegendModal = false)}
		tabindex="-1"
	>
		<div
			class="nl-legend-modal"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			tabindex="-1"
		>
			<button
				type="button"
				class="nl-legend-close"
				aria-label="Close"
				onclick={() => (showLegendModal = false)}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
			<h2 id="nl-legend-title" class="nl-legend-title">How to interpret the AI Nutrition Label</h2>
			<p class="nl-legend-lede">
				Each label summarizes how a model behaves across various metrics, grouped into categories
				like <em>&ldquo;Avoids Factual Hallucination&rdquo;</em>. The letter grade you see next to
				it is a composite. For individual metric performance, click on the category to learn more.
			</p>

			<div class="nl-legend-section">
				<ul class="nl-legend-scale">
					<li>
						<span class="nl-legend-grade" style="color:#16a34a">A+</span>
						<span class="nl-legend-range">0.95&ndash;1.00</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#16a34a">A</span>
						<span class="nl-legend-range">0.90&ndash;0.95</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#16a34a">A&minus;</span>
						<span class="nl-legend-range">0.85&ndash;0.90</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#16a34a">B+</span>
						<span class="nl-legend-range">0.80&ndash;0.85</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#16a34a">B</span>
						<span class="nl-legend-range">0.75&ndash;0.80</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#d97706">B&minus;</span>
						<span class="nl-legend-range">0.70&ndash;0.75</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#d97706">C+</span>
						<span class="nl-legend-range">0.65&ndash;0.70</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#d97706">C</span>
						<span class="nl-legend-range">0.60&ndash;0.65</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#d97706">C&minus;</span>
						<span class="nl-legend-range">0.55&ndash;0.60</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#6b7280">D+</span>
						<span class="nl-legend-range">0.50&ndash;0.55</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#6b7280">D</span>
						<span class="nl-legend-range">0.45&ndash;0.50</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#dc2626">D&minus;</span>
						<span class="nl-legend-range">0.40&ndash;0.45</span>
					</li>
					<li>
						<span class="nl-legend-grade" style="color:#dc2626">F</span>
						<span class="nl-legend-range">below 0.40</span>
					</li>
				</ul>
			</div>

			<p class="nl-legend-footnote">
				To explore more metrics and scenarios, check out the
				<a href="/explore" class="nl-legend-link" onclick={() => (showLegendModal = false)}
					>Explore</a
				> tab.
			</p>
		</div>
	</div>
{/if}

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
		height: 680px;
		max-width: 520px;
		perspective: 1400px;
	}

	.nl-carousel-card {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 100%;
		max-width: 440px;
		transform-origin: center center;
		transform: translate(calc(-50% + var(--offset) * 70px), -50%) rotate(calc(var(--offset) * 5deg))
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
		overflow: visible;
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
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
		color: #374151;
		box-shadow: 0 4px 12px -8px rgba(15, 23, 42, 0.18);
		transition: all 150ms ease;
	}
	.nl-corner-actions {
		position: absolute;
		top: 16px;
		right: 16px;
		z-index: 250;
		display: flex;
		align-items: center;
		gap: 8px;
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

	.nl-thumb {
		flex-shrink: 0;
		display: inline-flex;
		align-items: stretch;
		background: #ffffff;
		border: 1.5px solid #000000;
		border-radius: 8px;
		overflow: hidden;
		font-family: 'Arial Black', Arial, sans-serif;
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
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
		padding: 8px 16px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
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
		padding: 8px 18px;
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
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
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}
	.nl-compare,
	.nl-compare * {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
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
		font-family: 'Arial Black', Arial, sans-serif;
		font-weight: 900;
		font-size: 13px;
		letter-spacing: -0.01em;
		color: #111827;
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
	.nl-compare-area-row {
		background: #fafafa;
	}
	.nl-compare-area-row .nl-compare-row-label {
		background: #fafafa;
	}
	.nl-compare-area-label {
		font-family: 'Arial Black', Arial, sans-serif;
		font-size: 13px;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #111827;
		padding-top: 12px;
		padding-bottom: 12px;
	}
	.nl-compare-sub-row .nl-compare-row-label {
		padding-left: 24px;
		font-family: 'Arial Black', Arial, sans-serif;
		font-weight: 900;
		font-size: 13px;
		color: #111827;
	}
	.nl-compare-sub-label {
		font-weight: 900;
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

	/* ───── Nutrition label card (compact, matches SmartNutritionLabel style) ───── */
	.nutrition-label {
		position: relative;
		background: #ffffff;
		border: 3px solid #000000;
		color: #111111;
		font-family: 'Arial Black', Arial, sans-serif;
		padding: 8px 11px 10px;
	}

	.nutrition-headline {
		font-size: 32px;
		line-height: 0.9;
		font-weight: 900;
		letter-spacing: -0.03em;
	}

	.nutrition-model-block {
		margin-top: 28px;
	}
	.nutrition-model-name {
		font-size: 20px;
		font-weight: 900;
		line-height: 1.02;
		letter-spacing: -0.02em;
	}
	.smart-nl-provider {
		font-family: Arial, sans-serif;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #111827;
		margin-top: 3px;
	}

	.nutrition-thick-rule {
		height: 5px;
		background: #000000;
		margin: 5px 0;
	}

	.nutrition-score-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}
	.nutrition-score-label {
		font-family: 'Arial Black', Arial, sans-serif;
		font-size: 13px;
		line-height: 1.15;
		font-weight: 900;
		letter-spacing: -0.01em;
		color: #111827;
	}
	.nutrition-score-value {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 3px;
	}
	.nutrition-grade-value {
		font-size: 28px;
		line-height: 0.9;
		font-weight: 900;
		letter-spacing: -0.02em;
	}
	.nutrition-grade-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.nutrition-info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		color: #cbd5e1;
		font-size: 14px;
		line-height: 1;
		cursor: help;
		transition: color 120ms ease;
	}
	.nutrition-info-btn:hover,
	.nutrition-info-btn:focus-visible {
		color: #6b7280;
		outline: none;
	}
	.nutrition-grade-tt {
		position: absolute;
		top: 88px;
		left: calc(100% + 16px);
		z-index: 500;
		width: 240px;
		padding: 10px 12px;
		border-radius: 12px;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		box-shadow:
			0 10px 24px -12px rgba(15, 23, 42, 0.25),
			0 4px 10px -6px rgba(15, 23, 42, 0.15);
		font-family: Arial, sans-serif;
		font-size: 11.5px;
		line-height: 1.45;
		font-weight: 400;
		letter-spacing: 0;
		color: #4b5563;
		text-align: left;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 120ms ease,
			transform 120ms ease;
		transform: translateX(-4px);
	}
	.nutrition-label:has(.nutrition-info-btn:hover) .nutrition-grade-tt,
	.nutrition-label:has(.nutrition-info-btn:focus-visible) .nutrition-grade-tt {
		opacity: 1;
		transform: translateX(0);
	}
	.nutrition-grade-tt-strong {
		font-weight: 700;
		color: #111827;
	}
	.nutrition-score-numeric {
		font-size: 12px;
		line-height: 1;
		font-weight: 500;
		letter-spacing: 0;
		color: #6b7280;
	}

	.smart-nl-overall-track {
		position: relative;
		height: 5px;
		border-radius: 999px;
		background: #e5e7eb;
		margin: 5px 0 1px;
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

	/* ───── Hardcoded trait sections (FDA-style nutrition rows) ───── */
	.nl-trait-block {
		display: flex;
		flex-direction: column;
	}
	.nl-trait-heading {
		font-family: Arial, sans-serif;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #111827;
		text-align: right;
		margin: 1px 0 3px;
	}
	.nl-trait-rule {
		height: 1px;
		background: #000000;
		margin-bottom: 2px;
	}
	.nl-trait-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding: 5px 0 4px;
		border-bottom: 1px solid #000000;
	}
	.nl-trait-row:last-child,
	.nl-trait-row--btn:last-child {
		border-bottom: none;
	}
	.nl-trait-name {
		font-family: 'Arial Black', Arial, sans-serif;
		font-weight: 900;
		font-size: 13px;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: #111827;
		flex: 1;
	}
	.nl-trait-grade {
		font-family: 'Arial Black', Arial, sans-serif;
		font-weight: 900;
		font-size: 14px;
		letter-spacing: -0.01em;
		flex-shrink: 0;
	}
	.nl-trait-row--btn {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-bottom: 1px solid #000000;
		cursor: pointer;
		padding: 5px 0 4px;
	}
	.nl-trait-row--btn:last-child {
		border-bottom: none;
	}
	.nl-trait-row-right {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}
	.nl-trait-chevron {
		font-size: 8px;
		color: #9ca3af;
	}

	.nl-source-footer {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid #d1d5db;
		font-family: Arial, sans-serif;
		font-size: 11px;
		line-height: 1.35;
		color: #4b5563;
	}
	.nl-source-footer p {
		margin: 0;
	}
	.nl-source-footer p + p {
		margin-top: 4px;
	}
	.nl-source-footer-link a {
		color: #0f766e;
		text-decoration: underline;
	}

	/* Grade legend + spacing tweaks that only apply in the exported PDF */
	.nutrition-label--pdf .nl-trait-row,
	.nutrition-label--pdf .nl-trait-row--btn {
		padding-top: 7px;
		padding-bottom: 6px;
	}
	.nutrition-label--pdf .nl-trait-name {
		line-height: 1.35;
	}
	.nutrition-label--pdf .nutrition-grade-value {
		transform: translateY(-3px);
	}
	.nutrition-label--pdf .nl-trait-heading {
		margin-top: -2px;
	}
	.nl-grade-legend {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid #d1d5db;
		font-family: Arial, sans-serif;
		color: #374151;
	}
	.nl-grade-legend-heading {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		margin-bottom: 5px;
	}
	.nl-grade-legend-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px 10px;
		font-size: 9.5px;
		line-height: 1.25;
	}
	.nl-grade-legend-list li {
		display: flex;
		align-items: baseline;
		gap: 5px;
	}
	.nl-grade-legend-list li span {
		font-family: 'Arial Black', Arial, sans-serif;
		font-weight: 900;
		min-width: 18px;
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

	/* ───── Composer overlay ───── */
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
	@media (max-width: 1200px) {
		.nl-left {
			display: none;
		}
		.nl-center {
			padding: 18px;
		}
	}

	/* ───── Legend / "How to interpret" button ───── */
	.nl-legend-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #ffffff;
		border: 1px solid #e5e7eb;
		padding: 7px 14px 7px 10px;
		border-radius: 999px;
		cursor: pointer;
		font-family: inherit;
		font-size: 12px;
		font-weight: 700;
		color: #374151;
		box-shadow: 0 4px 12px -8px rgba(15, 23, 42, 0.18);
		transition: all 150ms ease;
	}
	.nl-legend-btn i {
		font-size: 12px;
		color: #6b7280;
	}
	.nl-legend-btn:hover {
		background: #f9fafb;
		color: #111827;
	}
	.nl-legend-btn:hover i {
		color: #111827;
	}

	/* ───── Legend modal ───── */
	.nl-legend-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		animation: nlLegendFade 160ms ease-out;
	}
	@keyframes nlLegendFade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.nl-legend-modal {
		position: relative;
		width: 100%;
		max-width: 520px;
		max-height: calc(100vh - 48px);
		overflow-y: auto;
		background: #ffffff;
		border-radius: 20px;
		padding: 28px 28px 24px;
		box-shadow:
			0 24px 60px -20px rgba(15, 23, 42, 0.35),
			0 10px 24px -12px rgba(15, 23, 42, 0.2);
		font-family: Arial, sans-serif;
		color: #1f2937;
	}
	.nl-legend-close {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 30px;
		height: 30px;
		border: none;
		background: transparent;
		border-radius: 50%;
		cursor: pointer;
		color: #6b7280;
		font-size: 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all 120ms ease;
	}
	.nl-legend-close:hover {
		background: #f3f4f6;
		color: #111827;
	}
	.nl-legend-title {
		margin: 0 32px 10px 0;
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: #0f172a;
	}
	.nl-legend-lede {
		margin: 0 0 18px;
		font-size: 13px;
		line-height: 1.55;
		color: #4b5563;
	}
	.nl-legend-lede em {
		font-style: italic;
		color: #374151;
	}
	.nl-legend-section {
		border-top: 1px solid #f3f4f6;
		padding-top: 14px;
		margin-bottom: 14px;
	}
	.nl-legend-scale {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 10px;
	}
	.nl-legend-scale li {
		display: grid;
		grid-template-columns: 40px 1fr;
		align-items: baseline;
		gap: 8px;
		padding: 6px 10px;
		background: #f9fafb;
		border-radius: 10px;
	}
	.nl-legend-grade {
		font-weight: 800;
		font-size: 14px;
		letter-spacing: -0.01em;
	}
	.nl-legend-range {
		font-size: 11px;
		color: #6b7280;
		font-variant-numeric: tabular-nums;
	}
	.nl-legend-footnote {
		margin: 4px 0 0;
		font-size: 12px;
		line-height: 1.55;
		color: #6b7280;
	}
	.nl-legend-link {
		color: #0f766e;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.nl-legend-link:hover {
		color: #115e59;
	}
</style>
