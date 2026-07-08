<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { buildHierarchy, getScoresForFilter } from '$lib/data';
	import Sunburst from '../organisms/Sunburst.svelte';
	import ControlBar from '../molecules/ControlBar.svelte';
	import FeedbackSurveyModal from '../organisms/FeedbackSurveyModal.svelte';

	interface Props {
		onEnter: () => void;
		onTabChange?: (tab: string) => void;
		isAuthenticated?: boolean;
		showPasswordOnMount?: boolean;
		/**
		 * Incremented by the parent to request the password modal to open
		 * (e.g. when the user clicks a locked tab in the header while the
		 * gate page is already mounted).
		 */
		passwordRequestNonce?: number;
	}

	let {
		onEnter,
		onTabChange,
		isAuthenticated = false,
		showPasswordOnMount = false,
		passwordRequestNonce = 0
	}: Props = $props();

	const hierarchyData = $derived(
		appState.taxonomy && !appState.loading
			? buildHierarchy(
					appState.taxonomy,
					getScoresForFilter(appState.benchmarkData, appState.filters)
				)
			: null
	);

	let activeTab = $state<'request' | 'expert' | 'support' | 'feedback'>('request');
	let pwVisible = $state(showPasswordOnMount);
	let pwValue = $state('');
	let pwError = $state(false);

	// React to external requests to open the password modal (e.g. user clicks
	// a locked tab in the header while already on the gate page). The parent
	// increments `passwordRequestNonce` each time it wants to (re)open it.
	let _seenPwNonce = $state(0);
	$effect(() => {
		const n = passwordRequestNonce;
		if (n > 0 && n !== _seenPwNonce && !isAuthenticated) {
			_seenPwNonce = n;
			pwVisible = true;
			pwError = false;
			pwValue = '';
		}
	});

	const ROTATOR_PHRASES = [
		'as a therapist impact mental health',
		'for emotional support shape loneliness',
		'as a daily companion affect anxiety',
		'in friendships change how teens connect',
		'in dating apps reshape relationships',
		'in family conversations affect trust',
		"in the classroom impact students' learning",
		'in hiring affect equal opportunity',
		'in journalism shape what we believe'
	];

	const TYPE_MS = 38;
	const ERASE_MS = 18;
	const HOLD_MS = 1800;

	let rotatorText = $state('');

	$effect(() => {
		let cancelled = false;
		let idx = 0;

		function typeIn(text: string, done: () => void) {
			let i = 0;
			(function step() {
				if (cancelled) return;
				if (i <= text.length) {
					rotatorText = text.slice(0, i);
					i++;
					setTimeout(step, TYPE_MS);
				} else {
					setTimeout(done, HOLD_MS);
				}
			})();
		}

		function eraseOut(done: () => void) {
			if (cancelled) return;
			const snapshot = rotatorText;
			let i = snapshot.length;
			(function step() {
				if (cancelled) return;
				if (i >= 0) {
					rotatorText = snapshot.slice(0, i);
					i--;
					setTimeout(step, ERASE_MS);
				} else {
					done();
				}
			})();
		}

		function loop() {
			if (cancelled) return;
			typeIn(ROTATOR_PHRASES[idx], () => {
				eraseOut(() => {
					idx = (idx + 1) % ROTATOR_PHRASES.length;
					loop();
				});
			});
		}

		loop();
		return () => {
			cancelled = true;
		};
	});

	function tryUnlock() {
		if (pwValue === 'flourishing') {
			if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('aib-auth', '1');
			pwVisible = false;
			onEnter();
		} else {
			pwError = true;
			pwValue = '';
		}
	}

	function openPwModal() {
		pwVisible = true;
		pwError = false;
		pwValue = '';
	}

	function closePwModal() {
		pwVisible = false;
		pwError = false;
		pwValue = '';
	}

	function onPwBackdropKey(e: KeyboardEvent) {
		if (e.key === 'Escape') closePwModal();
	}

	function goRequestFromModal(e: MouseEvent) {
		e.preventDefault();
		closePwModal();
		openTab('request');
	}

	const APPS_SCRIPT_URL =
		'https://script.google.com/macros/s/AKfycbzreHbqgqwXZVM1Lgm_Uw93xakvLi9dcqKsrwQThNM-dJGrGjDn76TcCQ8XniALwWKs/exec';

	let formStates = $state({
		request: 'idle',
		expert: 'idle',
		support: 'idle',
		feedback: 'idle'
	} as Record<string, string>);

	const EXPERTISE_SUBAREAS: { id: string; label: string }[] = [
		{ id: 'safety-protection', label: 'Safety & Protection' },
		{ id: 'social-relationships', label: 'Social Relationships' },
		{ id: 'education-career-finance', label: 'Education, Career & Finance' },
		{ id: 'mental-wellbeing', label: 'Mental Wellbeing' },
		{ id: 'autonomy-preservation', label: 'Autonomy Preservation' },
		{ id: 'creativity-cognitive-expression', label: 'Creativity & Cognitive Expression' },
		{ id: 'self-determination', label: 'Self-Determination' },
		{ id: 'learning', label: 'Learning' }
	];

	let expertCvFile = $state<File | null>(null);
	let expertCvDragging = $state(false);

	function onExpertCvSelected(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		expertCvFile = input.files && input.files[0] ? input.files[0] : null;
	}

	function onExpertCvDrop(e: DragEvent) {
		e.preventDefault();
		expertCvDragging = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) expertCvFile = f;
	}

	function clearExpertCv() {
		expertCvFile = null;
		const input = document.getElementById('gex-cv') as HTMLInputElement | null;
		if (input) input.value = '';
	}

	let surveyVisible = $state(false);
	function openSurvey() {
		surveyVisible = true;
	}

	async function submitForm(
		formId: string,
		tabKey: 'request' | 'expert' | 'support' | 'feedback'
	) {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form || !form.checkValidity()) {
			form?.reportValidity();
			return;
		}
		const FORM_TYPE_LABELS: Record<string, string> = {
			request: 'Access',
			expert: 'Expert',
			support: 'Support',
			feedback: 'Feedback'
		};
		const data: Record<string, string> = { form_type: FORM_TYPE_LABELS[tabKey] ?? tabKey };
		for (const el of form.elements) {
			const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
			if (!input.name && !input.id) continue;
			const key = input.name || input.id;
			if (input.type === 'checkbox') data[key] = (input as HTMLInputElement).checked ? 'yes' : 'no';
			else if (input.type === 'file') {
				const f = (input as HTMLInputElement).files?.[0];
				data[key] = f ? f.name : '';
			} else data[key] = input.value;
		}
		formStates[tabKey] = 'loading';
		const params = new URLSearchParams(data).toString();
		try {
			await fetch(`${APPS_SCRIPT_URL}?${params}`, { method: 'GET', mode: 'no-cors' });
			formStates[tabKey] = 'success';
		} catch {
			formStates[tabKey] = 'idle';
		}
	}

	function openTab(tab: 'request' | 'expert' | 'support' | 'feedback') {
		activeTab = tab;
		const el = document.getElementById('gate-tabs-section');
		if (el) el.scrollIntoView({ behavior: 'smooth' });
		// Remove hash so navigating back tabs doesn't re-trigger scroll
		if (window.location.hash) history.replaceState(null, '', window.location.pathname);
	}

	const HASH_TAB_MAP: Record<string, 'request' | 'expert' | 'support' | 'feedback'> = {
		'#access': 'request',
		'#expert': 'expert',
		'#support': 'support',
		'#feedback': 'feedback',
		'#survey': 'feedback'
	};

	$effect(() => {
		(window as unknown as Record<string, unknown>).openGateTab = openTab;

		// Open the right tab if URL has a hash
		const hash = window.location.hash;
		if (hash && HASH_TAB_MAP[hash]) openTab(HASH_TAB_MAP[hash]);
		if (hash === '#survey') openSurvey();

		function onHashChange() {
			const h = window.location.hash;
			if (h && HASH_TAB_MAP[h]) openTab(HASH_TAB_MAP[h]);
			if (h === '#survey') openSurvey();
		}
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});

	const STATS = [
		{ num: '375', label: 'Metrics', desc: 'Tested across realistic scenarios.' },
		{ num: '14', label: 'AI Systems Evaluated', desc: 'Compared on the same standard.' },
		{
			num: '18',
			label: 'Expert-Submitted Benchmarks',
			desc: 'Spanning clinical, legal, and educational constructs.'
		},
		{ num: '3', label: 'Domains of Human Impact', desc: 'Physical, psychological, societal.' }
	];

	const SUPPORT_CARDS = [
		['fa-bullhorn', 'Advocacy', 'Spread the word and champion human-centered AI evaluation'],
		['fa-microscope', 'Research Collab', 'Co-develop benchmarks or contribute datasets'],
		[
			'fa-circle-dollar-to-slot',
			'Financial Support',
			'Philanthropic funding keeps our benchmarks open'
		],
		['fa-puzzle-piece', 'Other', 'All ideas for support and collaboration are welcome']
	];

	const PARTNER_LOGOS = [
		{ href: 'https://www.mit.edu/', src: '/images/MIT Logo.png', alt: 'MIT' },
		{ href: 'https://www.media.mit.edu/', src: '/images/ML logo.png', alt: 'MIT Media Lab' },
		{
			href: 'https://www.marshall.usc.edu/institutes-and-centers/neely-center-for-ethical-leadership-and-decision-making',
			src: '/images/usc.jpg',
			alt: 'USC Marshall – Neely Center for Ethical Leadership and Decision Making'
		},
		{
			href: 'https://www.psychoftech.org/',
			src: '/images/PTI+Logo+updated.webp',
			alt: 'Psychology of Technology Institute'
		},
		{
			href: 'https://haas.berkeley.edu/',
			src: '/images/UC-Berkeley-Haas-logo-digital_stacked-blue.png',
			alt: 'UC Berkeley Haas'
		}
	];
