<script lang="ts">
	import { smartNutritionState } from '$lib/store.svelte';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	interface Props {
		onTabChange?: (tab: string) => void;
		onEditFocus?: () => void;
		onGenerate?: (text: string) => void;
		loading?: boolean;
	}

	let { onTabChange, onEditFocus, onGenerate, loading = false }: Props = $props();

	const CASPER_API = 'https://casper-production-7f8e.up.railway.app';

	const opts = $derived(smartNutritionState.opts);
	const activeIdx = $derived(smartNutritionState.activeModelIdx);
	const activeModel = $derived(opts?.topModels[activeIdx] ?? null);

	let saving = $state(false);
	let captureEl: HTMLElement | undefined = $state();

	// Tips cache keyed by `${modelName}::${userText}`.
	type Tip = { area: string; tip: string };
	let tipsCache = $state<Record<string, Tip[]>>({});
	let tipsLoading = $state(false);
	let tipsError = $state(false);

	const tipsKey = $derived(
		activeModel && opts ? `${activeModel.name}::${opts.userText ?? ''}` : ''
	);
	const tips = $derived<Tip[] | null>(tipsKey ? (tipsCache[tipsKey] ?? null) : null);

	// Fetch tips whenever active model + focus changes.
	$effect(() => {
		if (!activeModel || !opts) return;
		const key = `${activeModel.name}::${opts.userText ?? ''}`;
		if (tipsCache[key]) return;
		const worst = (activeModel.worstAreas ?? []).slice(0, 3);
		if (worst.length === 0) {
			tipsCache = { ...tipsCache, [key]: [] };
			return;
		}
		tipsLoading = true;
		tipsError = false;
		(async () => {
			try {
				const resp = await fetch(CASPER_API + '/tips', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						user_context: opts.userText ?? '',
						model_name: activeModel.name,
						model_provider: activeModel.provider,
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
								const obj = t as { area?: string; tip?: string };
								return { area: obj.area ?? worst[i].name, tip: obj.tip ?? '' };
							})
							.filter((t: Tip) => t.tip.length > 0)
					: [];
				tipsCache = { ...tipsCache, [key]: got };
			} catch (err) {
				console.warn('Tips API failed, using fallback:', err);
				const fallback: Tip[] = worst.map((w) => ({
					area: w.name,
					tip: makeFallbackTip(w.name, opts.userText ?? '')
				}));
				tipsCache = { ...tipsCache, [key]: fallback };
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

		// Area-aware patterns (kept short so tips feel specific, not boilerplate)
		let practitioner: string;
		let technical: string;

		if (/harm|harmful|dangerous|unsafe/.test(a)) {
			practitioner = `Don't ask this model for advice on "${areaName}" directly\u2014pose the question abstractly and have a qualified person review anything actionable before you use it.`;
			technical = `Add a refusal-classifier (or moderation API) on outputs for "${areaName}", and prepend a system prompt that explicitly enumerates the disallowed behaviors with concrete refusal examples.`;
		} else if (/depend|sycoph|emotional|attach/.test(a)) {
			practitioner = `Limit how often you turn to this model for "${areaName}"\u2014set a rule like "talk to a human first" and treat the model as a journaling aid, not a confidant.`;
			technical = `Cap turn count per session, inject periodic system messages reminding the user to seek human support, and log sentiment shifts to detect over-reliance patterns.`;
		} else if (/outsourc|overrelian|offload|autonomy|independ|cognit/.test(a)) {
			practitioner = `Before reading the model's answer on "${areaName}", write down your own attempt first\u2014then use the model only to compare and critique, not to replace your thinking.`;
			technical = `Wrap requests with a Socratic system prompt that returns guiding questions instead of finished answers, and gate "give me the solution" with an explicit user opt-in.`;
		} else if (/gambl|finance|invest|risk/.test(a)) {
			practitioner = `Treat anything the model says about "${areaName}" as entertainment, not advice\u2014always cross-check with a regulated professional before acting.`;
			technical = `Detect finance/gambling intent in the prompt and force a templated disclaimer + refusal-to-strategize wrapper around the model's response.`;
		} else if (/bias|stereo|fair|discrim/.test(a)) {
			practitioner = `When the model touches "${areaName}", ask it to list counter-examples or alternative perspectives, and compare its answer against a second source before sharing.`;
			technical = `Run outputs through a bias-evaluation prompt (or a small classifier) and rewrite or flag results that score above a threshold for "${areaName}".`;
		} else if (/privacy|leak|sensitive|personal/.test(a)) {
			practitioner = `Don't paste real names, contact info, or private details into prompts about "${areaName}"\u2014redact or use placeholders first.`;
			technical = `Apply PII scrubbing on both input and output, disable training/retention on the API, and audit logs for accidental disclosure of "${areaName}".`;
		} else if (/halluc|accura|factual|misinfo/.test(a)) {
			practitioner = `Never trust the model's claims about "${areaName}" without verifying against an authoritative source\u2014assume citations and statistics may be fabricated.`;
			technical = `Force retrieval-augmented grounding with citation-required prompts for "${areaName}", and reject responses whose claims fail a verifier check.`;
		} else {
			practitioner = `When the model's response touches on "${areaName}", slow down: re-read it critically, get a second opinion from a human you trust, and don't act on it the same day.`;
			technical = `Add an evaluation prompt specifically targeting "${areaName}" to your eval set, and gate production traffic behind a regression check on that metric.`;
		}

		return isTechnical ? technical : practitioner;
	}

	async function savePdf() {
		if (!captureEl || !opts || !activeModel) return;
		saving = true;
		try {
			const canvas = await html2canvas(captureEl, {
				scale: 2,
				backgroundColor: '#ffffff',
				useCORS: true
			});
			const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
			const pw = pdf.internal.pageSize.getWidth();
			const ph = pdf.internal.pageSize.getHeight();
			const margin = 24;
			const ratio = Math.min(
				(pw - margin * 2) / canvas.width,
				(ph - margin * 2) / canvas.height
			);
			const w = canvas.width * ratio;
			const h = canvas.height * ratio;
			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
			const slug = (activeModel.name ?? 'nutrition-label')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/, '');
			pdf.save(`${slug}.pdf`);
		} finally {
			saving = false;
		}
	}

	function fmtScore(s: number): string {
		return (s >= 0 ? '+' : '') + s.toFixed(2);
	}

	function scoreColor(s: number): string {
		if (s >= 0.75) return '#16a34a';
		if (s >= 0.55) return '#d97706';
		if (s >= 0.35) return '#ea580c';
		return '#dc2626';
	}

	const isLoading = $derived(loading);
	const hasData = $derived(!!opts && !!activeModel);

	let promptText = $state('');
	let composing = $state(false);
	let composerTextarea: HTMLTextAreaElement | undefined = $state();

	function openComposer() {
		composing = true;
		queueMicrotask(() => composerTextarea?.focus());
	}
	function closeComposer() {
		composing = false;
	}
	function submitPrompt() {
		const t = promptText.trim();
		if (!t || !onGenerate) return;
		composing = false;
		onGenerate(t);
	}
	function openFeedback() {
		if (typeof window !== 'undefined') window.location.hash = '#feedback';
		onTabChange?.('home');
	}
</script>

<div class="nl-page" class:nl-page--empty={!isLoading && !hasData}>
	{#if isLoading}
		<div class="nl-empty">
			<div class="nl-empty-inner">
				<div class="nl-spinner" aria-hidden="true"></div>
				<h2 class="nl-empty-title">Generating AI nutritional label…</h2>
				<p class="nl-empty-desc">
					Analyzing your focus area, ranking models, and assembling the label. This usually takes a
					few seconds.
				</p>
			</div>
		</div>
	{:else if !hasData}
		<div class="nl-intro-split">
			<section class="nl-hero">
				<h1 class="nl-hero-title">Generate your<br />AI nutritional label</h1>
				<p class="nl-hero-sub">
					A simple way to gauge where an AI model excels at protecting your audience's wellbeing,
					and where the risks lie.
				</p>
				<button class="nl-cta-btn" onclick={openComposer}>
					<i class="fa-solid fa-wand-magic-sparkles"></i>
					Generate Nutritional Label
				</button>
			</section>

			<aside class="nl-explain-card">
				<div class="nl-explain-glow" aria-hidden="true"></div>
				<div class="nl-explain-inner">
					<figure class="nl-peek-figure">
						<img
							src="/impactbench10.png"
							alt="Example AI nutritional label"
						/>
					</figure>
					<h2 class="nl-explain-title">What are nutritional labels?</h2>
					<p class="nl-info-body">
						ImpactBench does more than rank models on a single leaderboard. It creates personalized
						AI nutritional labels that you can share with your stakeholders, teammates, and
						developers.
					</p>
					<p class="nl-info-body">
						With these nutritional labels, you can evaluate where your model might be excelling at
						specific areas in protecting your target audience, and where there might be potential
						risks if left unmitigated.
					</p>
					<p class="nl-info-body">
						You may <button type="button" class="nl-inline-link" onclick={openFeedback}>share feedback</button>
						on our nutritional labels here, or
						<button type="button" class="nl-inline-link" onclick={() => onTabChange?.('about')}>learn more about our methodology</button> here.
					</p>
				</div>
			</aside>
		</div>

		{#if composing}
			<div class="nl-composer" role="dialog" aria-modal="true">
				<button class="nl-composer-close" aria-label="Close" onclick={closeComposer}>
					<i class="fa-solid fa-xmark"></i>
				</button>
				<div class="nl-composer-inner">
					<h2 class="nl-composer-title">Describe your focus area</h2>
					<p class="nl-composer-sub">
						Tell us who you are and what behavior you care about. Press the arrow when you're
						ready.
					</p>
					<div class="nl-composer-box">
						<textarea
							bind:this={composerTextarea}
							class="nl-composer-textarea"
							placeholder="I'm a teacher concerned about how AI impacts cognitive skills in my students."
							bind:value={promptText}
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
							class="nl-composer-submit"
							aria-label="Generate nutritional label"
							disabled={!promptText.trim()}
							onclick={submitPrompt}
						>
							<i class="fa-solid fa-arrow-up"></i>
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<!-- LEFT: model cards sidebar -->
		<aside class="nl-sidebar">
			<div class="nl-sidebar-kicker">Top models on your focus</div>
			<div class="nl-sidebar-context">"{opts.userText || 'No context provided'}"</div>
			{#if onEditFocus}
				<button class="nl-sidebar-edit" onclick={onEditFocus}>
					<i class="fa-solid fa-pen-to-square"></i> Edit focus
				</button>
			{/if}
			<div class="nl-sidebar-divider"></div>
			<div class="nl-sidebar-cards">
				{#each opts.topModels as model, i (i)}
					{@const chipScore = model.flatScore ?? model.score}
					<button
						class="nl-model-card"
						class:active={activeIdx === i}
						onclick={() => (smartNutritionState.activeModelIdx = i)}
					>
						<div class="nl-model-rank">#{i + 1}</div>
						<div class="nl-model-name">{model.name}</div>
						<div class="nl-model-provider">{model.provider}</div>
						<div class="nl-model-score" style="color:{scoreColor(chipScore)}">
							{fmtScore(chipScore)}
						</div>
					</button>
				{/each}
			</div>
		</aside>

		<!-- RIGHT: nutrition label + tips -->
		<div class="nl-content">
			{#each [activeModel] as model (activeIdx)}
				{@const displayScore = model.flatScore ?? model.score}
				{@const overallPct = Math.max(0, Math.min(100, displayScore * 100))}
				<div class="nl-actions-bar">
					<button class="nl-save-btn" disabled={saving} onclick={savePdf}>
						<i class="fa-solid fa-file-pdf"></i>
						{saving ? 'Saving…' : 'Save PDF'}
					</button>
				</div>

				<div class="nl-grid" bind:this={captureEl}>
					<!-- Left: nutrition label (compact) -->
					<div class="nutrition-label">
						<div class="nutrition-headline">AI Nutrition Label</div>
						<div class="nutrition-subline">Smart Explore snapshot</div>

						<div class="nutrition-model-block">
							<div class="nutrition-model-kicker">Top model on your focus</div>
							<div class="nutrition-model-name">{model.name}</div>
							<div class="smart-nl-provider">{model.provider}</div>
						</div>

						<div class="nutrition-thick-rule"></div>

						<div class="nutrition-score-row">
							<div class="nutrition-score-label">Focus Area Score</div>
							<div class="nutrition-score-value" style="color:{scoreColor(displayScore)}">
								{fmtScore(displayScore)}
							</div>
						</div>
						<div class="smart-nl-overall-track" aria-hidden="true">
							<div class="smart-nl-overall-zero"></div>
							<div
								class="smart-nl-overall-marker"
								style="left:{overallPct}%;background:{scoreColor(displayScore)}"
							></div>
						</div>

						<div class="nutrition-thick-rule"></div>

						<div class="smart-nl-section-title">Performance on your focus areas</div>
						<div class="smart-nl-areas">
							{#each opts.constructs as c, i (i)}
								{@const score = model.constructScores[i] ?? 0}
								{@const pct = Math.max(4, Math.min(100, Math.round(score * 100)))}
								<div class="smart-nl-area">
									<div class="smart-nl-area-top">
										<span class="smart-nl-area-icon"
											><i class="fa-solid {c.icon ?? 'fa-bullseye'}"></i></span
										>
										<span class="smart-nl-area-name">{c.text}</span>
										<span class="smart-nl-area-score" style="color:{scoreColor(score)}"
											>{fmtScore(score)}</span
										>
									</div>
									<div class="smart-nl-area-track">
										<div
											class="smart-nl-area-fill"
											style="width:{pct}%;background:{scoreColor(score)}"
										></div>
									</div>
								</div>
							{/each}
						</div>

						<div class="nutrition-thick-rule"></div>

						<div class="smart-nl-section-title">
							Things to watch out for
							<span class="smart-nl-section-sub">Areas where the model may fall short</span>
						</div>
						<div class="smart-nl-warnings">
							{#each (model.worstAreas ?? []).slice(0, 3) as w (w.name)}
								<div class="smart-nl-warning">
									<div class="smart-nl-warning-head">
										<span class="smart-nl-warning-label">{w.name}</span>
										<span class="smart-nl-warning-score" style="color:{scoreColor(w.score)}"
											>{fmtScore(w.score)}</span
										>
									</div>
								</div>
							{/each}
						</div>

						<div class="nutrition-thick-rule"></div>
						<div class="nutrition-footnote">
							Generated from your context: "{opts.userText || '(no context provided)'}". Scores
							derive from scenario evaluations in this benchmark.
						</div>
					</div>

					<!-- Right: model-specific mitigation tips -->
					<aside class="nl-tips-col">
						<div class="nl-tips-card">
							<h3 class="nl-tips-title">How to use this model safely</h3>
							<p class="nl-tips-sub">
								Personalized mitigation tips for the model's three weakest areas, based on your
								context.
							</p>

							{#if tipsLoading && (!tips || tips.length === 0)}
								<div class="nl-tips-loading">
									<div class="nl-spinner small" aria-hidden="true"></div>
									<span>Generating tips…</span>
								</div>
							{:else if tips && tips.length > 0}
								<ol class="nl-tips-list">
									{#each tips as t, i (i)}
										<li class="nl-tip">
											<div class="nl-tip-head">
												<span class="nl-tip-num">{i + 1}</span>
												<span class="nl-tip-area">{t.area}</span>
											</div>
											<p class="nl-tip-body">{t.tip}</p>
										</li>
									{/each}
								</ol>
								{#if tipsError}
									<div class="nl-tips-note">
										<i class="fa-solid fa-circle-info"></i>
										Live tip generation is unavailable; showing general guidance.
									</div>
								{/if}
							{:else}
								<p class="nl-tips-empty">No mitigation tips available for this model.</p>
							{/if}
						</div>
					</aside>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.nl-page {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		background: #ffffff;
		position: relative;
	}
	.nl-page--empty {
		background: #fafaf9;
	}

	/* Spinner */
	.nl-spinner {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 3px solid #e5e7eb;
		border-top-color: #00b3b0;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 16px;
	}
	.nl-spinner.small {
		width: 18px;
		height: 18px;
		border-width: 2px;
		margin: 0;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Empty / loading container */
	.nl-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
	}
	.nl-empty-inner {
		max-width: 460px;
		text-align: center;
	}
	.nl-empty-icon {
		font-size: 44px;
		color: #cbd5e1;
		margin-bottom: 14px;
	}
	.nl-empty-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 24px;
		font-weight: 600;
		color: #111827;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.nl-empty-desc {
		font-size: 15px;
		color: #6b7280;
		line-height: 1.55;
		margin: 0 0 20px;
	}
	.nl-empty-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		box-shadow: 0 2px 8px rgba(3, 141, 143, 0.25);
		transition: filter 0.15s, transform 0.1s;
	}
	.nl-empty-btn:hover {
		filter: brightness(1.06);
		transform: translateY(-1px);
	}

	/* Empty-state split layout (2 columns) */
	.nl-intro-split {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 56px 48px 64px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 48px;
		align-items: center;
		min-height: calc(100vh - 80px);
	}
	.nl-hero {
		text-align: left;
	}
	.nl-hero-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: clamp(1.7rem, 2.4vw, 2.2rem);
		font-weight: 550;
		line-height: 1.15;
		color: #111827;
		letter-spacing: -0.012em;
		margin: 0 0 10px;
	}
	.nl-hero-sub {
		font-size: 15px;
		color: #4b5563;
		line-height: 1.55;
		margin: 0 0 26px;
		max-width: 460px;
	}
	.nl-prompt-box {
		background: #ffffff;
		border: 1.5px solid #e5e7eb;
		border-radius: 18px;
		padding: 16px 18px 12px;
		box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
		transition: border-color 0.15s, box-shadow 0.15s;
		text-align: left;
	}
	.nl-prompt-box:focus-within {
		border-color: rgba(0, 179, 176, 0.6);
		box-shadow: 0 0 0 4px rgba(0, 179, 176, 0.12);
	}
	.nl-prompt-textarea {
		width: 100%;
		min-height: 64px;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 15px;
		line-height: 1.5;
		color: #111827;
	}
	.nl-prompt-textarea::placeholder {
		color: #9ca3af;
	}
	.nl-prompt-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 6px;
	}
	.nl-prompt-submit {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 16px;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #fff;
		border: none;
		border-radius: 999px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(3, 141, 143, 0.22);
		transition: filter 0.15s, transform 0.1s;
	}
	.nl-prompt-submit:hover:not(:disabled) {
		filter: brightness(1.06);
		transform: translateY(-1px);
	}
	.nl-prompt-submit:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		box-shadow: none;
	}
	.nl-info {
		max-width: 720px;
		margin: 0 auto;
		text-align: left;
	}
	.nl-info-kicker {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #00b3b0;
		margin-bottom: 12px;
	}
	.nl-info-body {
		font-size: 15px;
		line-height: 1.65;
		color: #374151;
		margin: 0 0 14px;
	}
	.nl-info-body em {
		color: #111827;
		font-style: italic;
		font-weight: 600;
	}
	.nl-info-link {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		background: none;
		border: none;
		color: #00b3b0;
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: color 0.15s, gap 0.15s;
	}
	.nl-info-link:hover {
		color: #038d8f;
		gap: 12px;
	}
	.nl-inline-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: #00b3b0;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-thickness: 1px;
	}
	.nl-inline-link:hover {
		color: #038d8f;
	}

	/* Image inside the explain card */
	.nl-peek-figure {
		margin: 0 0 18px;
		width: 100%;
	}
	.nl-peek-figure img {
		display: block;
		width: 100%;
		height: auto;
	}

	/* Green-glowing explainer card on the right */
	.nl-explain-card {
		position: relative;
		border-radius: 20px;
		background: #fafaf9;
		box-shadow:
			0 12px 32px -16px rgba(0, 179, 176, 0.22),
			0 6px 16px -10px rgba(34, 197, 94, 0.16);
		animation: nlGlowPulse 6.5s ease-in-out infinite;
	}
	.nl-explain-glow {
		position: absolute;
		inset: -18px;
		border-radius: 28px;
		background: radial-gradient(60% 60% at 50% 40%, rgba(0, 179, 176, 0.16), transparent 70%),
			radial-gradient(50% 50% at 70% 80%, rgba(34, 197, 94, 0.12), transparent 70%);
		filter: blur(20px);
		z-index: 0;
		pointer-events: none;
		opacity: 0.6;
		animation: nlGlowDrift 9s ease-in-out infinite alternate;
	}
	.nl-explain-inner {
		position: relative;
		z-index: 1;
		background: #fafaf9;
		border-radius: 20px;
		padding: 26px 28px 28px;
	}
	.nl-explain-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: 22px;
		font-weight: 600;
		color: #0b1727;
		letter-spacing: -0.01em;
		margin: 0 0 12px;
		line-height: 1.25;
	}
	@keyframes nlGlowPulse {
		0%, 100% {
			box-shadow:
				0 12px 32px -16px rgba(0, 179, 176, 0.18),
				0 6px 16px -10px rgba(34, 197, 94, 0.12);
		}
		50% {
			box-shadow:
				0 16px 40px -14px rgba(0, 179, 176, 0.28),
				0 8px 20px -8px rgba(34, 197, 94, 0.22);
		}
	}
	@keyframes nlGlowDrift {
		from { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
		to { transform: translate3d(0, 4px, 0) scale(1.03); opacity: 0.7; }
	}

	/* Primary CTA button (replaces the prompt box on initial view) */
	.nl-cta-btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 13px 22px;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #fff;
		border: none;
		border-radius: 999px;
		font-family: inherit;
		font-size: 14.5px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(3, 141, 143, 0.25);
		transition: filter 0.15s, transform 0.1s, box-shadow 0.15s;
	}
	.nl-cta-btn:hover {
		filter: brightness(1.06);
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(3, 141, 143, 0.32);
	}

	/* Fullscreen dark composer overlay */
	.nl-composer {
		position: absolute;
		inset: 0;
		background: radial-gradient(120% 80% at 50% 0%, #142036 0%, #0b1224 60%, #070b16 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		z-index: 50;
		animation: nlComposerIn 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}
	@keyframes nlComposerIn {
		from { opacity: 0; transform: scale(0.985); }
		to { opacity: 1; transform: scale(1); }
	}
	.nl-composer-close {
		position: absolute;
		top: 20px;
		right: 24px;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e5e7eb;
		border-radius: 999px;
		cursor: pointer;
		font-size: 14px;
		transition: background 0.15s, color 0.15s;
	}
	.nl-composer-close:hover {
		background: rgba(255, 255, 255, 0.14);
		color: #ffffff;
	}
	.nl-composer-inner {
		width: 100%;
		max-width: 720px;
		text-align: center;
		animation: nlComposerInnerIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
	}
	@keyframes nlComposerInnerIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.nl-composer-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: clamp(1.6rem, 2.4vw, 2rem);
		font-weight: 550;
		color: #f9fafb;
		letter-spacing: -0.012em;
		margin: 0 0 8px;
		line-height: 1.2;
	}
	.nl-composer-sub {
		font-size: 14.5px;
		color: #94a3b8;
		line-height: 1.55;
		margin: 0 auto 28px;
		max-width: 520px;
	}
	.nl-composer-box {
		position: relative;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 18px;
		padding: 14px 60px 14px 18px;
		text-align: left;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.nl-composer-box:focus-within {
		border-color: rgba(0, 179, 176, 0.6);
		box-shadow: 0 0 0 4px rgba(0, 179, 176, 0.18);
	}
	.nl-composer-textarea {
		width: 100%;
		min-height: 78px;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 15px;
		line-height: 1.55;
		color: #f9fafb;
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		border: none;
		border-radius: 50%;
		color: #fff;
		font-size: 14px;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(3, 141, 143, 0.4);
		transition: filter 0.15s, transform 0.1s, opacity 0.15s;
	}
	.nl-composer-submit:hover:not(:disabled) {
		filter: brightness(1.08);
		transform: translateY(-1px);
	}
	.nl-composer-submit:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	@media (max-width: 960px) {
		.nl-intro-split {
			grid-template-columns: 1fr;
			gap: 36px;
			padding: 40px 24px 56px;
			min-height: 0;
		}
	}

	/* Sidebar with model cards */
	.nl-sidebar {
		flex: 0 0 270px;
		position: sticky;
		top: 0;
		height: 100vh;
		padding: 32px 20px 24px 28px;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		border-right: 1px solid #e5e7eb;
		background: #fafaf9;
	}
	.nl-sidebar-kicker {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b7280;
		margin-bottom: 8px;
	}
	.nl-sidebar-context {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 14px;
		line-height: 1.45;
		color: #1a1a1a;
		font-style: italic;
		margin-bottom: 12px;
	}
	.nl-sidebar-edit {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #ffffff;
		color: #4b5563;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.nl-sidebar-edit:hover {
		color: #00b3b0;
		border-color: #00b3b0;
	}
	.nl-sidebar-divider {
		height: 1px;
		background: #e5e7eb;
		margin: 16px 0;
	}
	.nl-sidebar-cards {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.nl-model-card {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-rows: auto auto;
		grid-template-areas:
			'rank name score'
			'rank provider score';
		gap: 2px 10px;
		align-items: center;
		padding: 10px 12px;
		background: #ffffff;
		border: 1.5px solid #e5e7eb;
		border-radius: 10px;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: border-color 0.15s, background 0.15s, transform 0.1s, box-shadow 0.15s;
	}
	.nl-model-card:hover {
		border-color: rgba(0, 179, 176, 0.5);
		transform: translateY(-1px);
	}
	.nl-model-card.active {
		border-color: #00b3b0;
		background: linear-gradient(135deg, rgba(0, 179, 176, 0.06), rgba(3, 141, 143, 0.09));
		box-shadow: 0 2px 8px rgba(0, 179, 176, 0.16);
	}
	.nl-model-rank {
		grid-area: rank;
		font-size: 12px;
		font-weight: 800;
		color: #00b3b0;
		min-width: 22px;
	}
	.nl-model-name {
		grid-area: name;
		font-size: 13px;
		font-weight: 700;
		color: #111827;
		line-height: 1.2;
	}
	.nl-model-provider {
		grid-area: provider;
		font-size: 11px;
		color: #6b7280;
	}
	.nl-model-score {
		grid-area: score;
		font-size: 14px;
		font-weight: 800;
	}

	/* Content area */
	.nl-content {
		flex: 1;
		min-width: 0;
		padding: 16px 64px 48px 64px;
		display: flex;
		flex-direction: column;
	}
	.nl-actions-bar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 10px;
	}
	.nl-save-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		background: #111827;
		color: #fff;
		border: 1.5px solid #111827;
		border-radius: 999px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.nl-save-btn:hover {
		background: #1f2937;
		border-color: #1f2937;
	}
	.nl-save-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	/* Two-column grid */
	.nl-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
		gap: 28px;
		align-items: start;
		background: #ffffff;
	}

	/* Compact nutrition label (sized for MacBook 14") */
	.nutrition-label {
		background: #ffffff;
		border: 3px solid #000000;
		color: #111111;
		font-family: 'Arial Black', Arial, sans-serif;
		padding: 10px 12px 12px;
	}
	.nutrition-headline {
		font-size: 38px;
		line-height: 0.9;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
	.nutrition-subline {
		margin-top: 4px;
		font-size: 11px;
		font-family: Arial, sans-serif;
		font-weight: 700;
		text-transform: uppercase;
	}
	.nutrition-model-block {
		margin-top: 4px;
	}
	.nutrition-model-kicker {
		font-family: Arial, sans-serif;
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #4b5563;
		font-weight: 700;
	}
	.nutrition-model-name {
		margin-top: 2px;
		font-size: 22px;
		font-weight: 900;
		line-height: 1.02;
		letter-spacing: -0.02em;
	}
	.nutrition-thick-rule {
		height: 6px;
		background: #000000;
		margin: 6px 0;
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
		font-size: 34px;
		line-height: 0.9;
		font-weight: 900;
	}
	.nutrition-footnote {
		font-family: Arial, sans-serif;
		font-size: 10.5px;
		line-height: 1.35;
	}
	.smart-nl-provider {
		font-family: Arial, sans-serif;
		font-size: 11.5px;
		color: #4b5563;
		margin-top: 1px;
	}
	.smart-nl-overall-track {
		position: relative;
		height: 5px;
		border-radius: 999px;
		background: #e5e7eb;
		margin: 6px 0 2px;
	}
	.smart-nl-overall-zero {
		position: absolute;
		left: 50%;
		top: -2px;
		bottom: -2px;
		width: 1px;
		background: #9ca3af;
	}
	.smart-nl-overall-marker {
		position: absolute;
		top: 50%;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		border: 2px solid #fff;
		box-shadow: 0 0 0 1px #111827;
	}
	.smart-nl-section-title {
		font-family: Arial, sans-serif;
		font-size: 12px;
		font-weight: 800;
		color: #111827;
		margin: 8px 0 6px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.smart-nl-section-sub {
		font-size: 10.5px;
		font-weight: 500;
		color: #6b7280;
		text-transform: none;
		letter-spacing: 0;
	}
	.smart-nl-areas {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.smart-nl-area {
		padding: 6px 9px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: #ffffff;
	}
	.smart-nl-area-top {
		display: flex;
		align-items: center;
		gap: 7px;
		font-family: Arial, sans-serif;
		font-size: 11.5px;
	}
	.smart-nl-area-icon {
		width: 18px;
		height: 18px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(0, 179, 176, 0.1);
		color: #00b3b0;
		font-size: 9.5px;
		flex-shrink: 0;
	}
	.smart-nl-area-name {
		flex: 1;
		font-weight: 700;
		color: #111827;
	}
	.smart-nl-area-score {
		font-weight: 700;
		font-size: 11.5px;
	}
	.smart-nl-area-track {
		margin-top: 4px;
		height: 4px;
		background: #f3f4f6;
		border-radius: 999px;
		overflow: hidden;
	}
	.smart-nl-area-fill {
		height: 100%;
		border-radius: 999px;
	}
	.smart-nl-warnings {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.smart-nl-warning {
		padding: 4px 0;
		border-top: 1px solid #d1d5db;
	}
	.smart-nl-warning-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		font-family: Arial, sans-serif;
		font-size: 11.5px;
		font-weight: 700;
		color: #111111;
	}
	.smart-nl-warning-label {
		flex: 1;
	}
	.smart-nl-warning-score {
		font-size: 11.5px;
		font-weight: 900;
		flex-shrink: 0;
	}

	/* Tips column */
	.nl-tips-col {
		min-width: 0;
	}
	.nl-tips-card {
		background: #fafaf9;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		padding: 18px 18px 20px;
	}
	.nl-tips-kicker {
		font-size: 10.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #00b3b0;
		margin-bottom: 4px;
	}
	.nl-tips-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 20px;
		font-weight: 600;
		color: #111827;
		margin: 0 0 6px;
		letter-spacing: -0.01em;
		line-height: 1.2;
	}
	.nl-tips-sub {
		font-size: 12.5px;
		color: #6b7280;
		line-height: 1.5;
		margin: 0 0 14px;
	}
	.nl-tips-loading {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		background: #ffffff;
		border: 1px dashed #e5e7eb;
		border-radius: 10px;
		font-size: 13px;
		color: #6b7280;
	}
	.nl-tips-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.nl-tip {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 12px 14px;
	}
	.nl-tip-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.nl-tip-num {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(0, 179, 176, 0.12);
		color: #038d8f;
		font-size: 11.5px;
		font-weight: 800;
	}
	.nl-tip-area {
		font-size: 12.5px;
		font-weight: 700;
		color: #111827;
		line-height: 1.25;
	}
	.nl-tip-body {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: #374151;
	}
	.nl-tips-empty {
		margin: 0;
		font-size: 13px;
		color: #6b7280;
		font-style: italic;
	}
	.nl-tips-note {
		margin-top: 10px;
		font-size: 11.5px;
		color: #9ca3af;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* Responsive */
	@media (max-width: 1080px) {
		.nl-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 1200px) {
		.nl-content {
			padding: 16px 32px 48px 32px;
		}
	}
	@media (max-width: 880px) {
		.nl-page {
			flex-direction: column;
		}
		.nl-sidebar {
			flex: 0 0 auto;
			position: relative;
			height: auto;
			border-right: none;
			border-bottom: 1px solid #e5e7eb;
		}
		.nl-content {
			padding: 16px 16px 40px;
		}
	}
</style>
