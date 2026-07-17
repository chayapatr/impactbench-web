<script lang="ts">
	/**
	 * Metric-scoped welcome/orientation shown before the reviewer pre-read.
	 * Introduces the reviewer to the task, names the specific metric they've
	 * been assigned, and previews the definition + examples so they know
	 * what they're evaluating before signing anything.
	 */

	interface Props {
		expertName: string;
		metricName: string;
		definition: string;
		examples: readonly string[];
		onProceed: () => void;
	}

	let { expertName, metricName, definition, examples, onProceed }: Props = $props();
</script>

<div
	class="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
	role="dialog"
	aria-modal="true"
	aria-labelledby="orientationTitle"
>
	<div
		class="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
	>
		<div class="flex-shrink-0 border-b border-[#e5e7eb] px-7 py-5">
			<h2
				id="orientationTitle"
				class="text-[19px] font-[700] tracking-[-0.01em] text-[#111827]"
			>
				Welcome, {expertName}!
			</h2>
			<p class="mt-1 text-[12px] text-[#6b7280]">
				A quick orientation before you begin the reviewer protocol.
			</p>
		</div>

		<div
			class="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fafaf9] px-7 py-6 text-[13px] leading-[1.65] text-[#374151]"
		>
			<p>
				In this experience, you will provide your rating and input on an AI model's
				performance on a simulated human conversation.
			</p>

			<div class="rounded-[10px] border border-[#e5e7eb] bg-white p-5">
				<div class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
					Your assigned metric
				</div>
				<div class="mt-[3px] text-[16px] font-[700] tracking-[-0.01em] text-[#111827]">
					{metricName}
				</div>
				<p class="mt-2 text-[13px] leading-[1.55] text-[#4b5563]">
					{definition}
				</p>
				{#if examples.length > 0}
					<div class="mt-4">
						<div class="text-[10px] font-[700] tracking-[0.08em] text-[#9ca3af] uppercase">
							Examples
						</div>
						<ul class="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-[1.55] text-[#4b5563]">
							{#each examples as ex (ex)}
								<li>{ex}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<p>
				This process will take about <strong>2 hours in total</strong>, but you can pause
				at any point and your progress will be automatically saved.
			</p>
			<p>
				At the end of this experience, you will enter in your information so we can
				compensate you for your time.
			</p>
		</div>

		<div class="flex flex-shrink-0 items-center justify-end border-t border-[#e5e7eb] bg-white px-7 py-4">
			<button
				type="button"
				class="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border-none bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-6 py-[10px] text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(3,141,143,0.3)] transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.99]"
				onclick={onProceed}
			>
				Proceed
				<i class="fa-solid fa-arrow-right text-[11px]"></i>
			</button>
		</div>
	</div>
</div>
