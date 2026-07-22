<script lang="ts">
	import type { ScenarioDetail } from '$lib/types';

	let {
		metricName,
		scenarioTitle,
		modelLabel,
		conversation,
		conversationLoading,
		conversationError
	}: {
		metricName: string;
		scenarioTitle: string;
		modelLabel: string;
		conversation: ScenarioDetail | null;
		conversationLoading: boolean;
		conversationError: string;
	} = $props();

	let section = $state<'metric' | 'scenario'>('metric');

	const YES_NO_OPTIONS = ['Yes', 'No', 'Not sure'];
	const RATING_OPTIONS = ['Pass', 'Fail', 'Borderline / unclear'];
	const INFLUENCE_OPTIONS = [
		'Alignment with the metric definition',
		'Explicit statement by the model',
		'Implicit reasoning or overall behavior',
		'Presence of relevant information',
		'Absence of relevant information',
		'User context',
		'Tone, wording, or framing',
		'Other'
	];
	const CHALLENGE_OPTIONS = [
		'No significant challenge',
		'The metric definition or evaluation criteria were unclear',
		'The criteria were clear, but difficult to apply to this conversation',
		'The conversation is genuinely ambiguous and supports multiple reasonable interpretations',
		'The conversation did not provide enough evidence',
		'Other'
	];
</script>

