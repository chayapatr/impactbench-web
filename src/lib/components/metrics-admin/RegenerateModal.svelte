<script lang="ts">
	// DEMO ONLY. Nothing here calls the external bench-py pipeline, and no
	// generation_runs row is written — there's no job runner yet (see the
	// backend-gap list). This simulates the phase timeline purely with local
	// timers so the UX can be seen before that integration exists.
	// Reused for every workflow action (Generate Scenarios / Run Test
	// Simulation) — only which phases run and the framing text differ per
	// caller.

	export interface Phase {
		key: string;
		label: string;
	}

	interface Props {
		open: boolean;
		title: string;
		description: string;
		phases: Phase[];
		doneTitle?: string;
		/** Titles fed in as seed input (e.g. submitted scenario titles feeding
		 * a Generate Scenarios run). Purely informational — shown above the
		 * phase timeline so the action doesn't look like it's inventing input
		 * from nothing. */
		seedTitles?: string[];
		onClose: () => void;
		/** Fires exactly once, the moment the simulated run finishes — before
		 * the user clicks Close. Callers use this to advance local status. */
		onDone?: () => void;
	}

	let {
		open,
		title,
		description,
		phases,
		doneTitle = 'Done',
		seedTitles = [],
		onClose,
		onDone
	}: Props = $props();

	let phaseIndex = $state(-1);
	let progress = $state(0);
	let done = $state(false);
	let timer: ReturnType<typeof setInterval> | undefined;

	function start() {
		phaseIndex = 0;
		progress = 0;
		done = false;
		clearInterval(timer);
		timer = setInterval(() => {
			progress += 8;
			if (progress >= 100) {
				progress = 0;
				phaseIndex += 1;
				if (phaseIndex >= phases.length) {
					clearInterval(timer);
					done = true;
					phaseIndex = phases.length - 1;
					progress = 100;
					onDone?.();
				}
			}
		}, 150);
	}

	$effect(() => {
		if (open) start();
		return () => clearInterval(timer);
	});
</script>

{#if open}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-6">
		<div
			class="w-full max-w-[420px] rounded-[16px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_32px_rgba(15,23,42,0.15)]"
		>
			<div class="mb-3 flex items-center gap-2">
				<i class="fa-solid fa-arrows-rotate text-[#00b3b0]"></i>
				<h2 class="text-[15px] font-[800] tracking-[-0.01em] text-[#111827]">
					{done ? doneTitle : title}
				</h2>
			</div>
			<p class="mb-4 text-[11px] leading-[1.6] text-[#9ca3af]">{description}</p>

			{#if seedTitles.length}
				<div class="mb-4 rounded-[8px] border border-[#e5e7eb] bg-[#fafaf9] p-2.5">
					<div class="mb-1.5 text-[9px] font-[700] tracking-[0.08em] text-[#b0b8c4] uppercase">
						Seed input
					</div>
					<ul class="space-y-1">
						{#each seedTitles as t (t)}
							<li class="flex items-start gap-1.5 text-[11px] leading-[1.5] text-[#4b5563]">
								<i class="fa-solid fa-file-lines mt-[3px] flex-shrink-0 text-[8px] text-[#c4c9d1]"
								></i>
								<span class="truncate">{t}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="space-y-3">
				{#each phases as phase, i (phase.key)}
					{@const state = i < phaseIndex || done ? 'done' : i === phaseIndex ? 'active' : 'pending'}
					<div class="flex items-center gap-3">
						<span
							class="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-full text-[10px]"
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
							{:else}
								{i + 1}
							{/if}
						</span>
						<div class="flex-1">
							<div
								class="text-[12px] font-medium {state === 'pending'
									? 'text-[#c4c9d1]'
									: 'text-[#1a1a1a]'}"
							>
								{phase.label}
							</div>
							{#if state === 'active'}
								<div class="mt-1 h-[4px] w-full overflow-hidden rounded-full bg-[#f3f4f6]">
									<div
										class="h-full rounded-full bg-[#00b3b0] transition-[width] duration-150"
										style="width:{progress}%"
									></div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-5 flex justify-end">
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
