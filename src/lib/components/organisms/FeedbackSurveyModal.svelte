<script lang="ts">
	interface Props {
		open: boolean;
		onClose: () => void;
	}
	let { open = $bindable(), onClose }: Props = $props();

	const APPS_SCRIPT_URL =
		'https://script.google.com/macros/s/AKfycbzreHbqgqwXZVM1Lgm_Uw93xakvLi9dcqKsrwQThNM-dJGrGjDn76TcCQ8XniALwWKs/exec';

	const SURVEY_AREA_CAP = 3;

	const SURVEY_ROLES = [
		'Educator / teacher',
		'School administrator',
		'Clinician or mental-health professional',
		'Researcher / academic',
		'Policymaker or regulator',
		'Child-safety or youth advocate',
		'Legal professional',
		'Parent or caregiver',
		'Product / industry practitioner',
		'Journalist'
	];
	const SURVEY_EVAL_FOR = [
		'Children (under 13)',
		'Teens (13–17)',
		'Adults',
		'Older adults',
		'Myself',
		'A mixed population'
	];
	const SURVEY_CONTEXTS = [
		'Companion / emotional-support apps',
		'Tutoring or learning tools',
		'Mental-health chatbots',
		'General-purpose assistants',
		'Health information',
		'Legal or financial advice'
	];
	const SURVEY_AREAS = [
		'Mental wellbeing',
		'Emotional dependency',
		'Cognitive autonomy / not deskilling',
		'Child safety',
		'Health accuracy',
		'Legal & financial advice',
		'Fairness & bias',
		'Social relationships',
		'Self-determination',
		'Creativity & cognition'
	];
	const SURVEY_TIME = [
		'Under 2 min — just the headline',
		'~5 min — headline plus the areas I care about',
		'15+ min — I want to dig into transcripts'
	];
	const SURVEY_INTENT = [
		'Evaluating a specific product',
		'General research',
		'Writing / reporting',
		'Policy or advocacy work',
		'Curiosity'
	];

	let surveyState = $state<'idle' | 'loading' | 'success'>('idle');
	let surveyAreas = $state<string[]>([]);

	function close() {
		open = false;
		onClose?.();
	}
	function onBackdropKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
	function toggleArea(area: string, checked: boolean) {
		if (checked) {
			if (surveyAreas.includes(area)) return;
			if (surveyAreas.length >= SURVEY_AREA_CAP) return;
			surveyAreas = [...surveyAreas, area];
		} else {
			surveyAreas = surveyAreas.filter((a) => a !== area);
		}
	}

	async function submitSurvey(e: SubmitEvent) {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}
		const data: Record<string, string> = { form_type: 'Survey' };
		const fd = new FormData(form);
		for (const [k, v] of fd.entries()) {
			if (typeof v !== 'string') continue;
			data[k] = data[k] ? `${data[k]}; ${v}` : v;
		}
		data['impact_areas'] = surveyAreas.join('; ');
		surveyState = 'loading';
		const params = new URLSearchParams(data).toString();
		try {
			await fetch(`${APPS_SCRIPT_URL}?${params}`, { method: 'GET', mode: 'no-cors' });
			surveyState = 'success';
		} catch {
			surveyState = 'idle';
		}
	}
</script>

