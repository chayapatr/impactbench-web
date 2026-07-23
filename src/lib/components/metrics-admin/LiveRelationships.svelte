<script lang="ts">
	import type { MetricPlacements, TaxonomyArea, TaxonomySubarea } from '$lib/metrics-admin/types';

	// Placements themselves are real reads from taxonomy_placements /
	// nutrition_placements — an empty list here is a genuine "not placed yet"
	// state, not mocked. The "+ Assign" picker's Assign action IS mocked: it
	// only updates local component state, since there's no
	// set_taxonomy_placement RPC yet (see backend gaps).

	interface Props {
		placements: MetricPlacements;
		suggestedPlacements: string[] | null;
		areas: TaxonomyArea[];
		subareas: TaxonomySubarea[];
	}

	let { placements, suggestedPlacements, areas, subareas }: Props = $props();

	// Demo-assigned chips are local, throwaway state. The caller wraps this
	// component in {#key selectedMetricId} so switching metrics destroys and
	// recreates it — otherwise this would keep showing a previous metric's
	// mocked assignment after switching to a different one.
	let localAdditions = $state<MetricPlacements['taxonomy']>([]);
	const displayedTaxonomy = $derived([...placements.taxonomy, ...localAdditions]);

	let picking = $state(false);
	let pickedSubareaId = $state('');
	let assignedNote = $state('');

	function areaName(areaId: string): string {
		return areas.find((a) => a.id === areaId)?.name ?? '';
	}

	function assign() {
		const subarea = subareas.find((s) => s.id === pickedSubareaId);
		if (!subarea) return;
		localAdditions = [
			...localAdditions,
			{
				metric_id: '',
				subarea_id: subarea.id,
				group_name: null,
				subarea: { name: subarea.name, area: { name: areaName(subarea.area_id) } }
			}
		];
		picking = false;
		pickedSubareaId = '';
		assignedNote = 'Demo only — not saved. Needs a set_taxonomy_placement RPC (see backend gaps).';
	}
</script>

<div class="mb-2 text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
	Live relationships
</div>
<div class="mb-2 flex flex-wrap items-center gap-[6px]">
	{#each displayedTaxonomy as t (t.subarea_id)}
		<span
			class="inline-flex items-center gap-1 rounded-full bg-[#e0f7f7] px-[10px] py-[3px] text-[11px] font-medium text-[#038d8f]"
		>
			<i class="fa-solid fa-sitemap text-[9px]"></i>
			{t.subarea.area.name} · {t.subarea.name}
		</span>
	{/each}
	{#each placements.nutrition as n (n.nutrition_category_id)}
		<span
			class="inline-flex items-center gap-1 rounded-full bg-[#fef9c3] px-[10px] py-[3px] text-[11px] font-medium text-[#a16207]"
		>
			<i class="fa-solid fa-tag text-[9px]"></i>
			Nutrition: {n.category.name}
		</span>
	{/each}
	{#if displayedTaxonomy.length === 0 && placements.nutrition.length === 0}
		<span class="text-[11px] text-[#9ca3af]">Not placed in the taxonomy yet.</span>
	{/if}
	<button
		class="inline-flex items-center gap-1 rounded-full border border-dashed border-[#d1d5db] px-[10px] py-[3px] text-[11px] font-medium text-[#9ca3af] hover:border-[#00b3b0] hover:text-[#00b3b0]"
		onclick={() => (picking = !picking)}
	>
		<i class="fa-solid fa-plus text-[9px]"></i> Assign
	</button>
</div>

{#if suggestedPlacements?.length}
	<div class="mb-2 text-[10px] text-[#9ca3af]">
		Suggested at intake: {suggestedPlacements.join(', ')}
	</div>
{/if}

{#if picking}
	<div class="mb-3 flex items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-2">
		<select
			bind:value={pickedSubareaId}
			class="flex-1 rounded-[6px] border-[1.5px] border-[#e5e7eb] bg-white px-2 py-[5px] text-[12px] text-[#1a1a1a] outline-none focus:border-[#00b3b0]"
		>
			<option value="">Choose a subarea…</option>
			{#each subareas as s (s.id)}
				<option value={s.id}>{areaName(s.area_id)} · {s.name}</option>
			{/each}
		</select>
		<button
			class="rounded-[6px] bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-3 py-[5px] text-[11px] font-semibold text-white disabled:opacity-50"
			disabled={!pickedSubareaId}
			onclick={assign}>Assign</button
		>
	</div>
{/if}

{#if assignedNote}
	<div class="mb-3 rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-[11px] text-[#6b7280]">
		{assignedNote}
	</div>
{/if}
