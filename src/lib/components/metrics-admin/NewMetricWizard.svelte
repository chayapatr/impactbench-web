<script lang="ts">
	import type { Benchmark, NutritionCategory, TaxonomyArea, TaxonomySubarea } from '$lib/metrics-admin/types';

	// DEMO ONLY. Submit doesn't create anything — there's no
	// create_metric_draft RPC yet (see backend gaps). Benchmark/placement
	// pickers are real reads; the form fields and the final submit are purely
	// local state.

	interface Props {
		benchmarks: Benchmark[];
		areas: TaxonomyArea[];
		subareas: TaxonomySubarea[];
		nutritionCategories: NutritionCategory[];
	}

	let { benchmarks, areas, subareas, nutritionCategories }: Props = $props();

	const STEPS = ['Benchmark', 'Metric', 'Placement', 'Review'];
	let step = $state(0);

	let benchmarkMode = $state<'existing' | 'new'>('existing');
	let selectedBenchmarkId = $state('');
	let newBenchmarkName = $state('');
	let newBenchmarkDescription = $state('');

	let slug = $state('');
	let name = $state('');
	let type = $state<'positive' | 'negative'>('positive');
	let definition = $state('');
	let mattersBecause = $state('');
	let examples = $state<string[]>([]);
	let newExample = $state('');

	let selectedSubareaIds = $state<string[]>([]);
	let selectedNutritionCategoryIds = $state<string[]>([]);

	let submitting = $state(false);
	let submitted = $state(false);

	const benchmarkLabel = $derived(
		benchmarkMode === 'existing'
			? (benchmarks.find((b) => b.id === selectedBenchmarkId)?.name ?? '(none selected)')
			: newBenchmarkName || '(untitled new benchmark)'
	);

	const canGoNext = $derived(
		step === 0
			? benchmarkMode === 'existing' ? !!selectedBenchmarkId : newBenchmarkName.trim().length > 0
			: step === 1
				? slug.trim().length > 0 && name.trim().length > 0 && definition.trim().length > 0
				: true
	);

	function areaName(areaId: string): string {
		return areas.find((a) => a.id === areaId)?.name ?? '';
	}

	function toggleSubarea(id: string) {
		selectedSubareaIds = selectedSubareaIds.includes(id)
			? selectedSubareaIds.filter((x) => x !== id)
			: [...selectedSubareaIds, id];
	}

	function toggleNutrition(id: string) {
		selectedNutritionCategoryIds = selectedNutritionCategoryIds.includes(id)
			? selectedNutritionCategoryIds.filter((x) => x !== id)
			: [...selectedNutritionCategoryIds, id];
	}

	function addExample() {
		const v = newExample.trim();
		if (!v) return;
		examples = [...examples, v];
		newExample = '';
	}

	async function submit() {
		submitting = true;
		await new Promise((r) => setTimeout(r, 700));
		submitting = false;
		submitted = true;
	}

	function reset() {
		step = 0;
		benchmarkMode = 'existing';
		selectedBenchmarkId = '';
		newBenchmarkName = '';
		newBenchmarkDescription = '';
		slug = '';
		name = '';
		type = 'positive';
		definition = '';
		mattersBecause = '';
		examples = [];
		selectedSubareaIds = [];
		selectedNutritionCategoryIds = [];
		submitted = false;
	}
</script>

