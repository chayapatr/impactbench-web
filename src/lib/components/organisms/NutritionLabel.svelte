<script lang="ts">
	import { tick } from 'svelte';
	import { nutritionLabelState, appState, sidebarState } from '$lib/store.svelte';
	import { formatScore, scoreToClass, scoreInterpretation, scorePillStyle } from '$lib/scores';

	function scoreTextColor(score: number): string {
		if (score >= 0.75) return '#16a34a';
		if (score >= 0.55) return '#d97706';
		if (score >= 0.35) return '#ea580c';
		return '#dc2626';
	}
	import { getScores, computeAreaScore, computeSubareaScore } from '$lib/utils';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	const ctx = $derived(() => {
		const scores = getScores(appState);
		const stack = sidebarState.navStack;
		if (stack.length <= 1) return undefined;
		const top = stack[stack.length - 1];
		if (top.type !== 'area' && top.type !== 'subarea') return undefined;

		let areaName = 'N/A';
		let subareaName = 'N/A';
		let focusScore = 0;
		let behaviorIds: string[] = [];

		let areaId: string | null = null;
		let subareaId: string | null = null;

		for (const level of stack) {
			if (level.type === 'area') areaId = level.areaId;
			if (level.type === 'subarea') subareaId = level.subareaId;
		}

		if (areaId) {
			const area = appState.taxonomy?.areas.find((a) => a.id === areaId);
			if (area) {
				areaName = area.name;
				if (top.type === 'area') {
					focusScore = computeAreaScore(appState, areaId);
					behaviorIds = area.subareas.flatMap((s) => s.metrics.map((m) => m.id));
				}
			}
		}

		if (subareaId) {
			for (const area of appState.taxonomy?.areas ?? []) {
				const sub = area.subareas.find((s) => s.id === subareaId);
				if (!sub) continue;
				areaName = area.name;
				subareaName = sub.name;
				if (top.type === 'subarea') {
					focusScore = computeSubareaScore(appState, subareaId);
					behaviorIds = sub.metrics.map((m) => m.id);
				}
				break;
			}
		}

		const usableIds = behaviorIds.filter((id) => scores[id] !== undefined);
		const values = usableIds.map((id) => scores[id]);
		const beneficial = values.filter((v) => v > 0.05).length;
		const harmful = values.filter((v) => v < -0.05).length;
		const neutral = Math.max(values.length - beneficial - harmful, 0);
		const posScores = values.filter((v) => v > 0.05);
		const negScores = values.filter((v) => v < -0.05);
		const posAvg = posScores.length ? posScores.reduce((a, b) => a + b, 0) / posScores.length : 0;
		const negAvg = negScores.length ? negScores.reduce((a, b) => a + b, 0) / negScores.length : 0;

		const behaviorNameMap: Record<string, string> = {};
		for (const area of appState.taxonomy?.areas ?? [])
			for (const sub of area.subareas)
				for (const m of sub.metrics) behaviorNameMap[m.id] = m.name;

		const entries = usableIds.map((id) => ({ name: behaviorNameMap[id] ?? id, score: scores[id] }));
		const topBeneficial = entries.filter((e) => e.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 3);
		const topHarmful = entries.filter((e) => e.score < -0.05).sort((a, b) => a.score - b.score).slice(0, 3);
		const modelVals = Object.values(scores);
		const overallScore = modelVals.length ? modelVals.reduce((a, b) => a + b, 0) / modelVals.length : 0;
		const modelName = appState.models.find((m) => m.id === appState.filters.model)?.name ?? 'Selected Model';

		const ageLabel =
			appState.filters.age === 'child' ? 'Child / Teenager (6–17)' : 'Adult (18+)';

		return {
			focusName: modelName,
			focusScore,
			areaName,
			subareaName,
			ageLabel,
			indicators: values.length,
			beneficial,
			harmful,
			neutral,
			posAvg,
			negAvg,
			overallScore,
			topBeneficial,
			topHarmful,
			focusInterpretation: scoreInterpretation(focusScore),
			beneficialShare: values.length ? `${Math.round((beneficial / values.length) * 100)}%` : '0%',
			harmfulShare: values.length ? `${Math.round((harmful / values.length) * 100)}%` : '0%',
			neutralShare: values.length ? `${Math.round((neutral / values.length) * 100)}%` : '0%'
		};
	});

	let saving = $state(false);
	let pdfMode = $state(false);
	let labelEl: HTMLElement | undefined = $state();

	async function savePdf() {
		if (!labelEl || !ctx()) return;
		saving = true;
		pdfMode = true;
		await tick();
		try {
			const canvas = await html2canvas(labelEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
			const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pw = pdf.internal.pageSize.getWidth();
			const ph = pdf.internal.pageSize.getHeight();
			const margin = 28;
			const ratio = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height);
			const w = canvas.width * ratio;
			const h = canvas.height * ratio;
			const originX = (pw - w) / 2;
			const originY = (ph - h) / 2;
			pdf.addImage(canvas.toDataURL('image/png'), 'PNG', originX, originY, w, h);
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
			const slug = (ctx()?.focusName ?? 'label').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
			pdf.save(`${slug}.pdf`);
		} finally {
			pdfMode = false;
			saving = false;
		}
	}
