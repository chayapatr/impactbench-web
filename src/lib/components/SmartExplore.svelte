<script lang="ts">
	import { smartNutritionState } from '$lib/store.svelte';
	import { formatScore, scoreToClass } from '$lib/scores';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	interface Props {
		open: boolean;
		onClose: () => void;
		onSubmit: (text: string) => void;
		loading?: boolean;
	}

	let { open, onClose, onSubmit, loading = false }: Props = $props();

	let inputText = $state('');

	function handleSubmit() {
		if (inputText.trim()) onSubmit(inputText.trim());
	}

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
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 backdrop-blur-sm p-6"
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
	>
		<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-label="Smart Explore">
			<button
				class="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors z-10"
				aria-label="Close Smart Explore"
				onclick={onClose}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>

			<div class="p-6 flex-shrink-0">
				<div class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full mb-3">
					<i class="fa-solid fa-wand-magic-sparkles"></i> Smart Explore
				</div>
				<h2 class="text-xl font-bold text-gray-900 mb-1">Explore the Benchmark</h2>
				<p class="text-sm text-gray-500 leading-relaxed">
					Describe your context or concern. We'll surface the most relevant benchmark dimensions and show you how models compare.
				</p>
			</div>

			{#if !opts}
				<!-- Input form -->
				<div class="px-6 pb-6">
					<label class="block text-xs font-semibold uppercase tracking-widest text-gray-700 mb-2" for="smart-explore-input">
						Your context
					</label>
					<textarea id="smart-explore-input"
						class="w-full min-h-[120px] resize-y px-3.5 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-800 bg-stone-50 placeholder:text-gray-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
						placeholder="e.g. I'm a parent worried about my teenager using AI for school assignments..."
						bind:value={inputText}
						onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
					></textarea>
					<div class="flex justify-end gap-2.5 mt-3">
						<button
							class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
							onclick={onClose}
						>Cancel</button>
						<button
							class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-105 disabled:opacity-50"
							style="background:linear-gradient(135deg,#00b3b0,#038d8f)"
							disabled={!inputText.trim() || loading}
							onclick={handleSubmit}
						>
							{#if loading}
								<i class="fa-solid fa-spinner fa-spin"></i> Analyzing…
							{:else}
								<i class="fa-solid fa-magnifying-glass"></i> Explore
							{/if}
						</button>
					</div>
				</div>
			{:else}
				<!-- Results: model toggle + nutrition label -->
				<div class="flex-shrink-0 flex gap-1.5 px-6 pb-3 overflow-x-auto">
					{#each opts.topModels as model, i (i)}
						{@const cls = scoreToClass(model.score)}
						<button
							class="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border-2 text-xs transition-all
								{activeIdx === i
								? 'border-teal-400 bg-teal-50 text-teal-800'
								: 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}"
							onclick={() => (smartNutritionState.activeModelIdx = i)}
						>
							<span class="text-[9px] font-bold text-gray-400">#{i + 1}</span>
							<span class="font-semibold">{model.name}</span>
							<span
								class="font-mono font-bold text-[11px]"
								class:text-green-600={cls === 'positive'}
								class:text-red-600={cls === 'negative'}
								class:text-gray-500={cls === 'neutral'}
							>{fmtScore(model.score)}</span>
						</button>
					{/each}
				</div>

				{@const model = opts.topModels[activeIdx]}
				{#if model}
					<div class="overflow-y-auto flex-1 px-6 pb-3">
						<div bind:this={cardEl} class="font-mono text-xs">
							<div class="text-xl font-black tracking-tight border-b-4 border-black pb-2 mb-1">AI Nutrition Label</div>
							<div class="text-xs text-gray-500 mb-3">Smart Explore snapshot</div>

							<div class="bg-gray-50 rounded-lg p-3 mb-3">
								<div class="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Top model on your focus</div>
								<div class="font-bold text-gray-900">{model.name}</div>
								<div class="text-gray-500 text-[11px]">{model.provider}</div>
							</div>

							<div class="border-t-4 border-black my-3"></div>

							<div class="flex items-baseline justify-between mb-1">
								<span class="text-[11px] font-semibold text-gray-700">Focus Area Score</span>
								<span
									class="text-2xl font-black"
									class:text-green-600={scoreToClass(model.score) === 'positive'}
									class:text-red-600={scoreToClass(model.score) === 'negative'}
									class:text-gray-500={scoreToClass(model.score) === 'neutral'}
								>{fmtScore(model.score)}</span>
							</div>

							<div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
								<div
									class="h-full rounded-full"
									class:bg-green-400={scoreToClass(model.score) === 'positive'}
									class:bg-red-400={scoreToClass(model.score) === 'negative'}
									class:bg-gray-400={scoreToClass(model.score) === 'neutral'}
									style="width:{Math.max(0, Math.min(100, model.score * 100))}%"
								></div>
							</div>

							<div class="border-t-4 border-black my-3"></div>

							<div class="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Performance on your focus areas</div>
							{#each opts.constructs as c, i (i)}
								{@const score = model.constructScores[i] ?? 0}
								{@const pct = Math.max(4, Math.min(100, Math.round(score * 100)))}
								{@const cls = scoreToClass(score)}
								<div class="mb-2.5">
									<div class="flex items-center gap-2 mb-1">
										<i class="fa-solid {c.icon ?? 'fa-bullseye'} text-gray-400 text-[10px]"></i>
										<span class="flex-1 text-[11px] text-gray-700">{c.text}</span>
										<span
											class="font-bold text-[11px]"
											class:text-green-600={cls === 'positive'}
											class:text-red-600={cls === 'negative'}
											class:text-gray-500={cls === 'neutral'}
										>{fmtScore(score)}</span>
									</div>
									<div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
										<div
											class="h-full rounded-full"
											class:bg-green-400={cls === 'positive'}
											class:bg-red-400={cls === 'negative'}
											class:bg-gray-400={cls === 'neutral'}
											style="width:{pct}%"
										></div>
									</div>
								</div>
							{/each}

							<div class="border-t-4 border-black my-3"></div>

							<div class="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">
								Things to watch out
								<span class="normal-case text-gray-400 font-normal"> — areas where the model may fall short</span>
							</div>
							{#each (model.worstAreas ?? []).slice(0, 3) as w (w.name)}
								<div class="flex justify-between py-1 text-[11px] border-b border-gray-50">
									<span class="text-gray-700">{w.name}</span>
									<span
										class="font-semibold"
										class:text-green-600={scoreToClass(w.score) === 'positive'}
										class:text-red-600={scoreToClass(w.score) === 'negative'}
										class:text-gray-500={scoreToClass(w.score) === 'neutral'}
									>{fmtScore(w.score)}</span>
								</div>
							{/each}

							<div class="border-t-4 border-black my-3"></div>
							<p class="text-[10px] text-gray-400 leading-relaxed">
								Generated from your Smart Explore context: "{opts.userText || '(no context provided)'}". Scores derive from scenario evaluations in this benchmark.
							</p>
						</div>
					</div>

					<div class="flex-shrink-0 px-6 py-3 border-t border-gray-100 flex gap-2">
						<button
							class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
							disabled={saving}
							onclick={savePdf}
						>
							<i class="fa-solid fa-file-pdf"></i>
							{saving ? 'Saving…' : 'Save PDF'}
						</button>
						<button
							class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
							onclick={() => { smartNutritionState.opts = null; smartNutritionState.activeModelIdx = 0; inputText = ''; }}
						>
							New Search
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