</script>

<div class="flex min-h-screen flex-col overflow-x-hidden bg-[#fafaf9]">
	<!-- Same nav bar as the explore page -->
	<ControlBar
		activeTab="home"
		{isAuthenticated}
		onTabChange={(tab) => {
			if (tab === 'home') return;
			onTabChange?.(tab);
		}}
		onSmartExplore={() => {
			onEnter();
		}}
	/>

	<!-- Hero -->
	<section
		class="relative m-0 flex w-full max-w-full flex-col items-center px-7 pt-7 pb-4 text-center"
	>
		<div class="relative z-[2] mx-auto w-full max-w-[820px] text-center">
			<h1 class="hero-title">
				Open Benchmark of<br />AI Impact on Humans
			</h1>

			<p
				class="mx-auto mb-2 min-h-[1.6em] max-w-[820px] text-[clamp(0.925rem,1.5vw,1.125rem)] leading-[1.55] font-medium text-[#374151]"
			>
				How does using AI
				<span class="inline-block font-semibold whitespace-nowrap text-[#111827]">
					<span aria-live="polite">{rotatorText}</span><span class="caret"></span>
				</span>?
			</p>

			<p
				class="max-w-[780px mx-auto mb-10 text-center text-[15px] leading-[1.47] text-balance text-[#4b5563]"
			>
				The first open benchmark measuring AI's impact on human well-being across physical,
				psychological, and societal dimensions.
			</p>

			<div class="mb-3 flex flex-wrap items-center justify-center gap-3">
				<button class="btn-primary" onclick={openPwModal}>
					<i class="fa-solid fa-chart-pie"></i> Explore Benchmark
				</button>
				<button class="btn-white" onclick={() => openTab('request')}>
					<i class="fa-solid fa-key"></i> Request Access
				</button>
				<button class="btn-white" onclick={() => onTabChange?.('about')}>
					<i class="fa-solid fa-file-lines"></i> About
				</button>
			</div>
		</div>
	</section>

	<!-- Sunburst visual -->
	<div class="gate-visual">
		<div id="gate-sunburst-wrapper">
			{#if hierarchyData}
				<Sunburst
					data={hierarchyData}
					gateMode={true}
					onSubareaClick={() => {}}
					onAreaClick={() => {}}
					onCenterClick={() => {}}
				/>
			{/if}
		</div>
	</div>

	<!-- Stats cards -->
	<section class="bg-transparent px-7 pt-10 pb-14">
		<div class="mx-auto grid max-w-[1200px] grid-cols-4 gap-4">
			{#each STATS as stat (stat.label)}
				<div class="stat-card">
					<div class="text-[2.4rem] leading-[1.05] font-[800] tracking-[-0.03em] text-[#111827]">
						{stat.num}
					</div>
					<div class="text-[11px] font-[700] tracking-[0.08em] text-[#6b7280] uppercase">
						{stat.label}
					</div>
					<p class="mt-1 text-[14px] leading-[1.5] text-[#4b5563]">{stat.desc}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- Rationale & Methodology -->
	<section class="bg-[#fafaf9] px-7 py-16">
		<div class="mx-auto grid max-w-[1100px] grid-cols-2 gap-12">
			<div class="flex flex-col gap-4">
				<h2 class="section-title">Measuring AI's impact on people</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					Today's AI benchmarks measure what models can do: accuracy, reasoning, task completion.
					They say almost nothing about what AI does to the people who rely on it. Two models with
					identical capability scores can shape a user's autonomy, mental health, and relationships
					in completely different ways, and the field has had no shared way to tell them apart.
					ImpactBench is built to answer a different question: across realistic, multi-turn
					conversations, does an AI system support or undermine human flourishing?
				</p>
			</div>

			<div class="flex flex-col gap-4">
				<h2 class="section-title">Introducing ImpactBench</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					ImpactBench evaluates 14 leading AI systems against 18 expert-submitted benchmarks
					spanning physical, psychological, and societal impact. Each construct is contributed by
					clinicians, educators, legal scholars, and community advocates through an open submission
					process, then tested through multi-turn adversarial simulation with demographically
					stratified personas: the way harms actually unfold in real conversations, not in isolated
					prompts. Every score is paired with reliability checks so users can see not just what we
					found, but how much to trust it.
				</p>
			</div>
		</div>

		<div class="mx-auto mt-12 grid max-w-[1100px] grid-cols-2 gap-12">
			<div class="flex flex-col gap-4">
				<h2 class="section-title">Explore ImpactBench flexibly</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					The Explore page lets you move from aggregate scores down to the underlying evidence:
					compare models across the three impact domains, drill into specific constructs like
					emotional dependence or cognitive autonomy, and read the actual multi-turn transcripts
					behind any verdict.
				</p>
				<img
					src="/impactbench9.png"
					alt="Explore page showing model comparisons across impact domains"
					class="block h-auto w-full"
				/>
			</div>

			<div class="flex flex-col gap-4">
				<h2 class="section-title">Nutritional labels for AI</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					ImpactBench generates AI nutrition labels, which are at-a-glance summaries of a model's
					impact across nine categories, from avoiding harms like hallucination and toxicity to
					promoting benefits like learning, creativity, and wellbeing. Whether you're a parent
					evaluating a companion app or an educator choosing a tutoring tool, you can understand and
					share a model's performance in seconds.
				</p>
				<img
					src="/homepage_nutritionlabel.jpg"
					alt="Personalized ImpactBench nutrition label"
					class="block h-auto w-full"
				/>
			</div>
		</div>
	</section>

	<!-- Tabbed forms -->
	<section class="scroll-mt-[92px] bg-white px-7 pt-10 pb-20" id="gate-tabs-section">
		<div class="mx-auto max-w-[880px]">
			<!-- Tab nav -->
			<div
				class="mb-7 flex w-full flex-wrap gap-1 rounded-[12px] bg-[#f3f4f6] p-1"
				role="tablist"
			>
				{#each [['request', 'fa-key', 'Request Access'], ['expert', 'fa-user-check', 'Be an Expert'], ['support', 'fa-hand-holding-heart', 'Support Benchmarking Efforts'], ['feedback', 'fa-comment-dots', 'Feedback']] as [tab, icon, label] (tab)}
					<button
						class="inline-flex min-w-0 flex-auto cursor-pointer items-center justify-center gap-2 rounded-[8px] border-none px-3 py-[8px] text-[13px] font-semibold whitespace-nowrap transition-all duration-[180ms]
							{activeTab === tab
							? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_rgba(15,23,42,0.06)]'
							: 'bg-transparent text-[#6b7280] hover:text-[#111827]'}"
						onclick={() => (activeTab = tab as typeof activeTab)}
					>
						<i class="fa-solid {icon} text-[12px] opacity-90"></i>
						{label}
					</button>
				{/each}
			</div>

			<!-- Request Access -->
			{#if activeTab === 'request'}
				<div>
					<h2 class="form-section-title">Request Access</h2>
					<p class="form-section-desc">
						The full benchmark dataset and evaluation API are available to vetted researchers and
						institutions.
					</p>
					<div class="form-card">
						{#if formStates.request === 'success'}
							<div class="px-5 py-10 text-center">
								<div class="mb-4 text-[3rem]">✅</div>
								<h3 class="m-0 mb-2 text-[1.25rem] font-bold text-[#111827]">Request received!</h3>
								<p class="m-0 text-[14px] text-[#6b7280]">
									We'll be in touch within 5 business days.
								</p>
							</div>
						{:else}
							<form
								id="gate-access-form"
								class="flex flex-col gap-5"
								novalidate
								onsubmit={(e) => {
									e.preventDefault();
									submitForm('gate-access-form', 'request');
								}}
							>
								<div class="grid grid-cols-2 gap-4">
									<div class="form-group">
										<label class="form-label" for="gac-name"
											>Full name <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="text"
											id="gac-name"
											placeholder="Dr. Jane Smith"
											required
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="gac-email"
											>Email <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="email"
											id="gac-email"
											placeholder="you@institution.edu"
											required
										/>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-4">
									<div class="form-group">
										<label class="form-label" for="gac-affiliation"
											>Institution <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="text"
											id="gac-affiliation"
											placeholder="MIT Media Lab"
											required
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="gac-role"
											>Role <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="text"
											id="gac-role"
											placeholder="Assistant Professor"
											required
										/>
									</div>
								</div>
								<div class="form-group">
									<label class="form-label" for="gac-use"
										>How do you plan to use the benchmark? <span class="text-[#dc2626]">*</span
										></label
									>
									<textarea
										class="form-input min-h-[100px] resize-y leading-[1.6]"
										id="gac-use"
										rows="3"
										placeholder="Describe your research goals…"
										required
									></textarea>
								</div>
								<button
									type="submit"
									class="btn-submit"
									disabled={formStates.request === 'loading'}
								>
									{#if formStates.request === 'loading'}
										<i class="fa-solid fa-spinner fa-spin"></i> Submitting…
									{:else}
										<i class="fa-solid fa-paper-plane"></i> Submit Request
									{/if}
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Be an Expert -->
			{:else if activeTab === 'expert'}
				<div>
					<h2 class="form-section-title">Be an Expert</h2>
					<p class="form-section-desc">
						Share your domain expertise so we can invite you to help evaluate AI systems on the
						impact areas you know best. Reviewers are matched to specific metrics based on the
						subareas of expertise selected below.
					</p>
					<div class="form-card">
						{#if formStates.expert === 'success'}
							<div class="px-5 py-10 text-center">
								<div class="mb-4 text-[3rem]">🧠</div>
								<h3 class="m-0 mb-2 text-[1.25rem] font-bold text-[#111827]">Thank you!</h3>
								<p class="m-0 text-[14px] text-[#6b7280]">
									We'll review your submission and reach out about matching metrics.
								</p>
							</div>
						{:else}
							<form
								id="gate-expert-form"
								class="flex flex-col gap-6"
								novalidate
								onsubmit={(e) => {
									e.preventDefault();
									submitForm('gate-expert-form', 'expert');
								}}
							>
								<div class="form-group">
									<label class="form-label" for="gex-name"
										>Full name <span class="text-[#dc2626]">*</span></label
									>
									<input
										class="form-input"
										type="text"
										id="gex-name"
										name="full_name"
										autocomplete="name"
										required
									/>
								</div>

								<div class="form-group">
									<label class="form-label" for="gex-email"
										>E-mail address <span class="text-[#dc2626]">*</span></label
									>
									<input
										class="form-input"
										type="email"
										id="gex-email"
										name="email"
										autocomplete="email"
										required
									/>
								</div>

								<div class="form-group">
									<label class="form-label" for="gex-job"
										>Job title <span class="text-[#dc2626]">*</span></label
									>
									<input
										class="form-input"
										type="text"
										id="gex-job"
										name="job_title"
										autocomplete="organization-title"
										required
									/>
								</div>

								<div class="form-group">
									<label class="form-label" for="gex-website"
										>Website <span class="font-normal text-[#9ca3af]">(if applicable)</span></label
									>
									<input
										class="form-input"
										type="url"
										id="gex-website"
										name="website"
										placeholder="https://"
										autocomplete="url"
									/>
								</div>

								<div class="form-group">
									<span class="form-label"
										>CV upload <span class="font-normal text-[#9ca3af]">(if applicable)</span></span
									>
									<label
										for="gex-cv"
										class="cv-dropzone {expertCvDragging ? 'is-dragging' : ''}"
										ondragover={(e) => {
											e.preventDefault();
											expertCvDragging = true;
										}}
										ondragleave={() => (expertCvDragging = false)}
										ondrop={onExpertCvDrop}
									>
										{#if expertCvFile}
											<span class="cv-dropzone-filename">{expertCvFile.name}</span>
											<button
												type="button"
												class="cv-dropzone-clear"
												onclick={(e) => {
													e.preventDefault();
													clearExpertCv();
												}}>Remove</button
											>
										{:else}
											<span>Drop files or click here to upload</span>
										{/if}
										<input
											id="gex-cv"
											name="cv_filename"
											type="file"
											accept=".pdf,.doc,.docx"
											class="sr-only"
											onchange={onExpertCvSelected}
										/>
									</label>
								</div>

								<div class="form-group">
									<span class="form-label"
										>Areas of expertise <span class="font-normal text-[#6b7280]"
											>(feel free to select multiple areas)</span
										></span
									>
									<div class="flex flex-col gap-2">
										{#each EXPERTISE_SUBAREAS as area (area.id)}
											<label class="expertise-check">
												<input type="checkbox" name={`expertise_${area.id}`} />
												<span>{area.label}</span>
											</label>
										{/each}
									</div>
								</div>

								<div class="form-group">
									<label class="form-label" for="gex-expertise"
										>What makes you an expert in the topic(s) you selected above? Describe your
										expertise, including any relevant educational degrees and work experience:
										<span class="text-[#dc2626]">*</span></label
									>
									<textarea
										class="form-input min-h-[120px] resize-y leading-[1.6]"
										id="gex-expertise"
										name="expertise_description"
										rows="4"
										required
									></textarea>
								</div>

								<button
									type="submit"
									class="btn-submit"
									disabled={formStates.expert === 'loading'}
								>
									{#if formStates.expert === 'loading'}
										<i class="fa-solid fa-spinner fa-spin"></i> Submitting…
									{:else}
										<i class="fa-solid fa-paper-plane"></i> Submit
									{/if}
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Support -->
			{:else if activeTab === 'support'}
				<div>
					<h2 class="form-section-title">Support Benchmarking Efforts</h2>
					<p class="form-section-desc">
						Help us build an open, independent standard for understanding AI models' impacts on
						human flourishing.
					</p>
					<p class="mt-[-24px] mb-7 text-[15px] leading-[1.6] text-[#6b7280]">
						For more information on how to submit your own benchmark, <a
							href="https://www.media.mit.edu/projects/the-open-benchmark-for-the-human-impact-of-ai/overview/"
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium text-[#038d8f] no-underline hover:text-[#00b3b0]">click here</a
						>
					</p>
					<div class="mb-7 grid grid-cols-2 gap-3">
						{#each SUPPORT_CARDS as [icon, title, desc] (title)}
							<div class="flex flex-col gap-1 rounded-[10px] border border-[#e5e7eb] bg-white p-4">
								<i class="fa-solid {icon} mb-1 text-[18px] text-[#00b3b0]"></i>
								<strong class="text-[13px] font-bold text-[#111827]">{title}</strong>
								<span class="text-[12px] leading-[1.4] text-[#6b7280]">{desc}</span>
							</div>
						{/each}
					</div>
					<div class="form-card">
						{#if formStates.support === 'success'}
							<div class="px-5 py-10 text-center">
								<div class="mb-4 text-[3rem]">🌱</div>
								<h3 class="m-0 mb-2 text-[1.25rem] font-bold text-[#111827]">Thank you!</h3>
								<p class="m-0 text-[14px] text-[#6b7280]">We'll be in touch soon.</p>
							</div>
						{:else}
							<form
								id="gate-support-form"
								class="flex flex-col gap-5"
								novalidate
								onsubmit={(e) => {
									e.preventDefault();
									submitForm('gate-support-form', 'support');
								}}
							>
								<div class="grid grid-cols-2 gap-4">
									<div class="form-group">
										<label class="form-label" for="gsp-name"
											>Name <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="text"
											id="gsp-name"
											placeholder="Your full name"
											required
										/>
									</div>
									<div class="form-group">
										<label class="form-label" for="gsp-contact"
											>Contact <span class="text-[#dc2626]">*</span></label
										>
										<input
											class="form-input"
											type="text"
											id="gsp-contact"
											placeholder="Email or phone"
											required
										/>
									</div>
								</div>
								<div class="form-group">
									<label class="form-label" for="gsp-affiliation">Affiliation</label>
									<input
										class="form-input"
										type="text"
										id="gsp-affiliation"
										placeholder="Organization or institution"
									/>
								</div>
								<div class="form-group">
									<label class="form-label" for="gsp-how"
										>How would you like to support our work? <span class="text-[#dc2626]">*</span
										></label
									>
									<textarea
										class="form-input min-h-[100px] resize-y leading-[1.6]"
										id="gsp-how"
										rows="3"
										placeholder="Describe your ideas…"
										required
									></textarea>
								</div>
								<button
									type="submit"
									class="btn-submit bg-[#16a34a] hover:bg-[#15803d]"
									disabled={formStates.support === 'loading'}
								>
									{formStates.support === 'loading' ? 'Submitting…' : 'Submit'}
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Feedback -->
			{:else}
				<div>
					<h2 class="form-section-title">Feedback</h2>
					<div
						class="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-[#99e7e5] bg-[#e6f9f8] px-5 py-4"
					>
						<p class="m-0 text-[15px] leading-[1.5] text-[#0f4f50]">
							Help us learn what information's most helpful for you.
						</p>
						<button
							type="button"
							class="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-[10px] border-none bg-gradient-to-br from-[#00b3b0] to-[#038d8f] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(3,141,143,0.25)] transition-[filter,box-shadow] duration-150 hover:brightness-105"
							onclick={openSurvey}
						>
							<i class="fa-solid fa-clipboard-list"></i> Take survey
						</button>
					</div>
					<div class="form-card">
						{#if formStates.feedback === 'success'}
							<div class="px-5 py-10 text-center">
								<div class="mb-4 text-[3rem]">🎉</div>
								<h3 class="m-0 mb-2 text-[1.25rem] font-bold text-[#111827]">Thank you!</h3>
								<p class="m-0 text-[14px] text-[#6b7280]">We read every submission.</p>
							</div>
						{:else}
							<form
								id="gate-feedback-form"
								class="flex flex-col gap-5"
								novalidate
								onsubmit={(e) => {
									e.preventDefault();
									submitForm('gate-feedback-form', 'feedback');
								}}
							>
								<div class="form-group">
									<label class="form-label" for="gfb-topic"
										>Topic <span class="text-[#dc2626]">*</span></label
									>
									<select class="form-input form-select" id="gfb-topic" required>
										<option value="">Select a topic…</option>
										<option>Benchmark methodology</option>
										<option>Data accuracy or scores</option>
										<option>Visualization / UI</option>
										<option>Missing AI model</option>
										<option>Missing benchmark dimension</option>
										<option>Other</option>
									</select>
								</div>
								<div class="form-group">
									<label class="form-label" for="gfb-message"
										>Your feedback <span class="text-[#dc2626]">*</span></label
									>
									<textarea
										class="form-input min-h-[100px] resize-y leading-[1.6]"
										id="gfb-message"
										rows="4"
										placeholder="Tell us what you think…"
										required
									></textarea>
								</div>
								<div class="form-group">
									<label class="form-label" for="gfb-email"
										>Email <span class="font-normal text-[#9ca3af]">(optional)</span></label
									>
									<input
										class="form-input"
										type="email"
										id="gfb-email"
										placeholder="you@example.com"
									/>
								</div>
								<button
									type="submit"
									class="btn-submit"
									disabled={formStates.feedback === 'loading'}
								>
									{formStates.feedback === 'loading' ? 'Submitting…' : 'Send Feedback'}
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- Partner logos -->
	<section class="bg-white px-7 pt-2 pb-16 text-center">
		<p
			class="mx-auto mb-6 max-w-[880px] text-[13px] leading-[1.6] tracking-[0.01em] text-[#6b7280]"
		>
			Led by researchers at
		</p>
		<div class="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-8">
			{#each PARTNER_LOGOS as logo (logo.alt)}
				{#if logo.href}
					<a href={logo.href} target="_blank" rel="noopener noreferrer">
						<img src={logo.src} alt={logo.alt} class="partner-logo" />
					</a>
				{:else}
					<img src={logo.src} alt={logo.alt} class="partner-logo" />
				{/if}
			{/each}
		</div>
	</section>

	<!-- Footer -->
	<footer
		class="mt-auto flex flex-wrap items-center justify-center gap-x-[10px] gap-y-1 bg-white px-7 py-5 text-center text-[12px] text-[#111827]"
	>
		<span>© 2026 <a class="underline" href="https://media.mit.edu"> MIT Media Lab</a></span>
		<span>·</span>
		<span><a class="underline" href="https://accessibility.mit.edu/">Accessibility</a></span>
		<span>·</span>
		<span
			><a class="underline" href="https://docs.impactbench.cyborglab.org/">Documentation</a></span
		>
		<span>·</span>
		<span>77 Massachusetts Ave, Cambridge, MA 02139, USA</span>
	</footer>
</div>

{#if pwVisible}
	<div
		class="pw-modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pw-modal-title"
		tabindex="-1"
		onclick={closePwModal}
		onkeydown={onPwBackdropKey}
	>
		<div
			class="pw-modal"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="pw-modal-close" aria-label="Close" onclick={closePwModal}>×</button>
			<h2 id="pw-modal-title" class="pw-modal-title">Enter password</h2>
			<p class="pw-modal-subtitle">
				Don't have a password?
				<a href="#access" class="pw-modal-link" onclick={goRequestFromModal}>Request access</a>.
			</p>
			<div class="pw-modal-row">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="password"
					class="pw-modal-input"
					class:is-error={pwError}
					placeholder="Enter password…"
					autofocus
					bind:value={pwValue}
					onkeydown={(e) => {
						if (e.key === 'Enter') tryUnlock();
					}}
				/>
				<button class="pw-modal-submit" onclick={tryUnlock}>→</button>
			</div>
			{#if pwError}
				<p class="pw-modal-error">Incorrect password. Try again.</p>
			{/if}
		</div>
	</div>
{/if}

<FeedbackSurveyModal bind:open={surveyVisible} onClose={() => (surveyVisible = false)} />

<style>
	/* Serif title for hero — font-weight 550 not a Tailwind token */
	.hero-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: clamp(2.6rem, 4.6vw, 3.6rem);
		font-weight: 550;
		line-height: 1.04;
		color: #111827;
		margin: 28px auto;
		letter-spacing: -0.015em;
		text-align: center;
	}

	/* Blinking caret */
	.caret {
		display: inline-block;
		width: 2px;
		height: 1.05em;
		margin-left: 2px;
		vertical-align: text-bottom;
		background: #111827;
		animation: caretBlink 1s steps(2) infinite;
	}
	@keyframes caretBlink {
		0%,
		49% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
	}

	/* Sunburst visual bubble */
	.gate-visual {
		position: relative;
		margin: 24px auto 0;
		width: min(880px, 92vh);
		aspect-ratio: 1 / 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fff;
		border-radius: 50%;
		padding: 4px;
		box-shadow:
			0 1px 2px rgba(15, 23, 42, 0.04),
			0 10px 32px rgba(15, 23, 42, 0.07);
	}

	#gate-sunburst-wrapper {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: scale(1.23);
		transform-origin: center center;
	}

	#gate-sunburst-wrapper :global(#sunburst-svg) {
		max-height: none !important;
	}

	/* Wheel is decorative on the homepage — disable click affordance */
	#gate-sunburst-wrapper :global(.arc-path) {
		cursor: default !important;
	}

	/* Stat card hover */
	.stat-card {
		padding: 28px 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: #fff;
		border-radius: 14px;
		box-shadow:
			0 1px 2px rgba(15, 23, 42, 0.04),
			0 6px 18px rgba(15, 23, 42, 0.05);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow:
			0 1px 2px rgba(15, 23, 42, 0.04),
			0 12px 28px rgba(15, 23, 42, 0.08);
	}

	/* Section serif headings */
	.section-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: 1.75rem;
		font-weight: 550;
		color: #111827;
		letter-spacing: -0.012em;
		margin: 0;
	}

	/* CTA buttons */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 28px;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(3, 141, 143, 0.25);
		transition:
			filter 0.15s,
			transform 0.1s,
			box-shadow 0.15s;
	}
	.btn-primary:hover {
		filter: brightness(1.06);
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(3, 141, 143, 0.35);
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 24px;
		background: none;
		color: #374151;
		border: 1.5px solid #d1d5db;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition:
			border-color 0.15s,
			color 0.15s,
			transform 0.1s;
	}
	.btn-secondary:hover {
		border-color: #00b3b0;
		color: #00b3b0;
		transform: translateY(-1px);
	}

	.btn-white {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 13px 24px;
		background: #ffffff;
		color: #374151;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.02),
			0 1px 2px rgba(0, 0, 0, 0.02);
		transition:
			color 0.15s,
			transform 0.1s,
			box-shadow 0.15s;
	}
	.btn-white:hover {
		color: #00b3b0;
		transform: translateY(-1px);
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.04),
			0 1px 2px rgba(0, 0, 0, 0.03);
	}

	:global(.pw-modal-overlay) {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(17, 24, 39, 0.35);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	:global(.pw-modal) {
		background: #ffffff;
		border-radius: 16px;
		padding: 28px 28px 24px;
		width: 100%;
		max-width: 420px;
		box-shadow:
			0 20px 50px rgba(0, 0, 0, 0.15),
			0 8px 20px rgba(0, 0, 0, 0.08);
		position: relative;
		font-family: inherit;
	}
	:global(.pw-modal-title) {
		margin: 0 0 6px;
		font-size: 18px;
		font-weight: 700;
		color: #111827;
	}
	:global(.pw-modal-subtitle) {
		margin: 0 0 18px;
		font-size: 14px;
		color: #6b7280;
		line-height: 1.5;
	}
	:global(.pw-modal-link) {
		color: #00b3b0;
		text-decoration: underline;
		cursor: pointer;
		font-weight: 600;
	}
	:global(.pw-modal-link:hover) {
		color: #038d8f;
	}
	:global(.pw-modal-row) {
		display: flex;
		gap: 8px;
	}
	:global(.pw-modal-input) {
		flex: 1;
		border-radius: 10px;
		border: 1.5px solid #d1d5db;
		background: #ffffff;
		padding: 12px 14px;
		font-size: 15px;
		color: #111827;
		outline: none;
		transition: border-color 0.15s;
		font-family: inherit;
	}
	:global(.pw-modal-input:focus) {
		border-color: #00b3b0;
	}
	:global(.pw-modal-input.is-error) {
		border-color: #dc2626;
	}
	:global(.pw-modal-submit) {
		cursor: pointer;
		border-radius: 10px;
		border: none;
		background: linear-gradient(135deg, #00b3b0, #038d8f);
		color: #ffffff;
		padding: 12px 18px;
		font-size: 16px;
		box-shadow: 0 2px 8px rgba(3, 141, 143, 0.25);
		transition:
			filter 0.15s,
			box-shadow 0.15s;
	}
	:global(.pw-modal-submit:hover) {
		filter: brightness(1.06);
		box-shadow: 0 3px 12px rgba(3, 141, 143, 0.35);
	}
	:global(.pw-modal-error) {
		margin: 8px 0 0;
		font-size: 13px;
		font-weight: 500;
		color: #dc2626;
	}
	:global(.pw-modal-close) {
		position: absolute;
		top: 10px;
		right: 12px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #6b7280;
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
	}
	:global(.pw-modal-close:hover) {
		color: #111827;
	}

	/* Form section headings */
	.form-section-title {
		font-family:
			'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: 2.1rem;
		font-weight: 550;
		color: #111827;
		margin: 0 0 10px;
		letter-spacing: -0.012em;
	}

	.form-section-desc {
		font-size: 15px;
		color: #6b7280;
		margin: 0 0 28px;
		line-height: 1.6;
	}

	.form-card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		padding: 32px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-label {
		font-size: 13px;
		font-weight: 600;
		color: #111827;
	}

	.form-input {
		padding: 10px 13px;
		font-size: 14px;
		font-family: inherit;
		color: #111827;
		background: #fafaf9;
		border: 1.5px solid #e5e7eb;
		border-radius: 8px;
		outline: none;
		width: 100%;
		box-sizing: border-box;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.form-input:focus {
		border-color: #00b3b0;
		box-shadow: 0 0 0 3px rgba(0, 179, 176, 0.1);
	}

	.form-select {
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 36px;
	}

	.btn-submit {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 28px;
		background: #00b3b0;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		align-self: flex-start;
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.btn-submit:hover {
		background: #038d8f;
		transform: translateY(-1px);
	}
	.btn-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	/* Visually-hidden file input */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* CV drop zone */
	.cv-dropzone {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 96px;
		padding: 20px;
		border: 1.5px dashed #d1d5db;
		border-radius: 10px;
		background: #fafaf9;
		color: #6b7280;
		font-size: 14px;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s,
			color 0.15s;
	}
	.cv-dropzone:hover,
	.cv-dropzone.is-dragging {
		border-color: #00b3b0;
		background: #f0fbfa;
		color: #0f4f50;
	}
	.cv-dropzone-filename {
		font-weight: 600;
		color: #111827;
		word-break: break-all;
	}
	.cv-dropzone-clear {
		background: transparent;
		border: none;
		color: #dc2626;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 6px;
	}
	.cv-dropzone-clear:hover {
		background: #fef2f2;
	}

	/* Expertise checkbox rows */
	.expertise-check {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: 1.5px solid #e5e7eb;
		border-radius: 8px;
		background: #fafaf9;
		font-size: 14px;
		color: #111827;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.expertise-check:hover {
		border-color: #00b3b0;
		background: #f0fbfa;
	}
	.expertise-check input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: #00b3b0;
		cursor: pointer;
	}

	/* Partner logos */
	.partner-logo {
		height: 47px;
		max-width: 180px;
		width: auto;
		object-fit: contain;
		filter: grayscale(20%);
		opacity: 0.85;
		transition:
			opacity 0.2s ease,
			filter 0.2s ease;
	}
	.partner-logo:hover {
		opacity: 1;
		filter: grayscale(0%);
	}
</style>
