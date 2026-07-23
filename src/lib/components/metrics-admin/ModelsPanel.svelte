<script lang="ts">
	import type { Model } from '$lib/metrics-admin/types';

	// The model table itself is real (models is public-read). "+ Add model"
	// and the API key rows below are both mocked: there's no create-model RPC,
	// and there is no secure key-storage design at all yet in this schema —
	// see the backend-gap list, this isn't a small addition like the others.

	interface Props {
		models: Model[];
	}

	let { models }: Props = $props();

	let adding = $state(false);
	let newDisplayName = $state('');
	let newProvider = $state('');
	let newApiKey = $state('');
	let addedNote = $state('');

	function resetAddForm() {
		adding = false;
		newDisplayName = '';
		newProvider = '';
		newApiKey = '';
	}

	function addModel() {
		addedNote = 'Demo only — not saved. Needs a create/update model RPC, and a secure place to put that API key (see backend gaps).';
		resetAddForm();
	}

	function cancelAdding() {
		resetAddForm();
	}

	// Illustrative only — no secure secret storage exists for these at all.
	const exampleKeys = [
		{ provider: 'Anthropic', masked: 'sk-ant-••••••••7f3a', configured: true },
		{ provider: 'OpenAI', masked: 'sk-••••••••b21c', configured: true },
		{ provider: 'DeepInfra', masked: '(not set)', configured: false }
	];
</script>

<div class="mx-auto w-full max-w-[760px] px-6 py-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">Model registry</h2>
			<p class="text-[11px] text-[#9ca3af]">Real data — reads directly from the models table.</p>
		</div>
		<button
			class="rounded-[8px] border border-[#e5e7eb] px-3 py-[6px] text-[12px] font-semibold text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]"
			onclick={() => (adding = !adding)}
		>
			<i class="fa-solid fa-plus text-[10px]"></i> Add model
		</button>
	</div>

	{#if adding}
		<div class="mb-4 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-3">
			<div class="mb-2 flex gap-2">
				<label class="flex-1">
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Display name</span
					>
					<input
						bind:value={newDisplayName}
						class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0]"
					/>
				</label>
				<label class="flex-1">
					<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
						>Provider</span
					>
					<input
						bind:value={newProvider}
						class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0]"
					/>
				</label>
			</div>
			<label class="mb-3 block">
				<span class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
					>API key</span
				>
				<input
					type="password"
					bind:value={newApiKey}
					placeholder="sk-…"
					class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0]"
				/>
			</label>
			<div class="flex gap-2">
				<button
					class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[6px] text-[11px] font-semibold text-white"
					onclick={addModel}>Save</button
				>
				<button
					class="rounded-[6px] border border-[#e5e7eb] px-3 py-[6px] text-[11px] font-semibold text-[#6b7280] hover:border-[#9ca3af]"
					onclick={cancelAdding}>Cancel</button
				>
			</div>
		</div>
	{/if}
	{#if addedNote}
		<div class="mb-4 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[11px] text-[#6b7280]">
			{addedNote}
		</div>
	{/if}

	<div class="mb-8 overflow-hidden rounded-[10px] border border-[#e5e7eb]">
		<table class="w-full text-left text-[12px]">
			<thead>
				<tr class="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] tracking-[0.06em] text-[#9ca3af] uppercase">
					<th class="px-4 py-[8px] font-semibold">Model</th>
					<th class="px-4 py-[8px] font-semibold">Provider</th>
					<th class="px-4 py-[8px] font-semibold">Surfaces</th>
					<th class="px-4 py-[8px] font-semibold">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each models as m (m.id)}
					<tr class="border-b border-[#f3f4f6] last:border-0">
						<td class="px-4 py-[8px] font-medium text-[#1a1a1a]">{m.display_name}</td>
						<td class="px-4 py-[8px] text-[#6b7280]">{m.provider}</td>
						<td class="px-4 py-[8px] text-[#6b7280]">{m.surfaces.join(', ')}</td>
						<td class="px-4 py-[8px]">
							<span
								class="rounded-full px-2 py-[1px] text-[10px] font-bold"
								style={m.status === 'active'
									? 'background:#e0f7f7;color:#038d8f'
									: 'background:#f3f4f6;color:#6b7280'}>{m.status}</span
							>
						</td>
					</tr>
				{/each}
				{#if models.length === 0}
					<tr><td colspan="4" class="px-4 py-4 text-center text-[#9ca3af]">No models yet.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>

	<div class="mb-2 flex items-center gap-2">
		<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">Provider API keys</h2>
		<span class="rounded-full bg-[#fff7ed] px-2 py-[1px] text-[9px] font-bold text-[#c2410c]">Illustrative</span>
	</div>
	<p class="mb-3 text-[11px] text-[#9ca3af]">
		Example only — there's no secure key-storage design in this schema yet (see backend gaps).
	</p>
	<div class="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
		<table class="w-full text-left text-[12px]">
			<thead>
				<tr class="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] tracking-[0.06em] text-[#9ca3af] uppercase">
					<th class="px-4 py-[8px] font-semibold">Provider</th>
					<th class="px-4 py-[8px] font-semibold">Key</th>
					<th class="px-4 py-[8px] font-semibold">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each exampleKeys as k (k.provider)}
					<tr class="border-b border-[#f3f4f6] last:border-0">
						<td class="px-4 py-[8px] font-medium text-[#1a1a1a]">{k.provider}</td>
						<td class="px-4 py-[8px] font-mono text-[11px] text-[#6b7280]">{k.masked}</td>
						<td class="px-4 py-[8px]">
							<span
								class="rounded-full px-2 py-[1px] text-[10px] font-bold"
								style={k.configured
									? 'background:#dcfce7;color:#16a34a'
									: 'background:#fee2e2;color:#dc2626'}
								>{k.configured ? 'Configured' : 'Missing'}</span
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