</script>

{#if nutritionLabelState.open && ctx()}
	{@const c = ctx()!}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-[1500] flex items-center justify-center bg-black/55 backdrop-blur-sm p-6"
		onclick={(e) => { if (e.target === e.currentTarget) nutritionLabelState.open = false; }}
	>
		<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-label="Nutrition label preview">
			<button
				class="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
				aria-label="Close nutrition label preview"
				onclick={() => (nutritionLabelState.open = false)}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>

			<div class="overflow-y-auto flex-1 p-5">
				<div bind:this={labelEl} class="font-mono text-xs">
					<div class="text-2xl font-black tracking-tight border-b-4 border-black pb-2 mb-1">AI Nutrition Label</div>
					<div class="text-xs text-gray-500 mb-4">Deep dive snapshot</div>

					<div class="bg-gray-50 rounded-lg p-3 mb-4">
						<div class="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Model focus</div>
						<div class="font-bold text-gray-900">{c.focusName}</div>
					</div>

					<div class="border-t-4 border-black my-3"></div>

					<div class="grid grid-cols-2 gap-2 mb-3 text-[11px]">
						<div><span class="text-gray-400">Level</span><br/><span class="font-bold">{sidebarState.navStack[sidebarState.navStack.length - 1].type}</span></div>
						<div><span class="text-gray-400">Age Group</span><br/><span class="font-bold">{c.ageLabel}</span></div>
					</div>

					<div class="border-t border-gray-200 my-2"></div>

					<div class="flex items-baseline justify-between mb-1">
						<span class="text-[11px] font-semibold text-gray-700">Net Impact Score</span>
						<span class="text-2xl font-black" style="color:{scoreTextColor(c.focusScore)}">{formatScore(c.focusScore)}</span>
					</div>

					<div class="border-t-4 border-black my-3"></div>

					{#each [['Area', c.areaName], ['Subarea', c.subareaName], ['Total indicators', String(c.indicators)], ['Beneficial indicators', `${c.beneficial} (${c.beneficialShare})`], ['Harmful indicators', `${c.harmful} (${c.harmfulShare})`], ['Neutral indicators', `${c.neutral} (${c.neutralShare})`], ['Avg beneficial score', formatScore(c.posAvg)], ['Avg harmful score', formatScore(c.negAvg)]] as [label, value] (label)}
						<div class="flex justify-between py-1 border-b border-gray-100 text-[11px]">
							<span class="text-gray-500">{label}</span>
							<span class="font-semibold text-gray-800">{value}</span>
						</div>
					{/each}
					<div class="flex justify-between py-1 text-[11px] font-bold">
						<span>Model overall score</span>
						<span>{formatScore(c.overallScore)}</span>
					</div>

					<div class="border-t border-gray-200 my-3"></div>

					<div class="mb-3">
						<div class="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">Top Beneficial Signals</div>
						{#if c.topBeneficial.length}
							{#each c.topBeneficial as item (item.name)}
								<div class="flex justify-between py-0.5 text-[11px]">
									<span class="text-gray-700 truncate">{item.name}</span>
									<span class="font-semibold ml-2" style="color:{scoreTextColor(item.score)}">{formatScore(item.score)}</span>
								</div>
							{/each}
						{:else}
							<div class="text-[11px] text-gray-400">No strongly beneficial signals in this scope</div>
						{/if}
					</div>

					<div class="mb-3">
						<div class="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">Top Harmful Signals</div>
						{#if c.topHarmful.length}
							{#each c.topHarmful as item (item.name)}
								<div class="flex justify-between py-0.5 text-[11px]">
									<span class="text-gray-700 truncate">{item.name}</span>
									<span class="font-semibold ml-2" style="color:{scoreTextColor(item.score)}">{formatScore(item.score)}</span>
								</div>
							{/each}
						{:else}
							<div class="text-[11px] text-gray-400">No strongly harmful signals in this scope</div>
						{/if}
					</div>

					<div class="border-t-4 border-black my-3"></div>
					<p class="text-[10px] text-gray-400 leading-relaxed">
						{c.focusInterpretation}. This preview summarizes the active deep-dive context from the human flourishing benchmark.
					</p>

					<div class="mt-3 pt-2 border-t border-gray-200 text-[11px] leading-snug text-gray-500">
						<p class="m-0">
							This label is part of the Open Benchmark of AI Impact on Humans (ImpactBench) led by
							researchers at the MIT Media Lab, USC Marshall Neely Center, The Psychology of
							Technology Institute, and UC Berkeley.
						</p>
						{#if pdfMode}
							<p class="m-0 mt-1">
								To learn more, visit
								<a href="https://impactbench.media.mit.edu" class="text-teal-700 underline">impactbench.media.mit.edu</a>
							</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="flex-shrink-0 px-5 py-3 border-t border-gray-100">
				<button
					class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
					disabled={saving}
					onclick={savePdf}
				>
					<i class="fa-solid fa-file-pdf"></i>
					{saving ? 'Saving…' : 'Save PDF'}
				</button>
			</div>
		</div>
	</div>
{/if}
