<script lang="ts">
	import type { Metric } from '$lib/metrics-admin/types';

	// DEMO ONLY: there is no update_metric_draft RPC yet (see the backend-gap
	// list). Save simulates a request and discards the result — nothing here
	// is persisted. Swap the body of save() for a real RPC call once it exists.

	interface Props {
		metric: Metric;
		onCancel: () => void;
	}

	let { metric, onCancel }: Props = $props();

	let name = $state(metric.name);
	let type = $state(metric.type);
	let definition = $state(metric.definition);
	let mattersBecause = $state(metric.matters_because ?? '');
	let contributor = $state(metric.contributor ?? '');
	let examples = $state([...metric.examples]);
	let newExample = $state('');

	// Reset the edit buffer whenever handed a different metric, rather than
	// relying on the caller always unmounting this component between metrics.
	$effect(() => {
		name = metric.name;
		type = metric.type;
		definition = metric.definition;
		mattersBecause = metric.matters_because ?? '';
		contributor = metric.contributor ?? '';
		examples = [...metric.examples];
	});

	let saving = $state(false);
	let savedNote = $state('');

	function addExample() {
		const v = newExample.trim();
		if (!v) return;
		examples = [...examples, v];
		newExample = '';
	}

	function removeExample(i: number) {
		examples = examples.filter((_, idx) => idx !== i);
	}

	async function save() {
		saving = true;
		savedNote = '';
		await new Promise((r) => setTimeout(r, 600));
		saving = false;
		savedNote =
			'Demo only — nothing was saved. Needs an update_metric_draft RPC (see backend gaps).';
	}
</script>

<div class="flex-1 overflow-y-auto px-6 py-4">
	<div
		class="mb-4 flex items-center gap-2 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2"
	>
		<i class="fa-solid fa-flask text-[11px] text-[#c2410c]"></i>
		<span class="text-[11px] font-medium text-[#c2410c]"
			>Demo edit form — Save doesn't persist yet.</span
		>
	</div>

	<label class="mb-3 block">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Name</span
		>
		<input
			bind:value={name}
			class="w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[13px] text-[#1a1a1a] outline-none focus:border-[#00b3b0]"
		/>
	</label>

	<label class="mb-3 block">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Type</span
		>
		<div class="flex gap-2">
			<button
				class="flex-1 rounded-[8px] border-[1.5px] px-3 py-[7px] text-[12px] font-semibold transition-colors
					{type === 'positive'
					? 'border-[#16a34a] bg-[#dcfce7] text-[#16a34a]'
					: 'border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
				onclick={() => (type = 'positive')}
			>
				<i class="fa-solid fa-star text-[9px]"></i> Positive
			</button>
			<button
				class="flex-1 rounded-[8px] border-[1.5px] px-3 py-[7px] text-[12px] font-semibold transition-colors
					{type === 'negative'
					? 'border-[#dc2626] bg-[#fee2e2] text-[#dc2626]'
					: 'border-[#e5e7eb] text-[#6b7280] hover:border-[#9ca3af]'}"
				onclick={() => (type = 'negative')}
			>
				<i class="fa-solid fa-shield-halved text-[9px]"></i> Negative
			</button>
		</div>
	</label>

	<label class="mb-3 block">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Description</span
		>
		<textarea
			bind:value={definition}
			rows="3"
			class="w-full resize-y rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[12px] leading-[1.6] text-[#1a1a1a] outline-none focus:border-[#00b3b0]"
		></textarea>
	</label>

	<label class="mb-3 block">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Why this matters</span
		>
		<textarea
			bind:value={mattersBecause}
			rows="2"
			class="w-full resize-y rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[12px] leading-[1.6] text-[#1a1a1a] outline-none focus:border-[#00b3b0]"
		></textarea>
	</label>

	<label class="mb-3 block">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Contributor</span
		>
		<input
			bind:value={contributor}
			class="w-full rounded-[8px] border-[1.5px] border-[#e5e7eb] px-3 py-[7px] text-[13px] text-[#1a1a1a] outline-none focus:border-[#00b3b0]"
		/>
	</label>

	<div class="mb-4">
		<span
			class="mb-[4px] block text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
			>Examples</span
		>
		<ul class="mb-2 space-y-[6px]">
			{#each examples as example, i (i)}
				<li class="flex items-center gap-2">
					<span class="flex-1 rounded-[6px] bg-[#f3f4f6] px-2 py-[5px] text-[12px] text-[#4b5563]"
						>{example}</span
					>
					<button
						class="flex-shrink-0 cursor-pointer text-[#9ca3af] hover:text-[#dc2626]"
						aria-label="Remove example"
						onclick={() => removeExample(i)}
					>
						<i class="fa-solid fa-xmark text-[11px]"></i>
					</button>
				</li>
			{/each}
		</ul>
		<div class="flex gap-2">
			<input
				bind:value={newExample}
				placeholder="Add an example…"
				onkeydown={(e) => {
					if (e.key === 'Enter') addExample();
				}}
				class="flex-1 rounded-[6px] border-[1.5px] border-[#e5e7eb] px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0]"
			/>
			<button
				class="rounded-[6px] border-[1.5px] border-[#e5e7eb] px-3 py-[5px] text-[11px] font-semibold text-[#6b7280] hover:border-[#9ca3af]"
				onclick={addExample}>Add</button
			>
		</div>
	</div>

	{#if savedNote}
		<div
			class="mb-3 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[11px] text-[#6b7280]"
		>
			{savedNote}
		</div>
	{/if}

	<div class="flex gap-2">
		<button
			class="rounded-[8px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-[8px] text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter] hover:brightness-105 disabled:opacity-60"
			disabled={saving}
			onclick={save}
		>
			{#if saving}<i class="fa-solid fa-spinner fa-spin"></i> Saving…{:else}Save{/if}
		</button>
		<button
			class="rounded-[8px] border border-[#e5e7eb] px-4 py-[8px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af]"
			onclick={onCancel}>Cancel</button
		>
	</div>
</div>
