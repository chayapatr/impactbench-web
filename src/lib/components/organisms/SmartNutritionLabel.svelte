<script lang="ts">
	import { smartNutritionState } from '$lib/store.svelte';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const opts = $derived(smartNutritionState.opts);
	const activeIdx = $derived(smartNutritionState.activeModelIdx);

	let saving = $state(false);
	let cardEl: HTMLElement | undefined = $state();

	async function savePdf() {
		if (!cardEl || !opts) return;
		saving = true;
		try {
			const canvas = await html2canvas(cardEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
			const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pw = pdf.internal.pageSize.getWidth();
			const ph = pdf.internal.pageSize.getHeight();
			const margin = 28;
			const ratio = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height);
			const w = canvas.width * ratio;
			const h = canvas.height * ratio;
			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
			const slug = (opts.topModels[activeIdx]?.name ?? 'smart-nutrition')
				.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
			pdf.save(`${slug}.pdf`);
		} finally {
			saving = false;
		}
	}

	function fmtScore(s: number): string {
		return (s >= 0 ? '+' : '') + s.toFixed(2);
	}

	function scoreClass(s: number): string {
		if (s > 0.55) return 'positive';
		if (s < 0.45) return 'negative';
		return 'neutral';
	}
</script>

{#if open && opts}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="nutrition-overlay"
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	>
		<div class="nutrition-modal smart-nl-modal" role="dialog" aria-modal="true" aria-label="Smart Nutrition Label">
			<button class="nutrition-close-btn" aria-label="Close" onclick={onClose}>
				<i class="fa-solid fa-xmark"></i>
			</button>

			<!-- Model toggle -->
			<div class="smart-nl-toggle">
				{#each opts.topModels as model, i (i)}
					{@const cls = scoreClass(model.score)}
					<button
						class="smart-nl-toggle-btn {activeIdx === i ? 'active' : ''}"
						onclick={() => (smartNutritionState.activeModelIdx = i)}
					>
						<span class="smart-nl-toggle-rank">#{i + 1}</span>
						<span class="smart-nl-toggle-name">{model.name}</span>
						<span class="smart-nl-toggle-score {cls}">{fmtScore(model.score)}</span>
					</button>
				{/each}
			</div>

			{#each [opts.topModels[activeIdx]].filter(Boolean) as model (activeIdx)}
				{@const overallCls = scoreClass(model.score)}
				{@const overallPct = Math.max(0, Math.min(100, model.score * 100))}
				<div class="nutrition-scroll-wrap">
					<div class="nutrition-label smart-nl-label" bind:this={cardEl}>
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
							<div class="nutrition-score-value {overallCls}">{fmtScore(model.score)}</div>
						</div>
						<div class="smart-nl-overall-track" aria-hidden="true">
							<div class="smart-nl-overall-zero"></div>
							<div class="smart-nl-overall-marker {overallCls}" style="left:{overallPct}%"></div>
						</div>

						<div class="nutrition-thick-rule"></div>

						<div class="smart-nl-section-title">
							Performance on your focus areas
						</div>
						<div class="smart-nl-areas">
							{#each opts.constructs as c, i (i)}
								{@const score = model.constructScores[i] ?? 0}
								{@const pct = Math.max(4, Math.min(100, Math.round(score * 100)))}
								{@const cls = scoreClass(score)}
								<div class="smart-nl-area">
									<div class="smart-nl-area-top">
										<span class="smart-nl-area-icon"><i class="fa-solid {c.icon ?? 'fa-bullseye'}"></i></span>
										<span class="smart-nl-area-name">{c.text}</span>
										<span class="smart-nl-area-score {cls}">{fmtScore(score)}</span>
									</div>
									<div class="smart-nl-area-track">
										<div class="smart-nl-area-fill {cls}" style="width:{pct}%"></div>
									</div>
								</div>
							{/each}
						</div>

						<div class="nutrition-thick-rule"></div>

						<div class="smart-nl-section-title">
							Things to watch out
							<span class="smart-nl-section-sub">Areas where the model may fall short</span>
						</div>
						<div class="smart-nl-warnings">
							{#each (model.worstAreas ?? []).slice(0, 3) as w (w.name)}
								{@const cls = scoreClass(w.score)}
								<div class="smart-nl-warning">
									<div class="smart-nl-warning-head">
										<span class="smart-nl-warning-label">{w.name}</span>
										<span class="smart-nl-warning-score {cls}">{fmtScore(w.score)}</span>
									</div>
								</div>
							{/each}
						</div>

						<div class="nutrition-thick-rule"></div>
						<div class="nutrition-footnote">
							Generated from your Smart Explore context: "{opts.userText || '(no context provided)'}".
							Scores derive from scenario evaluations in this benchmark.
						</div>
					</div>
				</div>

				<div class="nutrition-actions">
					<button
						class="nutrition-save-pdf-btn"
						disabled={saving}
						onclick={savePdf}
					>
						<i class="fa-solid fa-file-pdf"></i>
						{saving ? 'Saving…' : 'Save PDF'}
					</button>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.nutrition-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.52);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1200;
		padding: 18px;
	}
	.nutrition-modal {
		width: min(560px, 100%);
		max-height: min(92vh, 920px);
		background: #f7f7f7;
		border-radius: 14px;
		border: 1px solid rgba(255,255,255,0.24);
		box-shadow: 0 18px 48px rgba(0,0,0,0.42);
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.smart-nl-modal { max-width: 640px; }
	.nutrition-close-btn {
		position: absolute;
		top: 8px; right: 8px;
		width: 30px; height: 30px;
		border-radius: 50%;
		border: 1px solid #d1d5db;
		background: #ffffff;
		color: #374151;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3;
	}
	.nutrition-close-btn:hover { background: #f3f4f6; }
	.nutrition-scroll-wrap { overflow: auto; padding: 18px; }
	.nutrition-label {
		background: #ffffff;
		border: 3px solid #000000;
		color: #111111;
		font-family: "Arial Black", Arial, sans-serif;
		padding: 10px 12px 12px;
	}
	.nutrition-headline { font-size: 58px; line-height: 0.9; font-weight: 900; letter-spacing: -0.03em; }
	.nutrition-subline { margin-top: 5px; font-size: 14px; font-family: Arial, sans-serif; font-weight: 700; text-transform: uppercase; }
	.nutrition-model-block { margin-top: 6px; }
	.nutrition-model-kicker { font-family: Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #4b5563; font-weight: 700; }
	.nutrition-model-name { margin-top: 3px; font-size: 34px; font-weight: 900; line-height: 1.02; letter-spacing: -0.02em; }
	.nutrition-thick-rule { height: 10px; background: #000000; margin: 8px 0; }
	.nutrition-score-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
	.nutrition-score-label { font-family: Arial, sans-serif; font-size: 44px; line-height: 0.95; font-weight: 900; }
	.nutrition-score-value { font-size: 56px; line-height: 0.9; font-weight: 900; }
	.nutrition-score-value.positive { color: #16a34a; }
	.nutrition-score-value.negative { color: #dc2626; }
	.nutrition-score-value.neutral { color: #374151; }
	.nutrition-footnote { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.35; }
	.nutrition-actions { border-top: 1px solid #d1d5db; background: #ffffff; padding: 10px 14px; display: flex; justify-content: flex-end; }
	.nutrition-save-pdf-btn {
		border: 1.5px solid #111827;
		background: #111827;
		color: #ffffff;
		border-radius: 999px;
		padding: 7px 14px;
		font-family: inherit;
		font-size: 13px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.nutrition-save-pdf-btn:hover { background: #1f2937; border-color: #1f2937; }
	.nutrition-save-pdf-btn:disabled { opacity: 0.7; cursor: wait; }

	/* Toggle */
	.smart-nl-toggle { display: flex; gap: 6px; padding: 14px 44px 10px 16px; background: #ffffff; border-bottom: 1px solid #e5e7eb; }
	.smart-nl-toggle-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 8px 10px;
		background: #fafaf9;
		border: 1.5px solid #e5e7eb;
		border-radius: 10px;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: border-color 0.15s, background 0.15s;
	}
	.smart-nl-toggle-btn:hover { border-color: rgba(0,179,176,0.4); }
	.smart-nl-toggle-btn.active { border-color: #00b3b0; background: linear-gradient(135deg,rgba(0,179,176,0.08),rgba(3,141,143,0.1)); box-shadow: 0 1px 4px rgba(0,179,176,0.18); }
	.smart-nl-toggle-rank { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #00b3b0; }
	.smart-nl-toggle-name { font-size: 12.5px; font-weight: 700; color: #111827; line-height: 1.2; }
	.smart-nl-toggle-score { font-size: 11px; font-weight: 700; margin-top: 2px; }
	.smart-nl-toggle-score.positive { color: #16a34a; }
	.smart-nl-toggle-score.negative { color: #dc2626; }
	.smart-nl-toggle-score.neutral { color: #6b7280; }

	/* Label internals */
	.smart-nl-label { padding-top: 22px; }
	.smart-nl-provider { font-family: Arial, sans-serif; font-size: 13px; color: #4b5563; margin-top: 2px; }
	.smart-nl-overall-track { position: relative; height: 6px; border-radius: 999px; background: #e5e7eb; margin: 8px 0 4px; }
	.smart-nl-overall-zero { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: #9ca3af; }
	.smart-nl-overall-marker { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%,-50%); border: 2px solid #fff; box-shadow: 0 0 0 1px #111827; }
	.smart-nl-overall-marker.positive { background: #16a34a; }
	.smart-nl-overall-marker.negative { background: #dc2626; }
	.smart-nl-overall-marker.neutral { background: #9ca3af; }
	.smart-nl-section-title { font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; color: #111827; margin: 12px 0 8px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
	.smart-nl-section-sub { font-size: 11px; font-weight: 500; color: #6b7280; text-transform: none; letter-spacing: 0; }
	.smart-nl-areas { display: flex; flex-direction: column; gap: 10px; }
	.smart-nl-area { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #ffffff; }
	.smart-nl-area-top { display: flex; align-items: center; gap: 8px; font-family: Arial, sans-serif; font-size: 13px; }
	.smart-nl-area-icon { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(0,179,176,0.1); color: #00b3b0; font-size: 11px; flex-shrink: 0; }
	.smart-nl-area-name { flex: 1; font-weight: 700; color: #111827; }
	.smart-nl-area-score { font-weight: 700; font-size: 13px; }
	.smart-nl-area-score.positive { color: #16a34a; }
	.smart-nl-area-score.negative { color: #dc2626; }
	.smart-nl-area-score.neutral { color: #6b7280; }
	.smart-nl-area-track { margin-top: 6px; height: 5px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
	.smart-nl-area-fill { height: 100%; border-radius: 999px; }
	.smart-nl-area-fill.positive { background: #16a34a; }
	.smart-nl-area-fill.negative { background: #dc2626; }
	.smart-nl-area-fill.neutral { background: #9ca3af; }
	.smart-nl-warnings { display: flex; flex-direction: column; gap: 8px; }
	.smart-nl-warning { padding: 5px 0; border-top: 1px solid #d1d5db; }
	.smart-nl-warning-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #111111; }
	.smart-nl-warning-label { flex: 1; }
	.smart-nl-warning-score { font-size: 13px; font-weight: 900; flex-shrink: 0; }
	.smart-nl-warning-score.positive { color: #16a34a; }
	.smart-nl-warning-score.negative { color: #dc2626; }
	.smart-nl-warning-score.neutral { color: #6b7280; }
</style>