{#if open}
	<div
		class="survey-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="survey-modal-title"
		tabindex="-1"
		onclick={close}
		onkeydown={onBackdropKey}
	>
		<div
			class="survey-modal"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="survey-modal-close" aria-label="Close" onclick={close}>×</button>

			{#if surveyState === 'success'}
				<div class="px-5 py-16 text-center">
					<div class="mb-4 text-[3rem]">🙏</div>
					<h3 class="m-0 mb-2 text-[1.25rem] font-bold text-[#111827]">Thank you!</h3>
					<p class="m-0 text-[14px] text-[#6b7280]">Your responses help shape ImpactBench.</p>
				</div>
			{:else}
				<div class="survey-modal-header">
					<h2 id="survey-modal-title" class="survey-modal-title">Quick survey</h2>
					<p class="m-0 text-[14px] text-[#6b7280]">
						Help us learn what information's most helpful for you.
					</p>
				</div>

				<form
					id="gate-survey-form"
					class="survey-modal-body flex flex-col gap-6"
					novalidate
					onsubmit={submitSurvey}
				>
					<!-- Q1 Role -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							1. What's your role? <span class="text-[#dc2626]">*</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_ROLES as role (role)}
								<label class="survey-option">
									<input type="radio" name="role" value={role} required />
									<span>{role}</span>
								</label>
							{/each}
							<label class="survey-option survey-option-inline">
								<input type="radio" name="role" value="Other" />
								<span>Other</span>
								<input
									type="text"
									name="role_other"
									class="survey-inline-input"
									placeholder="Tell us…"
								/>
							</label>
						</div>
					</fieldset>

					<!-- Q2 Evaluating for -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							2. Who are you primarily evaluating AI for? <span class="text-[#dc2626]">*</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_EVAL_FOR as group (group)}
								<label class="survey-option">
									<input type="radio" name="evaluating_for" value={group} required />
									<span>{group}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Q3 Context -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							3. Context of use you care most about <span class="text-[#dc2626]">*</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_CONTEXTS as ctx (ctx)}
								<label class="survey-option">
									<input type="radio" name="context" value={ctx} required />
									<span>{ctx}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Q4 Impact areas (multi-select, cap 3) -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							4. Which impact areas matter most to you?
							<span class="text-[13px] font-normal text-[#6b7280]">
								(select up to {SURVEY_AREA_CAP} — {surveyAreas.length}/{SURVEY_AREA_CAP} chosen)
							</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_AREAS as area (area)}
								{@const checked = surveyAreas.includes(area)}
								{@const disabled = !checked && surveyAreas.length >= SURVEY_AREA_CAP}
								<label class="survey-option" class:opacity-50={disabled}>
									<input
										type="checkbox"
										{checked}
										{disabled}
										onchange={(e) =>
											toggleArea(area, (e.currentTarget as HTMLInputElement).checked)}
									/>
									<span>{area}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Q5 Open concern -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							5. What's your single biggest concern about AI's impact on people?
							<span class="text-[13px] font-normal text-[#6b7280]">(optional)</span>
						</legend>
						<textarea
							class="survey-textarea"
							name="biggest_concern"
							rows="3"
							placeholder="Share what's on your mind…"
						></textarea>
					</fieldset>

					<!-- Q6 5-point scale -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							6. How would you like ImpactBench to help you decide?
							<span class="text-[#dc2626]">*</span>
						</legend>
						<div class="survey-scale">
							{#each [1, 2, 3, 4, 5] as n (n)}
								<label class="survey-scale-option">
									<input type="radio" name="decision_pref" value={String(n)} required />
									<span>{n}</span>
								</label>
							{/each}
						</div>
						<div class="mt-2 flex justify-between gap-3 text-[12px] text-[#6b7280]">
							<span>Just give me a clear recommendation</span>
							<span class="text-center">Some of both</span>
							<span class="text-right">Give me the data, I'll judge</span>
						</div>
					</fieldset>

					<!-- Q7 Time -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							7. How much time do you have for this? <span class="text-[#dc2626]">*</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_TIME as t (t)}
								<label class="survey-option">
									<input type="radio" name="time_budget" value={t} required />
									<span>{t}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Q8 Intent (optional) -->
					<fieldset class="survey-fieldset">
						<legend class="survey-legend">
							8. What brought you here today?
							<span class="text-[13px] font-normal text-[#6b7280]">(optional)</span>
						</legend>
						<div class="flex flex-col gap-2">
							{#each SURVEY_INTENT as intent (intent)}
								<label class="survey-option">
									<input type="radio" name="intent" value={intent} />
									<span>{intent}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				</form>

				<div class="survey-modal-footer">
					<button type="button" class="survey-btn-cancel" onclick={close}>Cancel</button>
					<button
						type="submit"
						form="gate-survey-form"
						class="survey-btn-submit"
						disabled={surveyState === 'loading'}
					>
						{#if surveyState === 'loading'}
							<i class="fa-solid fa-spinner fa-spin"></i> Submitting…
						{:else}
							<i class="fa-solid fa-paper-plane"></i> Submit survey
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.survey-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}
	.survey-modal {
		background: #ffffff;
		border-radius: 16px;
		width: 100%;
		max-width: 640px;
		max-height: calc(100vh - 48px);
		display: flex;
		flex-direction: column;
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.25),
			0 8px 20px rgba(0, 0, 0, 0.15);
		position: relative;
		overflow: hidden;
	}
	.survey-modal-header {
		padding: 24px 28px 16px;
		border-bottom: 1px solid #f3f4f6;
	}
	.survey-modal-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: 1.6rem;
		font-weight: 550;
		color: #111827;
		margin: 0 0 6px;
		letter-spacing: -0.012em;
	}
	.survey-modal-body {
		padding: 20px 28px;
		overflow-y: auto;
		flex: 1 1 auto;
	}
	.survey-modal-footer {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
		padding: 14px 28px 18px;
		border-top: 1px solid #f3f4f6;
		background: #fafafa;
	}
	.survey-modal-close {
		position: absolute;
		top: 10px;
		right: 12px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #6b7280;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
		z-index: 1;
	}
	.survey-modal-close:hover {
		color: #111827;
	}
	.survey-fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	.survey-legend {
		display: block;
		font-size: 14px;
		font-weight: 600;
		color: #111827;
		margin-bottom: 10px;
		line-height: 1.45;
	}
	.survey-option {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		font-size: 14px;
		color: #111827;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.survey-option:hover {
		border-color: #99e7e5;
		background: #f5fdfd;
	}
	.survey-option input[type='radio'],
	.survey-option input[type='checkbox'] {
		accent-color: #038d8f;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.survey-option-inline {
		flex-wrap: wrap;
	}
	.survey-inline-input {
		flex: 1 1 200px;
		padding: 6px 10px;
		font-size: 13px;
		border-radius: 8px;
		border: 1px solid #d1d5db;
		background: #fff;
		color: #111827;
		outline: none;
	}
	.survey-inline-input:focus {
		border-color: #00b3b0;
	}
	.survey-textarea {
		width: 100%;
		min-height: 90px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid #d1d5db;
		background: #fff;
		font-size: 14px;
		line-height: 1.6;
		color: #111827;
		outline: none;
		resize: vertical;
		font-family: inherit;
	}
	.survey-textarea:focus {
		border-color: #00b3b0;
	}
	.survey-scale {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}
	.survey-scale-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px 0;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		color: #111827;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.survey-scale-option:hover {
		border-color: #99e7e5;
		background: #f5fdfd;
	}
	.survey-scale-option input {
		accent-color: #038d8f;
	}
	.survey-btn-cancel {
		padding: 10px 16px;
		border-radius: 10px;
		border: 1px solid #e5e7eb;
		background: #ffffff;
		color: #374151;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.survey-btn-cancel:hover {
		background: #f3f4f6;
	}
	.survey-btn-submit {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		border-radius: 10px;
		border: none;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #ffffff;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(3, 141, 143, 0.25);
		transition:
			filter 0.15s,
			box-shadow 0.15s;
	}
	.survey-btn-submit:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.survey-btn-submit:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
</style>
