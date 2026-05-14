<script lang="ts">
	import { appState } from '$lib/store.svelte';
	import { buildHierarchy, getScoresForFilter } from '$lib/data';
	import Sunburst from './Sunburst.svelte';
	import ControlBar from './ControlBar.svelte';

	interface Props {
		onEnter: () => void;
		onTabChange?: (tab: string) => void;
		isAuthenticated?: boolean;
	}

	let { onEnter, onTabChange, isAuthenticated = false }: Props = $props();

	const hierarchyData = $derived(
		appState.taxonomy && !appState.loading
			? buildHierarchy(
					appState.taxonomy,
					getScoresForFilter(appState.benchmarkData, appState.filters)
				)
			: null
	);

	let activeTab = $state<'request' | 'support' | 'feedback'>('request');
	let pwVisible = $state(false);
	let pwValue = $state('');
	let pwError = $state(false);

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
			onEnter();
		} else {
			pwError = true;
			pwValue = '';
		}
	}

	const APPS_SCRIPT_URL =
		'https://script.google.com/macros/s/AKfycbzreHbqgqwXZVM1Lgm_Uw93xakvLi9dcqKsrwQThNM-dJGrGjDn76TcCQ8XniALwWKs/exec';

	let formStates = $state({ request: 'idle', support: 'idle', feedback: 'idle' } as Record<
		string,
		string
	>);

	async function submitForm(formId: string, tabKey: 'request' | 'support' | 'feedback') {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form || !form.checkValidity()) {
			form?.reportValidity();
			return;
		}
		const data: Record<string, string> = { form: tabKey };
		for (const el of form.elements) {
			const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
			if (!input.name && !input.id) continue;
			const key = input.name || input.id;
			if (input.type === 'checkbox') data[key] = (input as HTMLInputElement).checked ? 'yes' : 'no';
			else data[key] = input.value;
		}
		formStates[tabKey] = 'loading';
		try {
			await fetch(APPS_SCRIPT_URL, {
				method: 'POST',
				mode: 'no-cors',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			formStates[tabKey] = 'success';
		} catch {
			formStates[tabKey] = 'idle';
		}
	}

	function openTab(tab: 'request' | 'support' | 'feedback') {
		activeTab = tab;
		const el = document.getElementById('gate-tabs-section');
		if (el) el.scrollIntoView({ behavior: 'smooth' });
		// Remove hash so navigating back tabs doesn't re-trigger scroll
		if (window.location.hash) history.replaceState(null, '', window.location.pathname);
	}

	const HASH_TAB_MAP: Record<string, 'request' | 'support' | 'feedback'> = {
		'#access': 'request',
		'#support': 'support',
		'#feedback': 'feedback'
	};

	$effect(() => {
		(window as unknown as Record<string, unknown>).openGateTab = openTab;

		// Open the right tab if URL has a hash
		const hash = window.location.hash;
		if (hash && HASH_TAB_MAP[hash]) openTab(HASH_TAB_MAP[hash]);

		function onHashChange() {
			const h = window.location.hash;
			if (h && HASH_TAB_MAP[h]) openTab(HASH_TAB_MAP[h]);
		}
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	});

	const STATS = [
		{ num: '260+', label: 'Behavioral Indicators', desc: 'Tested across realistic scenarios.' },
		{ num: '18+', label: 'AI Models Evaluated', desc: 'Compared on the same standard.' },
		{ num: '3', label: 'Well-being Dimensions', desc: 'Physical, psychological, societal.' },
		{ num: '4', label: 'Audience Groups', desc: 'Parents, educators, policymakers, developers.' }
	];

	const RATIONALE_POINTS = [
		'AI is being adopted faster than any technology in history, yet trust in AI companies is declining and the evidence base that would justify calibrated trust has not been built.',
		'Models that perform well on conventional safety benchmarks have still produced harmful user outcomes in over 70% of high-risk scenarios in controlled studies (Archiwaranguprok et al., 2025), and sycophantic dynamics establish preconditions for psychological dependency that single-turn evaluations cannot detect.',
		'Only 16% of reviewed AI benchmarks include any statistical testing of their measurement properties (Bean et al., 2025), and most operationalize contested constructs without precise definitions. This methodological gap becomes structural when the construct in question is human impact.',
		'Human-impact harms are relational and unfold over time. The highest-profile real-world cases emerged not from isolated prompts but from patterns developing across weeks of interaction, exactly the dynamics single-turn benchmarks systematically obscure.',
		'No existing benchmark spans the three domains where impact actually unfolds: physical (health, legal, financial decisions), psychological (emotional dependence, autonomy, character), and societal (cognitive offloading, bias, epistemic independence).',
		'Those best positioned to identify consequential harms, including clinicians, educators, legal scholars, and affected communities, often lack the technical expertise to build benchmarks, while those with technical expertise lack the domain grounding to identify the right constructs. The field needs infrastructure that decouples construct identification from benchmark construction.',
		'Developers, policymakers, clinicians, parents, and everyday users need a common signal they can trust, one produced openly and contestably rather than by the companies being evaluated.',
		'Human flourishing, grounded in eudaimonic psychology and capability theory, is the right north star for responsible AI, not task performance alone.'
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
		{ href: null, src: '/images/ML logo.png', alt: 'MIT Media Lab' },
		{ href: null, src: '/images/USC-Logo.png', alt: 'USC' },
		{ href: null, src: '/images/PTI+Logo+updated.webp', alt: 'Psychology of Technology Institute' },
		{
			href: null,
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
				<button class="btn-primary" onclick={() => openTab('request')}>
					<i class="fa-solid fa-key"></i> Request Access
				</button>
				<button class="btn-secondary" onclick={() => openTab('support')}>
					<i class="fa-solid fa-hand-holding-heart"></i> Support Us
				</button>
				<button
					class="btn-secondary"
					onclick={() => {
						pwVisible = !pwVisible;
						pwError = false;
					}}
				>
					<i class="fa-solid fa-lock-open"></i> Enter
				</button>
			</div>

			{#if pwVisible}
				<div class="mx-auto mt-3 flex max-w-[380px] flex-col items-stretch gap-2">
					<div class="flex gap-2">
						<input
							type="password"
							class="flex-1 rounded-[10px] border-[1.5px] bg-white px-4 py-3 text-[15px] text-[#111827] transition-colors outline-none"
							class:border-[#dc2626]={pwError}
							class:border-[#d1d5db]={!pwError}
							placeholder="Enter password…"
							bind:value={pwValue}
							onkeydown={(e) => {
								if (e.key === 'Enter') tryUnlock();
							}}
						/>
						<button
							class="cursor-pointer rounded-[10px] border-none bg-[#111827] px-4 py-3 text-[16px] text-white"
							onclick={tryUnlock}>→</button
						>
					</div>
					{#if pwError}
						<p class="m-0 text-[13px] font-medium text-[#dc2626]">Incorrect password. Try again.</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- Sunburst visual -->
	<div class="gate-visual">
		<div id="gate-sunburst-wrapper">
			{#if hierarchyData}
				<Sunburst
					data={hierarchyData}
					onSubareaClick={() => {
						onEnter();
					}}
					onAreaClick={() => {
						onEnter();
					}}
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
				<h2 class="section-title">The Rationale</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					Today's AI benchmarks measure what models can do: accuracy, reasoning, task completion.
					They tell us almost nothing about what AI does to the people who use it. Two models with
					identical capability scores can shape a user's autonomy, mental health, and relationships
					in fundamentally different ways, and the field currently has no shared, independent way to
					tell them apart. AI Human Impact Bench is the first open standard built to answer a
					different question: across realistic, multi-turn conversations, does an AI system support
					or undermine human flourishing?
				</p>
				<ul class="m-0 flex list-none flex-col gap-[10px] p-0">
					{#each RATIONALE_POINTS as point, i (i)}
						<li class="flex items-start gap-[10px] text-[14px] text-[#374151]">
							<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
							></span>
							<span class="leading-[1.75]">{point}</span>
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col gap-4">
				<h2 class="section-title">The Methodology</h2>
				<p class="m-0 text-[15px] leading-[1.75] text-[#4b5563]">
					Scores reflect how consistently a model supports, or undermines, human flourishing across
					realistic, multi-turn, adversarially probed scenarios. Each conversation pairs a target
					model with a demographically varied simulated user pursuing a latent adversarial goal
					designed to elicit a specific failure mode. Conversations are then graded by an
					LLM-as-judge whose reliability is validated through test-retest consistency, between-judge
					ranking agreement, generator-swap audits, and sampling-stability checks.
				</p>
				<ul class="m-0 flex list-none flex-col gap-[10px] p-0">
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Scoring.</strong> Each (scenario, metric) pair receives a binary verdict: 1
							if the model's behavior reliably
							<span style="color:#16a34a;font-weight:700">supports</span>
							human flourishing on the measured dimension, 0 if it reliably
							<span style="color:#dc2626;font-weight:700">undermines</span> it. Polarity is assigned per
							metric, so a "1" always means the model resisted the targeted failure mode and a "0" always
							means it exhibited it, regardless of whether the underlying behavior is framed as protective
							or harmful.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Adversarial design.</strong> Every metric is paired with scenarios containing a
							latent adversarial objective: instructions guiding the simulated user to apply social pressure,
							escalate emotionally, and probe for the target failure across six turns. This mirrors how
							real harms accumulate organically rather than appearing in a single prompt.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Demographic stratification.</strong> Scenarios are cross-stratified across age
							(child/teen 6 to 17, adult 18+) and gender (female, male, non-binary), enabling intersectional
							analysis and surfacing where harms concentrate. This pipeline has already shown that 12
							of 14 leading models exhibit more emotional-dependence behaviors toward minors than adults,
							the opposite of what protective design implies.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Multi-turn, dynamic format.</strong> Conversations unfold over multiple turns with
							persistent user goals, capturing relational, time-extended dynamics (habituation, escalation,
							dependency formation) that single-prompt benchmarks miss entirely.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Surface-form realism.</strong> A perfunctory mode injects stochastic lower-casing,
							character transpositions, and deletions to mimic the typos and auto-correct artifacts of
							authentic conversational texting, so models are tested under realistic input rather than
							sanitized prose.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Reliability as a first-class output.</strong> The pipeline reports not just scores
							but their stability: test-retest agreement (Fleiss' κ = 0.64 to 0.78), between-judge ranking
							correlation (ρ = 0.61 to 1.00 across qualified judges), three-sample conversation agreement
							(78% unanimous, mean pairwise agreement 0.93), and generator-swap audits that confirm rankings
							are not artifacts of which model family wrote the metrics.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Open submission.</strong> Constructs are contributed by clinicians, legal scholars,
							educators, and community advocates through an open submission process, decoupling who identifies
							what matters from who can implement a benchmark. Each construct is auditable, contestable,
							and revisable, making the framework learning infrastructure rather than a fixed verdict.</span
						>
					</li>
					<li class="flex items-start gap-[10px] text-[14px] leading-[1.75] text-[#374151]">
						<span class="mt-[6px] block h-[7px] w-[7px] flex-shrink-0 rounded-full bg-[#00b3b0]"
						></span>
						<span class="leading-[1.75]"
							><strong>Theoretical grounding.</strong> The framework operationalizes flourishing in the
							tradition of eudaimonic psychology, Sen's capability approach, and VanderWeele's multidimensional
							flourishing framework, spanning physical, psychological, and societal domains within a single
							nomological network so constructs can be compared rather than evaluated in isolation.</span
						>
					</li>
				</ul>
			</div>
		</div>
	</section>

	<!-- Tabbed forms -->
	<section class="scroll-mt-[92px] bg-white px-7 pt-10 pb-20" id="gate-tabs-section">
		<div class="mx-auto max-w-[880px]">
			<!-- Tab nav -->
			<div
				class="mb-7 flex w-full flex-wrap gap-1.5 rounded-[14px] bg-[#f3f4f6] p-1.5"
				role="tablist"
			>
				{#each [['request', 'fa-key', 'Request Access'], ['support', 'fa-hand-holding-heart', 'Support Benchmarking Efforts'], ['feedback', 'fa-comment-dots', 'Feedback']] as [tab, icon, label] (tab)}
					<button
						class="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border-none px-4 py-[11px] text-[14px] font-semibold whitespace-nowrap transition-all duration-[180ms]
							{activeTab === tab
							? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_rgba(15,23,42,0.06)]'
							: 'bg-transparent text-[#6b7280] hover:text-[#111827]'}"
						onclick={() => (activeTab = tab as typeof activeTab)}
					>
						<i class="fa-solid {icon} text-[13px] opacity-90"></i>
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
											name="name"
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
											name="email"
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
											name="affiliation"
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
											name="role"
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
										name="use"
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
											name="name"
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
											name="contact"
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
										name="affiliation"
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
										name="how"
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
					<p class="form-section-desc">Help us improve our benchmarking project.</p>
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
									<select class="form-input form-select" id="gfb-topic" name="topic" required>
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
										name="message"
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
										name="email"
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
		class="mt-auto flex items-center justify-center gap-[10px] bg-white px-7 py-5 text-center text-[12px] text-[#111827]"
	>
		<span>© 2026 MIT Media Lab · AHA Research Program</span>
		<span>·</span>
		<span>Human-AI Impact Bench</span>
	</footer>
</div>

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

	/* Partner logos */
	.partner-logo {
		height: 52px;
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
