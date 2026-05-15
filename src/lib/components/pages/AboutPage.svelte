<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		onTabChange?: (tab: string) => void;
	}

	let { onTabChange }: Props = $props();

	let activeSubtab = $state<string>('pipeline');
	let pageEl: HTMLElement | undefined = $state();

	function goToSupport(e: MouseEvent) {
		e.preventDefault();
		if (typeof window !== 'undefined') {
			history.replaceState(null, '', window.location.pathname + '#support');
		}
		onTabChange?.('home');
	}

	const SUBTABS = [
		{ id: 'pipeline', label: 'Pipeline' },
		{ id: 'why', label: 'Why ImpactBench?' },
		{ id: 'explore', label: 'Explore' },
		{ id: 'methodology', label: 'Methodology' },
		{ id: 'team', label: 'Team' }
	];

	function scrollToSection(id: string) {
		const el = document.getElementById('section-' + id);
		if (el && pageEl) {
			pageEl.scrollTo({ top: el.offsetTop - 48, behavior: 'smooth' });
		}
		activeSubtab = id;
	}

	onMount(() => {
		if (!pageEl) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSubtab = entry.target.id.replace('section-', '');
						break;
					}
				}
			},
			{ root: pageEl, threshold: 0.2 }
		);
		for (const tab of SUBTABS) {
			const el = document.getElementById('section-' + tab.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});
</script>

