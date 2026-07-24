<script lang="ts">
	// DEMO ONLY, mirrors RegenerateModal.svelte's simulated-timer approach but
	// tracks progress per item instead of per phase, since a mass action runs
	// the same one or two phases across many metrics rather than many phases
	// on one metric. No pipeline is actually called and no generation_runs
	// rows are written — see the backend-gap list.

	export interface MassActionItem {
		id: string;
		label: string;
	}

	interface Props {
		open: boolean;
		title: string;
		description: string;
		actionLabel: string;
		items: MassActionItem[];
		doneTitle?: string;
		onClose: () => void;
		/** Fires exactly once, the moment every item finishes — before the
		 * user clicks Close. Callers use this to advance local status for
		 * every processed id at once. */
		onDone?: (ids: string[]) => void;
	}

	let {
		open,
		title,
		description,
		actionLabel,
		items,
		doneTitle = 'Done',
		onClose,
		onDone
	}: Props = $props();

	let activeIndex = $state(-1);
	let itemProgress = $state(0);
	let done = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	const overallProgress = $derived(
		items.length === 0
			? 0
			: Math.round(((Math.max(activeIndex, 0) + itemProgress / 100) / items.length) * 100)
	);

	function start() {
		activeIndex = items.length > 0 ? 0 : -1;
		itemProgress = 0;
		done = false;
		clearInterval(timer);
		if (items.length === 0) {
			done = true;
			return;
		}
		timer = setInterval(() => {
			itemProgress += 20;
			if (itemProgress >= 100) {
				itemProgress = 0;
				activeIndex += 1;
				if (activeIndex >= items.length) {
					clearInterval(timer);
					done = true;
					activeIndex = items.length - 1;
					itemProgress = 100;
					onDone?.(items.map((i) => i.id));
				}
			}
		}, 140);
	}

	$effect(() => {
		if (open) start();
		return () => clearInterval(timer);
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-6">
		<div
			class="flex max-h-[80vh] w-full max-w-[440px] flex-col rounded-[16px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_32px_rgba(15,23,42,0.15)]"
		>
			<div class="mb-3 flex items-center gap-2">
				<i class="fa-solid fa-layer-group text-[#00b3b0]"></i>
				<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
					{done ? doneTitle : title}
				</h2>
			</div>
			<p class="mb-3 text-[11px] leading-[1.6] text-[#9ca3af]">{description}</p>

			{#if items.length === 0}
				<div
					class="mb-2 rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] px-3 py-3 text-[12px] text-[#9ca3af]"
				>
					No eligible metrics were selected.
				</div>
			{:else}
				<div class="mb-3 h-[6px] w-full flex-shrink-0 overflow-hidden rounded-full bg-[#f3f4f6]">
					<div
						class="h-full rounded-full bg-gradient-to-r from-[#00b3b0] to-[#038d8f] transition-[width] duration-150"
						style="width:{overallProgress}%"
					></div>
				</div>
				<div class="mb-1 flex-shrink-0 text-[11px] font-medium text-[#6b7280]">
					{done ? `${items.length} of ${items.length} complete` : `${actionLabel}…`}
				</div>

				<div class="flex-1 space-y-1.5 overflow-y-auto">
					{#each items as item, i (item.id)}
						{@const state =
							i < activeIndex || done ? 'done' : i === activeIndex ? 'active' : 'pending'}
						<div class="flex items-center gap-2.5 rounded-[6px] px-1.5 py-[3px]">
							<span
								class="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[8px]"
								style={state === 'done'
									? 'background:#dcfce7;color:#16a34a'
									: state === 'active'
										? 'background:#e0f7f7;color:#00b3b0'
										: 'background:#f3f4f6;color:#c4c9d1'}
							>
								{#if state === 'done'}
									<i class="fa-solid fa-check"></i>
								{:else if state === 'active'}
									<i class="fa-solid fa-spinner fa-spin"></i>
								{/if}
							</span>
							<span
								class="truncate text-[12px] {state === 'pending'
									? 'text-[#c4c9d1]'
									: 'text-[#1a1a1a]'}">{item.label}</span
							>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-5 flex flex-shrink-0 justify-end">
				<button
					class="rounded-[8px] border border-[#e5e7eb] px-4 py-[7px] text-[12px] font-semibold text-[#6b7280] hover:border-[#9ca3af] disabled:opacity-40"
					disabled={!done}
					onclick={onClose}
				>
					{done ? 'Close' : 'Running…'}
				</button>
			</div>
		</div>
	</div>
{/if}
