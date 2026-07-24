<script lang="ts">
	import { metricsAdminState } from '$lib/store/metrics-admin.svelte';
	import {
		listProviders,
		setProviderApiKey,
		listPipelineRoleModels,
		setPipelineRoleModel
	} from '$lib/metrics-admin/db';
	import type { Model, Provider, PipelineRole, PipelineRoleModel } from '$lib/metrics-admin/types';

	// Models are real (public-read models table). Providers are real too, but
	// gated: admin_list_providers never returns the raw api key, only whether
	// one is set, so editing a key here is a genuine write (admin_set_provider_
	// api_key), not a demo.

	interface Props {
		models: Model[];
	}

	let { models }: Props = $props();

	let providers = $state<Provider[]>([]);
	let roleModels = $state<PipelineRoleModel[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	let editingProviderId = $state<string | null>(null);
	let keyInput = $state('');
	let saving = $state(false);
	let saveError = $state('');

	const ROLE_LABELS: Record<PipelineRole, string> = {
		user_model: 'Scenario & metric generation',
		evaluator_model: 'Evaluation'
	};

	// Only models with a real litellm model string can be picked here — a
	// model row with litellm_model unset (added by hand, not yet backfilled)
	// would produce an unusable config.yaml entry. slug and litellm_model
	// often differ (slug is the short run_dir id, e.g. 'llama-4-maverick';
	// litellm_model is the real API identifier, e.g.
	// 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8') — the dropdown
	// shows both so there's no guessing which one is which.
	const selectableModels = $derived(
		models
			.filter((m) => m.litellm_model)
			.sort((a, b) => a.display_name.localeCompare(b.display_name))
	);

	// Draft: which models.id is picked per role, seeded from roleModels once
	// loaded. A dropdown by model row (not provider+free-text) means
	// provider/model can never mismatch, and there's nothing left to type.
	let roleDrafts = $state<Record<PipelineRole, string>>({ user_model: '', evaluator_model: '' });
	let roleSaving = $state<PipelineRole | null>(null);
	let roleSaveError = $state<Record<PipelineRole, string>>({ user_model: '', evaluator_model: '' });

	function seedRoleDrafts() {
		for (const role of ['user_model', 'evaluator_model'] as const) {
			const existing = roleModels.find((r) => r.role === role);
			const match = existing
				? selectableModels.find(
						(m) => m.provider_id === existing.provider_id && m.litellm_model === existing.model
					)
				: undefined;
			roleDrafts[role] = match?.id ?? '';
		}
	}

	async function saveRoleModel(role: PipelineRole) {
		const key = metricsAdminState.key;
		if (!key) {
			roleSaveError[role] = 'Admin key missing — reload and re-enter it.';
			return;
		}
		const chosen = selectableModels.find((m) => m.id === roleDrafts[role]);
		if (!chosen || !chosen.litellm_model) {
			roleSaveError[role] = 'Pick a model.';
			return;
		}
		roleSaving = role;
		roleSaveError[role] = '';
		try {
			await setPipelineRoleModel(key, role, chosen.provider_id, chosen.litellm_model);
			roleModels = await listPipelineRoleModels();
		} catch (e) {
			roleSaveError[role] = e instanceof Error ? e.message : String(e);
		} finally {
			roleSaving = null;
		}
	}

	async function load() {
		loading = true;
		loadError = '';
		try {
			const key = metricsAdminState.key;
			if (!key) throw new Error('Admin key missing — reload and re-enter it.');
			[providers, roleModels] = await Promise.all([listProviders(key), listPipelineRoleModels()]);
			seedRoleDrafts();
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	const groups = $derived(
		[...providers]
			.sort((a, b) => a.display_name.localeCompare(b.display_name))
			.map((provider) => ({
				provider,
				models: models.filter((m) => m.provider_id === provider.id)
			}))
	);

	const unassigned = $derived(models.filter((m) => !providers.some((p) => p.id === m.provider_id)));

	function startEditing(p: Provider) {
		editingProviderId = p.id;
		keyInput = '';
		saveError = '';
	}

	function cancelEditing() {
		editingProviderId = null;
		keyInput = '';
		saveError = '';
	}

	async function saveKey(p: Provider) {
		const key = metricsAdminState.key;
		if (!key) {
			saveError = 'Admin key missing — reload and re-enter it.';
			return;
		}
		saving = true;
		saveError = '';
		try {
			await setProviderApiKey(key, p.id, keyInput);
			await load();
			editingProviderId = null;
			keyInput = '';
		} catch (e) {
			saveError = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto w-full max-w-[760px] px-6 py-8">
	<div class="mb-6">
		<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">Models & providers</h2>
		<p class="text-[11px] text-[#9ca3af]">
			Models clustered by provider, matching the bench-py pipeline's config.yaml. API keys are
			stored server-side only — this list never shows the raw key.
		</p>
	</div>

	{#if loading}
		<p class="flex items-center gap-2 text-[12px] text-[#9ca3af]">
			<i class="fa-solid fa-spinner fa-spin"></i> Loading providers…
		</p>
	{:else if loadError}
		<p class="text-[12px] text-[#dc2626]">{loadError}</p>
	{:else}
		<div class="mb-6 overflow-hidden rounded-[10px] border border-[#e5e7eb]">
			<div class="bg-[#f9fafb] px-4 py-[10px]">
				<span class="text-[13px] font-[700] text-[#1a1a1a]">Pipeline roles</span>
				<p class="mt-[2px] text-[10px] text-[#9ca3af]">
					Which model generates (metrics, scenarios, the simulated user) and which one evaluates.
					Synced into the pipeline's config.yaml before every real run.
				</p>
			</div>
			<div class="divide-y divide-[#f3f4f6]">
				{#each ['user_model', 'evaluator_model'] as const as role (role)}
					<div class="flex flex-wrap items-end gap-2 px-4 py-3">
						<div class="min-w-[160px] flex-shrink-0">
							<div class="text-[12px] font-semibold text-[#1a1a1a]">{ROLE_LABELS[role]}</div>
							<div class="text-[9px] tracking-[0.06em] text-[#9ca3af] uppercase">{role}</div>
						</div>
						<label class="flex flex-col">
							<span
								class="mb-[3px] text-[9px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
								>Model</span
							>
							<select
								bind:value={roleDrafts[role]}
								onchange={() => saveRoleModel(role)}
								disabled={roleSaving === role}
								class="w-[320px] rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0] disabled:opacity-60"
							>
								<option value="" disabled>Choose a model…</option>
								{#each selectableModels as m (m.id)}
									<option value={m.id}>{m.display_name} — {m.litellm_model}</option>
								{/each}
							</select>
						</label>
						<div class="flex flex-col">
							<span
								class="mb-[3px] text-[9px] font-semibold tracking-[0.06em] text-transparent uppercase"
								>Model</span
							>
							<span class="flex h-[26px] items-center text-[11px] text-[#9ca3af]">
								{#if roleSaving === role}
									<i class="fa-solid fa-spinner fa-spin"></i>&nbsp;Saving…
								{:else if roleSaveError[role]}
									<span class="font-medium text-[#dc2626]">{roleSaveError[role]}</span>
								{:else if roleDrafts[role]}
									<i class="fa-solid fa-check text-[#16a34a]"></i>&nbsp;Saved
								{/if}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="space-y-4">
			{#each groups as group (group.provider.id)}
				<div class="overflow-hidden rounded-[10px] border border-[#e5e7eb]">
					<div class="flex items-center justify-between gap-3 bg-[#f9fafb] px-4 py-[10px]">
						<div class="flex items-center gap-2">
							<span class="text-[13px] font-[700] text-[#1a1a1a]"
								>{group.provider.display_name}</span
							>
							<span
								class="rounded-full px-2 py-[1px] text-[10px] font-bold"
								style={group.provider.api_key_set
									? 'background:#dcfce7;color:#16a34a'
									: 'background:#fee2e2;color:#dc2626'}
								>{group.provider.api_key_set ? 'Configured' : 'Missing'}</span
							>
							<span class="text-[10px] text-[#9ca3af]"
								>{group.models.length} model{group.models.length === 1 ? '' : 's'}</span
							>
						</div>
						{#if editingProviderId !== group.provider.id}
							<button
								class="rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-[4px] text-[11px] font-semibold text-[#6b7280] hover:border-[#00b3b0] hover:text-[#00b3b0]"
								onclick={() => startEditing(group.provider)}
							>
								<i class="fa-solid fa-key text-[9px]"></i> Edit API key
							</button>
						{/if}
					</div>

					{#if editingProviderId === group.provider.id}
						<div class="border-b border-[#e5e7eb] bg-[#fafaf9] px-4 py-3">
							<label class="mb-2 block">
								<span
									class="mb-[3px] block text-[10px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase"
									>API key for {group.provider.display_name}</span
								>
								<input
									type="password"
									bind:value={keyInput}
									placeholder={group.provider.api_key_set
										? 'Leave blank to keep the current key'
										: 'sk-…'}
									class="w-full rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] outline-none focus:border-[#00b3b0]"
								/>
							</label>
							{#if saveError}
								<p class="mb-2 text-[11px] font-medium text-[#dc2626]">{saveError}</p>
							{/if}
							<div class="flex gap-2">
								<button
									class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[5px] text-[11px] font-semibold text-white disabled:opacity-60"
									disabled={saving}
									onclick={() => saveKey(group.provider)}
								>
									{#if saving}<i class="fa-solid fa-spinner fa-spin"></i> Saving…{:else}Save{/if}
								</button>
								<button
									class="rounded-[6px] border border-[#e5e7eb] px-3 py-[5px] text-[11px] font-semibold text-[#6b7280] hover:border-[#9ca3af] disabled:opacity-60"
									disabled={saving}
									onclick={cancelEditing}
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}

					<table class="w-full text-left text-[12px]">
						<thead>
							<tr
								class="border-b border-[#f3f4f6] text-[10px] tracking-[0.06em] text-[#9ca3af] uppercase"
							>
								<th class="px-4 py-[6px] font-semibold">Model</th>
								<th class="px-4 py-[6px] font-semibold">Surfaces</th>
								<th class="px-4 py-[6px] font-semibold">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each group.models as m (m.id)}
								<tr class="border-b border-[#f3f4f6] last:border-0">
									<td class="px-4 py-[7px] font-medium text-[#1a1a1a]">{m.display_name}</td>
									<td class="px-4 py-[7px] text-[#6b7280]">{m.surfaces.join(', ')}</td>
									<td class="px-4 py-[7px]">
										<span
											class="rounded-full px-2 py-[1px] text-[10px] font-bold"
											style={m.status === 'active'
												? 'background:#e0f7f7;color:#038d8f'
												: 'background:#f3f4f6;color:#6b7280'}>{m.status}</span
										>
									</td>
								</tr>
							{/each}
							{#if group.models.length === 0}
								<tr
									><td colspan="3" class="px-4 py-3 text-center text-[#9ca3af]"
										>No models under this provider yet.</td
									></tr
								>
							{/if}
						</tbody>
					</table>
				</div>
			{/each}

			{#if unassigned.length > 0}
				<div class="overflow-hidden rounded-[10px] border border-[#fed7aa] bg-[#fff7ed]">
					<div class="px-4 py-[10px] text-[12px] font-semibold text-[#c2410c]">
						{unassigned.length} model{unassigned.length === 1 ? '' : 's'} with no matching provider row
					</div>
					<table class="w-full text-left text-[12px]">
						<tbody>
							{#each unassigned as m (m.id)}
								<tr class="border-t border-[#fed7aa]">
									<td class="px-4 py-[7px] font-medium text-[#1a1a1a]">{m.display_name}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if groups.length === 0 && unassigned.length === 0}
				<p class="py-8 text-center text-[12px] text-[#9ca3af]">No models yet.</p>
			{/if}
		</div>
	{/if}
</div>