<div class="mx-auto w-full max-w-[640px] px-6 py-8">
	<div class="mb-4 flex items-center gap-2 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2">
		<i class="fa-solid fa-flask text-[11px] text-[#c2410c]"></i>
		<span class="text-[11px] font-medium text-[#c2410c]"
			>Demo wizard — submitting doesn't create anything yet.</span
		>
	</div>

	{#if submitted}
		<div class="rounded-[16px] border border-[#e5e7eb] bg-white p-8 text-center shadow-[0_10px_32px_rgba(15,23,42,0.07)]">
			<i class="fa-solid fa-circle-check mb-3 text-[28px] text-[#16a34a]"></i>
			<h2 class="mb-1 text-[15px] font-[800] text-[#111827]">Looks good</h2>
			<p class="mb-4 text-[12px] leading-[1.6] text-[#6b7280]">
				This is where "{name}" would be created as a draft metric in <strong>{benchmarkLabel}</strong
				>. Nothing was saved — this demo has no create_metric_draft RPC yet.
			</p>
			<button
				class="rounded-[8px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[8px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] hover:brightness-105"
				onclick={reset}>Start another</button
			>
		</div>
	{:else}
		<!-- Step indicator -->
		<div class="mb-6 flex items-center gap-2">
			{#each STEPS as label, i (label)}
				<div class="flex flex-1 items-center gap-2">
					<span
						class="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold
							{i === step
							? 'bg-[#00b3b0] text-white'
							: i < step
								? 'bg-[#dcfce7] text-[#16a34a]'
								: 'bg-[#f3f4f6] text-[#9ca3af]'}"
					>
						{#if i < step}<i class="fa-solid fa-check text-[8px]"></i>{:else}{i + 1}{/if}
					</span>
					<span class="text-[11px] font-medium {i === step ? 'text-[#1a1a1a]' : 'text-[#9ca3af]'}"
						>{label}</span
					>
					{#if i < STEPS.length - 1}
						<div class="h-[1.5px] flex-1 bg-[#e5e7eb]"></div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="rounded-[16px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_32px_rgba(15,23,42,0.07)]">
			{#if step === 0}
				<h2 class="mb-3 text-[14px] font-[700] text-[#1a1a1a]">Which benchmark is this for?</h2>
				<div class="mb-4 flex gap-2">
					<button
						class="flex-1 rounded-[8px] border-[1.5px] px-3 py-[7px] text-[12px] font-semibold
							{benchmarkMode === 'existing'
							? 'border-[#00b3b0] bg-[#e0f7f7] text-[#00b3b0]'
							: 'border-[#e5e7eb] text-[#6b7280]'}"
						onclick={() => (benchmarkMode = 'existing')}>Existing benchmark</button
					>
					<button
						class="flex-1 rounded-[8px] border-[1.5px] px-3 py-[7px] text-[12px] font-semibold
							{benchmarkMode === 'new'
							? 'border-[#00b3b0] bg-[#e0f7f7] text-[#00b3b0]'
							: 'border-[#e5e7eb] text-[#6b7280]'}"
						onclick={() => (benchmarkMode = 'new')}>New benchmark</button
					>
				</div>
				{#if benchmarkMode === 'existing'}
					<select
						bind:value={selectedBenchmarkId}
						class="w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[8px] text-[13px] outline-none focus:border-[#00b3b0]"
					>
						<option value="">Choose a benchmark…</option>
						{#each benchmarks as b (b.id)}
							<option value={b.id}>{b.name}</option>
						{/each}
					</select>
				{:else}
					<input
						bind:value={newBenchmarkName}
						placeholder="Benchmark name…"
						class="mb-2 w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[8px] text-[13px] outline-none focus:border-[#00b3b0]"
					/>
					<textarea
						bind:value={newBenchmarkDescription}
						placeholder="Short description…"
						rows="2"
						class="w-full resize-y rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[8px] text-[12px] outline-none focus:border-[#00b3b0]"
					></textarea>
				{/if}
			{:else if step === 1}
				<h2 class="mb-3 text-[14px] font-[700] text-[#1a1a1a]">Metric definition</h2>
				<div class="mb-3 grid grid-cols-2 gap-2">
					<label class="block">
						<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
							>Slug</span
						>
						<input
							bind:value={slug}
							placeholder="m01"
							class="w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-2 py-[6px] text-[12px] outline-none focus:border-[#00b3b0]"
						/>
					</label>
					<label class="block">
						<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
							>Type</span
						>
						<div class="flex gap-1">
							<button
								class="flex-1 rounded-[6px] border-[1.5px] px-2 py-[6px] text-[11px] font-semibold
									{type === 'positive'
									? 'border-[#16a34a] bg-[#dcfce7] text-[#16a34a]'
									: 'border-[#e5e7eb] text-[#6b7280]'}"
								onclick={() => (type = 'positive')}>+</button
							>
							<button
								class="flex-1 rounded-[6px] border-[1.5px] px-2 py-[6px] text-[11px] font-semibold
									{type === 'negative'
									? 'border-[#dc2626] bg-[#fee2e2] text-[#dc2626]'
									: 'border-[#e5e7eb] text-[#6b7280]'}"
								onclick={() => (type = 'negative')}>×</button
							>
						</div>
					</label>
				</div>
				<label class="mb-3 block">
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Name</span
					>
					<input
						bind:value={name}
						class="w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[13px] outline-none focus:border-[#00b3b0]"
					/>
				</label>
				<label class="mb-3 block">
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Description</span
					>
					<textarea
						bind:value={definition}
						rows="3"
						class="w-full resize-y rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[12px] leading-[1.6] outline-none focus:border-[#00b3b0]"
					></textarea>
				</label>
				<label class="mb-3 block">
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Why this matters</span
					>
					<textarea
						bind:value={mattersBecause}
						rows="2"
						class="w-full resize-y rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[12px] leading-[1.6] outline-none focus:border-[#00b3b0]"
					></textarea>
				</label>
				<div>
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Examples</span
					>
					{#each examples as example, i (i)}
						<div class="mb-[4px] rounded-[6px] bg-[#f3f4f6] px-2 py-[5px] text-[11px] text-[#4b5563]">
							{example}
						</div>
					{/each}
					<div class="flex gap-2">
						<input
							bind:value={newExample}
							placeholder="Add an example…"
							onkeydown={(e) => {
								if (e.key === 'Enter') addExample();
							}}
							class="flex-1 rounded-[6px] border-[1.5px] border-[#e5e7eb] px-2 py-[5px] text-[11px] outline-none focus:border-[#00b3b0]"
						/>
						<button
							class="rounded-[6px] border-[1.5px] border-[#e5e7eb] px-2 py-[5px] text-[10px] font-semibold text-[#6b7280]"
							onclick={addExample}>Add</button
						>
					</div>
				</div>
			{:else if step === 2}
				<h2 class="mb-1 text-[14px] font-[700] text-[#1a1a1a]">Where does this belong?</h2>
				<p class="mb-3 text-[11px] text-[#9ca3af]">Optional — can be assigned later by a curator.</p>
				<div class="mb-4">
					<div class="mb-[6px] text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
						Taxonomy subareas
					</div>
					<div class="flex flex-wrap gap-[6px]">
						{#each subareas as s (s.id)}
							<button
								class="rounded-full border-[1.5px] px-[10px] py-[4px] text-[11px] font-medium
									{selectedSubareaIds.includes(s.id)
									? 'border-[#00b3b0] bg-[#e0f7f7] text-[#00b3b0]'
									: 'border-[#e5e7eb] text-[#6b7280]'}"
								onclick={() => toggleSubarea(s.id)}
							>
								{areaName(s.area_id)} · {s.name}
							</button>
						{/each}
						{#if subareas.length === 0}
							<span class="text-[11px] text-[#9ca3af]">No subareas seeded yet.</span>
						{/if}
					</div>
				</div>
				<div>
					<div class="mb-[6px] text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
						Nutrition label categories
					</div>
					<div class="flex flex-wrap gap-[6px]">
						{#each nutritionCategories as c (c.id)}
							<button
								class="rounded-full border-[1.5px] px-[10px] py-[4px] text-[11px] font-medium
									{selectedNutritionCategoryIds.includes(c.id)
									? 'border-[#a16207] bg-[#fef9c3] text-[#a16207]'
									: 'border-[#e5e7eb] text-[#6b7280]'}"
								onclick={() => toggleNutrition(c.id)}
							>
								{c.name}
							</button>
						{/each}
						{#if nutritionCategories.length === 0}
							<span class="text-[11px] text-[#9ca3af]">None seeded yet.</span>
						{/if}
					</div>
				</div>
			{:else}
				<h2 class="mb-3 text-[14px] font-[700] text-[#1a1a1a]">Review</h2>
				<dl class="space-y-2 text-[12px]">
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Benchmark</dt>
						<dd class="text-[#1a1a1a]">{benchmarkLabel}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Slug</dt>
						<dd class="text-[#1a1a1a]">{slug || '—'}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Name</dt>
						<dd class="text-[#1a1a1a]">{name || '—'}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Type</dt>
						<dd class="text-[#1a1a1a]">{type}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Description</dt>
						<dd class="text-[#1a1a1a]">{definition || '—'}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Examples</dt>
						<dd class="text-[#1a1a1a]">{examples.length}</dd>
					</div>
					<div class="flex gap-2">
						<dt class="w-[110px] flex-shrink-0 text-[#9ca3af]">Subareas</dt>
						<dd class="text-[#1a1a1a]">{selectedSubareaIds.length || 'none'}</dd>
					</div>
				</dl>
			{/if}
		</div>

		<div class="mt-4 flex justify-between">
			<button
				class="rounded-[8px] border border-[#e5e7eb] px-4 py-[8px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af] disabled:opacity-40"
				disabled={step === 0}
				onclick={() => (step -= 1)}>Back</button
			>
			{#if step < STEPS.length - 1}
				<button
					class="rounded-[8px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[8px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] hover:brightness-105 disabled:opacity-50"
					disabled={!canGoNext}
					onclick={() => (step += 1)}>Next</button
				>
			{:else}
				<button
					class="rounded-[8px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[8px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] hover:brightness-105 disabled:opacity-60"
					disabled={submitting}
					onclick={submit}
				>
					{#if submitting}<i class="fa-solid fa-spinner fa-spin"></i> Creating…{:else}Create metric{/if}
				</button>
			{/if}
		</div>
	{/if}
</div>