<div class="about-page" bind:this={pageEl}>
	<aside class="about-sidebar">
		<nav class="about-sidebar-nav">
			{#each SUBTABS as tab, i (tab.id)}
				<button
					class="about-subtab"
					class:active={activeSubtab === tab.id}
					onclick={() => scrollToSection(tab.id)}
				>
					<span class="about-subtab-num">{String(i + 1).padStart(2, '0')}</span>
					<span class="about-subtab-sep">·</span>
					<span class="about-subtab-label">{tab.label}</span>
				</button>
			{/each}
		</nav>
	</aside>

	<div class="about-content">

		<!-- Pipeline -->
		<div id="section-pipeline" class="tab-section">
			<div class="tab-section-inner">

				<div class="text-col">
					<section class="whitepaper-banner">
						<h1 class="whitepaper-title">Introducing ImpactBench</h1>
						<p class="whitepaper-subtitle">Open infrastructure for benchmarking the human impact of AI in multi-turn, realistic settings</p>
						<div class="whitepaper-cta" aria-disabled="true">White paper coming soon</div>
					</section>

					<p class="section-body">
						AI is being rapidly adopted into the systems that people rely on to
						make decisions about their health, finances, relationships, work, and
						sense of self. Deployed thoughtfully, these systems have the potential
						to expand human capabilities and agency. Yet existing benchmarks rarely
						capture the behaviors that matter most for users, measuring neither the
						harmful patterns that erode wellbeing nor the supportive behaviors that
						scaffold flourishing. A growing body of real-world incidents illustrates
						this gap, from companion chatbots scaffolding delusional belief systems
						(<a class="section-inline-link" href="https://arxiv.org/abs/2511.08880" target="_blank" rel="noopener noreferrer">Archiwaranguprok et al., 2025</a>) to tutoring tools quietly
						eroding the cognitive skills they were intended to support
						(<a class="section-inline-link" href="https://www.brainonllm.com/" target="_blank" rel="noopener noreferrer">Kosmyna et al., 2025</a>). A model can pass widely used safety benchmarks
						and still undermine a user's autonomy, cultivate emotional dependency,
						or displace the judgment of the people who depend on it.
					</p>
					<p class="section-body">
						Existing evaluations rarely capture these dynamics. Most are
						single-turn, static, and validated against narrow definitions of harm
						that no single discipline would have written alone. A recent systematic
						review of 445 leading benchmarks found that only 16.0% conducted any
						statistical testing, 21.7% provided no definition of the phenomenon they
						claimed to measure (<a class="section-inline-link" href="https://arxiv.org/pdf/2511.04703" target="_blank" rel="noopener noreferrer">Bean et al</a>).
					</p>
					<p class="section-body">
						Today, we are introducing the Open Benchmark of AI Impact on Humans
						(ImpactBench): an open suite of evaluations designed to measure how AI
						systems affect human outcomes across extended, realistic interactions.
						Built through an open submission process with researchers, clinicians,
						legal scholars, and community advocates, ImpactBench currently spans 18
						expert-submitted benchmarks covering emotional dependence, cognitive
						autonomy, health, legal and financial advice, child safety, and
						additional constructs drawn from clinical, educational, and policy
						literatures. The suite is designed to grow over time, and we invite
						researchers and practitioners to
						<a class="section-inline-link" href="https://www.media.mit.edu/projects/the-open-benchmark-for-the-human-impact-of-ai/overview/" target="_blank" rel="noopener noreferrer">submit additional benchmarks</a>
						as the framework matures. Each benchmark is evaluated through multi-turn
						adversarial simulation with demographically stratified user personas,
						so that risks surface the way they appear in real conversations rather
						than in isolated prompts.
					</p>
					<p class="section-body">
						ImpactBench is a first-of-its-kind collaboration between the MIT Media
						Lab, the Psychology of Technology Institute, the USC Marshall Neely
						Center, and UC Berkeley. The project was launched at the Workshop for
						Designing Benchmarks for Human Flourishing with AI, organized by the
						Advancing Humans with AI (AHA) research program at MIT in October 2025
						with support from the Omidyar Network, which convened 80 experts from
						over 40 academic, industry, non-profit, and government institutions.
					</p>
					<p class="section-body">
						<strong>A note on these results.</strong> The findings reported here are
						preliminary. Model performance can drift over time as systems are
						updated, retrained, or reconfigured for deployment, and benchmark scores
						reflect a snapshot of behavior rather than a permanent property of any
						given model. We welcome feedback, critique, and continued collaboration
						from researchers, clinicians, advocates, and institutions whose
						perspectives can deepen what this evaluation can see. Researchers
						interested in submitting a benchmark, contributing methodological
						improvements, or collaboration on domain-specific extensions are
						encouraged to
						<a class="section-inline-link" href="#support" onclick={goToSupport}>reach out</a>.
					</p>
				</div>

			</div>
		</div>

		<!-- Why ImpactBench? -->
		<div id="section-why" class="tab-section">
			<div class="tab-section-inner">

				<div class="text-col">
					<div class="section-title-block">
						<h1 class="section-title">Why ImpactBench?</h1>
					</div>
					<p class="section-body">
						ImpactBench was designed in response to three structural gaps in current
						benchmarks, which we seek to overcome.
					</p>
					<p class="section-body">
						<strong>Benchmarks focus on model capability, not human impact.</strong>
						Strong performance on capability benchmarks does not guarantee positive
						effects on human flourishing. Prior simulation work has shown that models
						passing conventional safety evaluations still worsened user outcomes in
						the majority of high-risk scenarios tested
						(<a class="section-inline-link" href="https://arxiv.org/pdf/2511.08880" target="_blank" rel="noopener noreferrer">Archiwaranguprok et al., 2025</a>),
						and that sycophantic tendencies establish structural preconditions for
						psychological dependency that prevailing paradigms cannot detect
						(<a class="section-inline-link" href="https://arxiv.org/pdf/2602.19141" target="_blank" rel="noopener noreferrer">Chandra et al., 2026</a>;
						<a class="section-inline-link" href="https://mit-serc.pubpub.org/pub/iopjyxcx/release/2" target="_blank" rel="noopener noreferrer">Mahari &amp; Pataranutaporn, 2025</a>).
					</p>
					<p class="section-body">
						<strong>Benchmark methods often lack scientific rigor and domain expertise.</strong>
						Only 16.0% of reviewed benchmarks include any statistical testing of
						measurement properties, and core concepts such as reasoning, alignment,
						and harmlessness are frequently operationalized without precise
						definitions. Many of those best positioned to identify consequential
						harms, including clinicians, educators, and affected community members,
						lack the technical infrastructure to build benchmarks, while those with
						technical expertise often lack grounding in the psychological, medical,
						or legal constructs at stake.
					</p>
					<p class="section-body">
						<strong>Benchmarks primarily serve the technical community.</strong>
						Public-facing tools are needed to translate benchmark findings for
						parents, teachers, policymakers, and users themselves, who are most
						affected by AI systems but least equipped to interpret leaderboard
						scores.
					</p>
					<p class="section-body">
						ImpactBench is grounded in the conviction that evaluations of AI systems
						should be:
					</p>
					<ul class="section-body about-bullets">
						<li><strong>Human-centered.</strong> Scores reflect potential impact on people, not just model capability.</li>
						<li><strong>Scientifically rigorous.</strong> Scores are built on validated methods, domain expertise, and audits that make operationalization choices empirically contestable.</li>
						<li><strong>Publicly accessible.</strong> Scores are legible to the audiences who need them. Parents, teachers, policymakers, and users should be able to understand how AI systems behave, not only the technical community.</li>
					</ul>
				</div>

				<figure class="img-full">
					<img src="/impactbench2.png" alt="ImpactBench pipeline diagram" />
					<figcaption>The ImpactBench four-stage evaluation pipeline.</figcaption>
				</figure>

			</div>
		</div>

		<!-- Explore -->
		<div id="section-explore" class="tab-section">
			<div class="tab-section-inner">

				<div class="text-col">
					<div class="section-title-block">
						<h1 class="section-title">Explore ImpactBench</h1>
					</div>
				</div>

				<figure class="img-full">
					<img src="/Explore_Impactbench.png" alt="Explore ImpactBench" />
					<figcaption>Overview of the ImpactBench explorer interface.</figcaption>
				</figure>

				<div class="text-col">
					<p class="section-body">
						ImpactBench organizes 18 expert-submitted benchmarks into three
						domains of human flourishing: Physical (health, finances, legal
						and civic rights, education and career), Psychological (mental
						wellbeing, autonomy preservation, creativity and cognition,
						self-determination, learning), and Societal (social
						relationships, fairness and bias, safety and protection). Each
						domain is grounded in eudaimonic psychology and human capability
						theory, capturing not only whether AI systems avoid harm but
						whether they actively support the conditions under which people
						thrive.
					</p>
					<p class="section-body">
						Within each domain, performance is measured at four levels of resolution:
					</p>
					<p class="section-body"><strong>Main areas.</strong> Aggregate scores across the three domains, ranging from -1 (AI consistently harms this dimension) to +1 (AI consistently benefits this dimension), with 0 indicating no net effect on wellbeing.</p>
					<p class="section-body"><strong>Subareas.</strong> Each domain is decomposed into sub-constructs. Physical, for example, covers physical health, legal and civic rights, and education, career, and finance, each evaluated against expert-derived criteria.</p>
					<p class="section-body"><strong>Scenarios.</strong> Each subarea contains scenarios that probe specific situations, scored on a breakdown of good behaviors (compliance is desirable) and harmful behaviors (compliance is a failure). Each behavior is graded on a 0 to 1 scale, with the final scenario score weighted by metric importance.</p>
					<p class="section-body"><strong>Chat logs.</strong> Every scenario score is traceable to the underlying multi-turn conversation between a user-simulator model and the target model, with the judge's verdict on each behavior visible alongside the transcript.</p>
					<p class="section-body">
						This structure is designed so that aggregate rankings remain
						interpretable. A model's overall score can always be traced down
						to specific conversations, specific behaviors, and the
						expert-derived criteria that defined them.
					</p>
				</div>

			</div>
		</div>

		<!-- Methodology -->
		<div id="section-methodology" class="tab-section">
			<div class="tab-section-inner">

				<div class="text-col">
					<div class="section-title-block">
						<h1 class="section-title">Methodology</h1>
					</div>
					<p class="section-body">
						ImpactBench tests how AI systems shape human flourishing across
						realistic, multi-turn interactions, grounded in what experts
						across clinical, educational, legal, and policy domains say
						matters most.
					</p>
					<p class="section-body">
						The benchmark suite covers 18 expert-submitted benchmarks
						comprising 375 individual metrics that span emotional dependence,
						cognitive autonomy, health, legal and financial advice, child
						safety, and more. Each metric is operationalized as a set of
						six-turn scenarios in which a user-simulator model probes a
						target model while pursuing a latent adversarial objective, with
						personas stratified by age and gender to surface demographic
						sensitivity. Conversations are designed to mirror real-world
						use: they capture layperson and expert personas, include
						surface-form perturbations that mimic typo and autocorrect
						artifacts, and accumulate pressure across turns rather than
						relying on isolated prompts.
					</p>
					<p class="section-body">
						ImpactBench is a binary-verdict evaluation, where each
						conversation is graded by a model-based judge (GPT-5.4-mini)
						against expert-derived criteria. Each metric is classified as
						positive (where yes indicates good behavior) or negative (where
						yes indicates bad behavior, inverted for scoring), and verdicts
						are aggregated into a single model score on a 0 to 1 scale. The
						pipeline is audited at every stage through psychometric tools
						including test-retest reliability (Fleiss' &kappa; = 0.64 to
						0.78), between-judge agreement (Spearman &rho; = 0.61),
						generator-swap audits (Wilcoxon p = 0.003), and user-simulator
						swaps (Spearman &rho; up to 0.977), so that operationalization
						and inference choices remain empirically contestable.
					</p>

					<h3 class="section-subheading">Performance of models</h3>
					<p class="section-body">
						We use ImpactBench to evaluate how 14 frontier AI systems
						perform across the full suite, setting a baseline for the field
						to improve upon.
					</p>
				</div>

				<figure class="img-inline">
					<img src="/AIBench_all.jpeg" alt="ImpactBench forest plot of model performance" />
					<figcaption>Aggregate model rankings across all 18 benchmarks.</figcaption>
				</figure>

				<div class="text-col">
					<p class="section-body">
						The Claude 4.x models cluster tightly at the top (0.714&ndash;0.719),
						followed by GPT-5.x near 0.67&ndash;0.68, with Gemini, Gemma, Llama,
						DeepSeek, and GPT-4o between 0.54 and 0.59, and Grok, Mistral,
						and Qwen between 0.43 and 0.50. The full ranking spans approximately 29 percentage points.
					</p>
					<p class="section-body">Three findings stand out beyond the aggregate ranking.</p>
					<p class="section-body"><strong>Harm avoidance does not imply flourishing.</strong> Every model scored higher on negative metrics (harm avoidance) than on positive metrics (actively beneficial behavior), with gaps ranging from +3.9 pp (Claude Opus 4.6) to +21.6 pp (GPT-4o), suggesting that alignment investment has concentrated on suppressing harmful outputs rather than scaffolding flourishing.</p>
					<p class="section-body"><strong>Construct matters more than model.</strong> Benchmark difficulty was determined more by what was being measured than by which model was tested. Humane Bench (mean 0.373), Cognitive Bias (0.467), and Human Agency (0.469) were uniformly hard across all 14 systems, while VERA-MH (0.777) and User Bias (0.765) were uniformly easy.</p>
				</div>

				<figure class="img-inline">
					<img src="/AIBench_Allmetrics.jpeg" alt="ImpactBench all-metrics chart" />
					<figcaption>Per-metric scores across all 14 frontier models.</figcaption>
				</figure>

				<div class="text-col">
					<p class="section-body"><strong>Models behave differently toward minors.</strong> 12 of 14 models showed more emotional-dependence behaviors toward child and teen personas than toward adults, holding scenario content constant. Largest effects: Qwen3 80B (+0.049), Mistral Small 3.2 (+0.044), DeepSeek V3.2 (+0.042).</p>
					<p class="section-body">
						Rankings were stable across generator, simulator, and judge
						swaps. Run-to-run Fleiss' &kappa; ranged from 0.64 to 0.78,
						78.1% of conversation triples were unanimous, and a single
						sample matched the three-sample majority vote at &rho; = 0.982.
					</p>
				</div>

			</div>
		</div>

		<!-- Team -->
		<div id="section-team" class="tab-section">
			<div class="tab-section-inner">

				<div class="text-col">
					<div class="section-title-block">
						<h1 class="section-title">Team &amp; Collaborators</h1>
					</div>
					<p class="section-hero-subtitle">
						This ambitious project could not have been done without
						collaboration across many disciplines and areas of expertise. A
						core group based out of MIT, USC, and the Psychology of
						Technology Institute have initiated this collaboration with the
						support of many others.
					</p>
					<p class="section-hero-subtitle" style="margin-top: 12px">
						The project began at the
						<a class="section-inline-link" href="https://www.media.mit.edu/events/aha-flourishing-workshop/" target="_blank" rel="noopener noreferrer">AHA Flourishing Workshop</a>
						at MIT in October 2025, supported by the Omidyar Network,
						which convened 80 experts from over 40 institutions. Prior AHA
						research on AI companion chatbots was cited as a key inspiration for <strong>California Senate Bill 243</strong>.
					</p>

					<section class="team-partners">
						<p class="team-partners-title">Led by researchers at</p>
						<div class="team-partners-row">
							<a href="https://www.mit.edu/" target="_blank" rel="noopener noreferrer" aria-label="MIT">
								<img src="/images/MIT Logo.png" alt="MIT" class="team-partner-logo" />
							</a>
							<img src="/images/ML logo.png" alt="MIT Media Lab" class="team-partner-logo" />
							<img src="/images/USC-Logo.png" alt="USC" class="team-partner-logo" />
							<img src="/images/PTI+Logo+updated.webp" alt="Psychology of Technology Institute" class="team-partner-logo" />
							<img src="/images/UC-Berkeley-Haas-logo-digital_stacked-blue.png" alt="UC Berkeley Haas" class="team-partner-logo" />
						</div>
					</section>

					<h2 class="section-heading">Team</h2>
					<ul class="team-list">
						<li><strong>Pat Pataranutaporn</strong>, MIT Media Lab</li>
						<li><strong>Pattie Maes</strong>, MIT Media Lab</li>
						<li><strong>Jennifer Pfister</strong>, MIT Media Lab</li>
						<li><strong>Chayapatr Archiwaranguprok</strong>, MIT Media Lab</li>
						<li><strong>Constanze Albrecht</strong>, MIT Media Lab</li>
						<li><strong>Sheer Karny</strong>, MIT Media Lab</li>
						<li><strong>Rachel Poonsiriwong</strong>, MIT Media Lab</li>
						<li><strong>Ravi Iyer</strong>, USC Marshall School's Neely Center &amp; Psychology of Technology Institute</li>
						<li><strong>Nate Fast</strong>, USC Marshall School's Neely Center &amp; Psychology of Technology Institute</li>
						<li><strong>Juliana Schroeder</strong>, University of California, Berkeley &amp; Psychology of Technology Institute</li>
						<li><strong>Stanley Huang</strong>, Boston University</li>
						<li><strong>Yuning Liu</strong>, Harvard University</li>
					</ul>

					<h2 class="section-heading">Support in helping define and launch project</h2>
					<ul class="team-list">
						<li>Noesis Collaborative</li>
						<li>Building Humane Technology</li>
					</ul>

					<h2 class="section-heading">Support in contributing benchmarks and benchmark expertise</h2>
					<ul class="team-list">
						<li><strong>Jenny Radesky, MD</strong>, University of Michigan</li>
						<li><strong>Alexis Hiniker</strong>, University of Washington</li>
						<li><strong>Marie Bragg</strong>, New York University</li>
						<li><strong>Yaoli Mao &amp; Erika Anderson</strong>, Humane Bench</li>
						<li><strong>Eric Ngoiya</strong>, QueueLab</li>
						<li><strong>Carl Vincent Kho</strong>, Minerva University</li>
						<li><strong>Su Jin Park</strong></li>
						<li><strong>Anil Kshatriya</strong>, ESSEC Business School</li>
						<li>Generative AI for Good</li>
						<li>AI Culture Lab</li>
						<li><strong>Eduardo Baena</strong>, Northeastern University</li>
						<li><strong>Ryan McBain, Jonathan Cantor, Ellice Huang</strong>, Rand Corporation</li>
						<li><strong>Cornelia Walther</strong>, University of Pennsylvania</li>
						<li>Spring Health</li>
						<li>Tech Justice Law</li>
					</ul>

					<p class="section-body" style="margin-top: 24px">
						Participants of the MIT Workshop for Designing Benchmarks for
						Human Flourishing with AI supported by Omidyar Network.
					</p>
				</div>

			</div>
		</div>

	</div>
</div>

<style>
	:global(.about-page strong) { font-weight: 600; }

	/* ===== Page shell ===== */
	.about-page {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		align-items: flex-start;
		background: #ffffff;
	}

	/* ===== Sidebar ===== */
	.about-sidebar {
		flex: 0 0 220px;
		position: sticky;
		top: 0;
		height: 100vh;
		padding: 96px 24px 40px 32px;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.about-sidebar-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: #1a1a1a;
		margin-bottom: 16px;
	}

	.about-sidebar-divider {
		width: 100%;
		height: 1px;
		background: #e5e7eb;
		margin-bottom: 24px;
	}

	.about-sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.about-subtab {
		display: flex;
		align-items: baseline;
		gap: 7px;
		padding: 6px 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.about-subtab-sep {
		font-size: 12px;
		color: #9ca3af;
		flex-shrink: 0;
		transition: color 0.15s;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.about-subtab:hover .about-subtab-sep,
	.about-subtab.active .about-subtab-sep { color: #6b7280; }

	.about-subtab-num {
		font-family: 'JetBrains Mono', 'Fira Mono', 'Roboto Mono', monospace;
		font-size: 12px;
		font-weight: 400;
		color: #d1d5db;
		letter-spacing: 0.02em;
		flex-shrink: 0;
		transition: color 0.2s;
	}

	.about-subtab-label {
		font-size: 16px;
		font-family: 'Inter', system-ui, sans-serif;
		font-weight: 400;
		color: #b0b7c3;
		letter-spacing: -0.01em;
		transition: color 0.15s, font-weight 0.15s;
	}

	.about-subtab:hover .about-subtab-num { color: #9ca3af; }
	.about-subtab:hover .about-subtab-label { color: #374151; }

	.about-subtab.active .about-subtab-num {
		color: #038d8f;
		font-weight: 500;
	}

	.about-subtab.active .about-subtab-label {
		color: #1a1a1a;
		font-weight: 500;
	}

	/* ===== Content area ===== */
	.about-content {
		flex: 1;
		min-width: 0;
	}

	.tab-section { background: #ffffff; }

	.tab-section-inner {
		padding: 72px 0 96px;
	}

	/* Text column: centered */
	.text-col {
		max-width: 860px;
		margin: 0 auto 40px;
		padding: 0 40px;
	}

	.text-col:last-child { margin-bottom: 0; }

	/* Images: wider than text, centered */
	.img-full {
		width: 80%;
		margin: 48px auto 48px;
	}

	/* Images: constrained to text column width */
	.img-inline {
		max-width: 860px;
		width: calc(100% - 80px);
		margin: 48px auto 48px;
		padding: 0 40px;
		box-sizing: border-box;
	}

	.img-full img,
	.img-inline img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 6px;
		border: 1px solid #e5e7eb;
	}

	.img-full figcaption,
	.img-inline figcaption {
		margin-top: 10px;
		font-size: 14px;
		font-weight: 450;
		color: #9ca3af;
		font-family: 'Inter', system-ui, sans-serif;
		line-height: 1.5;
		text-align: center;
	}

	/* Whitepaper banner — hero at top of Pipeline section */
	.whitepaper-banner {
		padding: 64px 0 56px;
		margin-bottom: 48px;
		text-align: center;
	}

	.whitepaper-title {
		font-family: 'Source Serif Pro', 'Cormorant Garamond', Georgia, serif;
		font-size: clamp(32px, 4vw, 52px);
		font-weight: 600;
		color: #1a1a1a;
		margin: 0 0 16px;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	.whitepaper-subtitle {
		font-size: 20px;
		font-weight: 400;
		color: #6b7280;
		margin: 0 auto 28px;
		line-height: 1.5;
	}

	.whitepaper-cta {
		display: inline-flex;
		align-items: center;
		margin: 0 auto;
		padding: 9px 20px;
		background: #f3f4f6;
		color: #6b7280;
		font-size: 13px;
		font-weight: 500;
		border-radius: 999px;
		cursor: default;
		border: 1px solid #e5e7eb;
	}

	/* Section title block with overline label */
	.section-title-block {
		margin-bottom: 32px;
		text-align: center;
	}

	.section-overline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.section-overline span {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #9ca3af;
		white-space: nowrap;
	}

	/* Section titles */
	.section-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: clamp(28px, 3vw, 40px);
		font-weight: 600;
		color: #1a1a1a;
		letter-spacing: -0.018em;
		line-height: 1.15;
		margin: 0;
		text-wrap: balance;
	}

	.section-hero-subtitle {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 18px;
		color: #6b7280;
		line-height: 1.7;
	}

	.section-heading {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 22px;
		font-weight: 600;
		color: #1a1a1a;
		letter-spacing: -0.01em;
		margin: 48px 0 12px;
	}

	.section-subheading {
		font-size: 15px;
		font-weight: 600;
		color: #1a1a1a;
		margin: 36px 0 10px;
		letter-spacing: -0.003em;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 12px;
		color: #9ca3af;
	}

	.section-body {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 18px;
		color: #374151;
		line-height: 1.8;
		margin-bottom: 24px;
	}

	.section-body:last-child { margin-bottom: 0; }

	.about-bullets {
		list-style: none;
		padding: 0;
		margin: 4px 0 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.about-bullets li {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 18px;
		color: #374151;
		line-height: 1.7;
		padding-left: 20px;
		position: relative;
	}

	.about-bullets li::before {
		content: '—';
		position: absolute;
		left: 0;
		color: #d1d5db;
		font-weight: 300;
	}

	.about-bullets li strong {
		font-weight: 600;
		color: #1a1a1a;
	}

	.section-inline-link {
		color: #038d8f;
		font-weight: 500;
		text-decoration: none;
		border-bottom: 1px solid rgba(3, 141, 143, 0.25);
		transition: color 0.15s, border-color 0.15s;
	}

	.section-inline-link:hover {
		color: #00b3b0;
		border-bottom-color: rgba(0, 179, 176, 0.6);
	}

	/* Team */
	.team-partners {
		margin: 40px 0 8px;
	}

	.team-partners-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #9ca3af;
		margin: 0 0 20px;
	}

	.team-partners-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 32px;
		row-gap: 20px;
	}

	.team-partner-logo {
		height: 36px;
		width: auto;
		max-width: 120px;
		object-fit: contain;
		filter: grayscale(100%);
		opacity: 0.5;
		transition: filter 0.2s, opacity 0.2s;
	}

	.team-partner-logo:hover {
		filter: grayscale(0%);
		opacity: 1;
	}

	.team-list {
		list-style: none;
		padding: 0;
		margin: 12px 0 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.team-list li {
		font-size: 16px;
		color: #6b7280;
		line-height: 1.6;
		padding: 2px 0;
	}

	.team-list li strong {
		color: #1a1a1a;
		font-weight: 600;
	}
</style>