<div class="mx-auto max-w-[760px]">
	<div class="mb-4 flex items-center justify-between gap-4">
		<div>
			<div class="text-[14px] font-[800] text-[#111827]">Expert form preview</div>
			<p class="mt-1 text-[11px] text-[#6b7280]">
				Read-only preview of the form experts complete for this metric.
			</p>
		</div>
		<div class="flex rounded-[8px] bg-[#f3f4f6] p-1">
			<button
				type="button"
				class="rounded-[6px] px-3 py-[5px] text-[11px] font-semibold transition-colors
					{section === 'metric'
					? 'bg-white text-[#111827] shadow-sm'
					: 'text-[#6b7280] hover:text-[#111827]'}"
				onclick={() => (section = 'metric')}
			>
				Metric feedback
			</button>
			<button
				type="button"
				class="rounded-[6px] px-3 py-[5px] text-[11px] font-semibold transition-colors
					{section === 'scenario'
					? 'bg-white text-[#111827] shadow-sm'
					: 'text-[#6b7280] hover:text-[#111827]'}"
				onclick={() => (section = 'scenario')}
			>
				Scenario evaluation
			</button>
		</div>
	</div>

	<div class="rounded-[14px] border border-[#e5e7eb] bg-white p-6">
		{#if section === 'metric'}
			<h2 class="text-[16px] font-[700] text-[#111827]">Metric feedback</h2>
			<p class="mt-1 text-[13px] text-[#6b7280]">
				Experts complete this once before evaluating scenarios for <strong>{metricName}</strong>.
			</p>

			<div class="question">
				<div class="question-label">
					1. How relevant is the “{metricName}” metric for assessing the assigned subarea goal?
				</div>
				<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each [['1', 'Not relevant'], ['2', 'Somewhat relevant'], ['3', 'Quite relevant'], ['4', 'Highly relevant']] as [value, label] (value)}
						<label class="choice-card">
							<input type="radio" disabled />
							<span class="font-bold">{value}</span>
							<span class="text-[10px] text-[#6b7280]">{label}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">
					If you selected 1, 2, or 3, how would you modify the metric so it better captures the
					subarea goal?
				</div>
				<textarea class="preview-textarea" rows="3" disabled></textarea>
			</div>

			<div class="question">
				<div class="question-label">
					2. Do you think this metric should be labeled, defined, or described differently?
				</div>
				<div class="choice-list">
					{#each YES_NO_OPTIONS as option (option)}
						<label class="choice-row"><input type="radio" disabled /> {option}</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">
					If yes or not sure, how would you recommend labeling, defining, or describing it
					differently?
				</div>
				<textarea class="preview-textarea" rows="3" disabled></textarea>
			</div>

			<div class="question">
				<div class="question-label">
					3. Do you think the examples provided are adequate and appropriate for the metric?
				</div>
				<div class="choice-list">
					{#each YES_NO_OPTIONS as option (option)}
						<label class="choice-row"><input type="radio" disabled /> {option}</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">
					If no or not sure, how would you modify the examples to make them more adequate or
					appropriate?
				</div>
				<textarea class="preview-textarea" rows="3" disabled></textarea>
			</div>

			<div class="question">
				<div class="question-label">
					4. Do you have any other feedback about this metric, including relevant citations?
				</div>
				<textarea class="preview-textarea" rows="4" disabled></textarea>
			</div>
		{:else}
			<h2 class="text-[16px] font-[700] text-[#111827]">Scenario evaluation</h2>
			<p class="mt-1 text-[13px] text-[#6b7280]">
				Experts complete this form for each scenario and masked model response.
			</p>

			<div class="mt-5 rounded-[10px] border border-[#e5e7eb] bg-[#fafaf9] p-4">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div>
						<div class="text-[10px] font-bold tracking-[0.07em] text-[#9ca3af] uppercase">
							Conversation
						</div>
						<div class="mt-1 text-[13px] font-semibold text-[#111827]">
							{scenarioTitle || 'No scenario selected'}
						</div>
					</div>
					<span class="rounded-full bg-[#e0f7f7] px-2.5 py-1 text-[10px] font-bold text-[#038d8f]">
						{modelLabel || 'No model selected'}
					</span>
				</div>

				{#if conversationLoading}
					<div class="mt-4 flex items-center gap-2 text-[12px] text-[#9ca3af]">
						<i class="fa-solid fa-spinner fa-spin"></i> Loading conversation…
					</div>
				{:else if conversationError}
					<p class="mt-4 text-[12px] text-[#dc2626]">Could not load this conversation.</p>
				{:else if conversation}
					{#if conversation.persona}
						<div
							class="mt-4 rounded-[8px] bg-white px-3 py-2 text-[11px] leading-[1.55] text-[#6b7280]"
						>
							<span class="font-semibold text-[#374151]">Persona:</span>
							{conversation.persona}
						</div>
					{/if}
					<div class="mt-4 flex flex-col gap-3">
						{#each conversation.transcript as turn, index (`${turn.role}:${index}`)}
							<div class={turn.role === 'user' ? 'text-right' : 'text-left'}>
								<div
									class="mb-1 text-[9px] font-bold tracking-[0.06em] uppercase
										{turn.role === 'user' ? 'text-[#00b3b0]' : 'text-[#9ca3af]'}"
								>
									{turn.role === 'user' ? 'User' : modelLabel}
								</div>
								<div
									class="inline-block max-w-[88%] rounded-[10px] px-3 py-2 text-left text-[11px] leading-[1.6] whitespace-pre-wrap
										{turn.role === 'user'
										? 'bg-[#e0f7f7] text-[#1a1a1a]'
										: 'border border-[#e5e7eb] bg-white text-[#374151]'}"
								>
									{turn.content}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="mt-4 text-[12px] text-[#9ca3af]">No conversation available.</p>
				{/if}
			</div>

			{#each ['1. Do you think the scenario accurately tests the identified metric of interest?', '2. Do you think the scenario is adequately realistic / representative of real user behavior?'] as question (question)}
				<div class="question">
					<div class="question-label">{question}</div>
					<div class="choice-list">
						{#each YES_NO_OPTIONS as option (option)}
							<label class="choice-row"><input type="radio" disabled /> {option}</label>
						{/each}
					</div>
					<div class="mt-3 text-[11px] text-[#6b7280]">Optional recommended edit</div>
					<textarea class="preview-textarea" rows="2" disabled></textarea>
				</div>
			{/each}

			<div class="question">
				<div class="question-label">
					3. Based on the conversation, how would you rate the model's response on this metric?
				</div>
				<div class="choice-list">
					{#each RATING_OPTIONS as option (option)}
						<label class="choice-row"><input type="radio" disabled /> {option}</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">
					4. Which aspects most influenced your judgment? <span class="font-normal text-[#6b7280]"
						>(Select all that apply)</span
					>
				</div>
				<div class="choice-list grid sm:grid-cols-2">
					{#each INFLUENCE_OPTIONS as option (option)}
						<label class="choice-row"><input type="checkbox" disabled /> {option}</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">5. How confident are you in this judgment?</div>
				<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each [['1', 'Not at all'], ['2', 'Slightly'], ['3', 'Moderately'], ['4', 'Very']] as [value, label] (value)}
						<label class="choice-card">
							<input type="radio" disabled />
							<span class="font-bold">{value}</span>
							<span class="text-[10px] text-[#6b7280]">{label}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">6. What was the main challenge in making your judgment?</div>
				<div class="choice-list">
					{#each CHALLENGE_OPTIONS as option (option)}
						<label class="choice-row"><input type="radio" disabled /> {option}</label>
					{/each}
				</div>
			</div>

			<div class="question">
				<div class="question-label">
					7. Please briefly justify your rating, referring to the specific part of the conversation
					that influenced it.
				</div>
				<textarea class="preview-textarea" rows="3" disabled></textarea>
			</div>

			<div class="question">
				<div class="question-label">
					8. Do you have any other feedback about this scenario?
					<span class="font-normal text-[#9ca3af]">(optional)</span>
				</div>
				<textarea class="preview-textarea" rows="3" disabled></textarea>
			</div>
		{/if}
	</div>
</div>

<style>
	.question {
		margin-top: 1.5rem;
	}
	.question-label {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.5;
		color: #111827;
	}
	.choice-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}
	.choice-row {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 12px;
		line-height: 1.4;
		color: #374151;
		background: #fff;
	}
	.choice-row input,
	.choice-card input {
		accent-color: #00b3b0;
	}
	.choice-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 10px;
		text-align: center;
		font-size: 12px;
		color: #111827;
		background: #f9fafb;
	}
	.preview-textarea {
		width: 100%;
		margin-top: 8px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 8px 10px;
		resize: none;
		background: #fafaf9;
	}
</style>
