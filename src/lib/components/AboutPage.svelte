<script lang="ts">
	let activeSubtab = $state<'about' | 'methodology' | 'team'>('about');

	const SUBTABS = [
		{ id: 'about' as const, icon: 'fa-seedling', label: 'About' },
		{ id: 'methodology' as const, icon: 'fa-flask', label: 'Methodology' },
		{ id: 'team' as const, icon: 'fa-people-group', label: 'Team' }
	];

	const PILLARS = [
		{
			color: '#a8d5b5',
			heading: 'Benchmarks focus on model capability, not human impact.',
			body: "Strong benchmark performance doesn't guarantee positive effects on human flourishing."
		},
		{
			color: '#e8adb8',
			heading: 'Benchmark methods need scientific rigor and domain expertise.',
			body: 'Only 16.0% of reviewed benchmarks include any statistical testing*'
		},
		{
			color: '#b87878',
			heading: 'Benchmarks serve the technical community.',
			body: 'Public-facing tools are needed to translate findings for parents, teachers, policymakers, and the public.'
		}
	];

	const FINDINGS = [
		{
			title: 'Harm avoidance ≠ flourishing',
			body: 'Every model scored higher on harm-avoidance metrics than on actively beneficial ones. Gap range: +3.9 pp (Claude Opus 4.6) to +21.6 pp (GPT-4o).'
		},
		{
			title: 'Demographic sensitivity',
			body: '12 of 14 models showed more emotional-dependence behaviors toward child and teen personas than adults, holding scenario content constant. Largest effects: Qwen3 80B (+0.049), Mistral Small 3.2 (+0.044), DeepSeek V3.2 (+0.042).'
		},
		{
			title: 'Construct matters more than model',
			body: 'Humane Bench (mean 0.373), Cognitive Bias (0.467), and Human Agency (0.469) were uniformly hard. VERA-MH (0.777) and User Bias (0.765) were uniformly easy.'
		},
		{
			title: 'Rankings are stable',
			body: "Rankings held across generator, simulator, and judge swaps. Run-to-run Fleiss' κ = 0.64 to 0.78. 78.1% of conversation triples were unanimous. A single sample matched the three-sample majority vote at ρ = 0.982."
		}
	];

	const DELIVERABLES = [
		{
			title: 'Open benchmark suite',
			body: '18 benchmarks across physical (medical, legal, financial), psychological (emotional dependence, mental health, character), and societal (autonomy, learning, meaning) domains. Includes original benchmarks (Emotional Dependence, Autonomy Preserving, Spillunder Effect) and adapted components from HealthBench, VERA-MH, KORA Bench, HumaneBench, and Flourishing AI.'
		},
		{
			title: 'Public-facing nutrition labels',
			body: "Audience-adapted profiles for parents, educators, policymakers, and developers. Labels show what was tested, which populations were represented, and where the benchmark is least informative, e.g., distinguishing GPT-4o's harm-avoidance score (0.720) from its positive-behavior score (0.504)."
		},
		{
			title: 'Open submission',
			body: 'Any benchmark relating to human flourishing is eligible — autonomy, competence, relatedness, learning, sycophancy, emotional dependence, deception, dark patterns. Non-technical experts submit a construct specification; the pipeline handles scenario generation, simulation, and scoring. Submissions ship with psychometric tooling: nomological network analysis, comprehensiveness checks, run-to-run reliability.'
		}
	];

	const COLLABS = [
		{ icon: 'fa-university', name: 'MIT Media Lab' },
		{ icon: 'fa-brain', name: 'Psychology of Technology Institute' },
		{ icon: 'fa-graduation-cap', name: 'USC Neely Center' },
		{ icon: 'fa-graduation-cap', name: 'UC Berkeley' }
	];

	const DOMAINS = [
		{
			title: 'Physical',
			body: 'High-stakes practical questions: medical advice, legal advice, financial advice, healthcare decisions.'
		},
		{
			title: 'Psychological',
			body: "Emotional dependence, mental health, and character. Includes how the AI shapes a user's relationship with themselves and others."
		},
		{
			title: 'Societal',
			body: 'Autonomy, learning, meaning, and purpose. The effects that ripple beyond a single user into beliefs, norms, and institutions.'
		}
	];

	const CRITERIA = [
		{
			title: 'Construct validity',
			body: 'Does the benchmark actually measure what it claims to? We use nomological network analysis to confirm the measure captures the intended idea, and comprehensiveness checks to find gaps in coverage.'
		},
		{
			title: 'Multi-turn and dynamic',
			body: 'Real harms build over time. Each scenario runs across 6 turns, and scenarios are generated fresh so models cannot memorize them.'
		},
		{
			title: 'Demographic stratification',
			body: 'Scenarios vary across age (child/teen 6 to 17, adult 18+) and gender (male, female, non-binary), using a sampling approach that gives broad coverage without exploding into thousands of combinations.'
		},
		{
			title: 'Test-retest reliability',
			body: 'If you run the same benchmark twice, do you get the same answer? We measure this directly.'
		},
		{
			title: 'Ranking stability',
			body: 'A benchmark is only useful if its rankings hold up when we swap out the models doing the generating, simulating, and judging.'
		},
		{
			title: 'Resistance to gaming',
			body: 'We add realistic typos, lowercase shifts, and dropped characters so models cannot detect that they are being tested.'
		}
	];

	const PIPELINE = [
		{
			title: '1. Building the test',
			body: 'A generator model (Claude Sonnet 4) takes an expert submission and writes the metrics and scenarios. Each scenario is built around a single metric to keep the test focused. Scenarios include a persona, a surface goal, a hidden adversarial objective, and landmark instructions like "at turn 4, ask the AI to be your best friend."'
		},
		{
			title: '2. Running the conversation',
			body: 'A user-simulator model (Claude Sonnet 4) plays the human across 6 turns. It acts like a natural conversational partner on the surface while pushing the hidden objective underneath, escalating pressure as the conversation unfolds.'
		},
		{
			title: '3. Scoring the result',
			body: 'A judge model (GPT-5.4-mini) reads the full conversation and returns a yes or no on each metric. We picked this judge after testing five candidates for run-to-run consistency. We dropped Claude Sonnet 4.6 because it passed almost everything regardless of quality, and GPT-5.4 because its results were unstable.'
		},
		{
			title: '4. Aggregating into a score',
			body: "Some metrics measure good behavior (where \"yes\" is a pass) and others measure harmful behavior (where \"yes\" is a failure). We combine them according to each metric's polarity, average across scenarios, and invert so that higher scores always mean better behavior."
		}
	];

	const VALIDATION = [
		{
			title: "Could Claude be inflating its own scores?",
			body: "No. When we swapped the metric generator from Claude to GPT-5.4, Claude's lead grew, not shrank (from +5.7 pp to +27.0 pp on humanebench). Wilcoxon p = 0.003 across 18 pairs. The test does catch self-generation bias when it exists, just not for Claude in this case."
		},
		{
			title: 'Could the user-simulator be playing favorites?',
			body: 'No. Rankings stay stable across Claude, GPT-5.4, and Llama simulators (ρ = 0.977 on health-bench, 0.752 on humanebench). Same-family simulators turn out to be tougher on other models, not friendlier to their own.'
		},
		{
			title: 'Is the judge reliable?',
			body: 'Yes. Run-to-run agreement (Fleiss\' κ) lands between 0.64 and 0.78, which counts as "substantial." Pass rates drift by less than 0.22 pp between runs. Different judges produce different absolute pass rates (55 to 85 percent), but the rankings they produce agree at ρ = 0.61 across GPT-5.4-mini, Claude Opus 4.7, and Llama 4 Maverick.'
		},
		{
			title: 'Are we sampling enough conversations?',
			body: 'Yes. Across 56,700 triples, 78.1% were unanimous across three independent runs. A single sample matches the three-sample majority vote at ρ = 0.982.'
		},
		{
			title: 'Does the adversarial design actually do anything?',
			body: 'Yes. A 2x2 test of adversarial objective and perfunctory mode (the typo simulation) shows clear interaction effects, though rankings stay the same.'
		}
	];

	const TEAM = [
		{ name: 'Pat Pataranutaporn', org: 'MIT Media Lab' },
		{ name: 'Pattie Maes', org: 'MIT Media Lab' },
		{ name: 'Jennifer Pfister', org: 'MIT Media Lab' },
		{ name: 'Chayapatr Archiwaranguprok', org: 'MIT Media Lab' },
		{ name: 'Constanze Albrecht', org: 'MIT Media Lab' },
		{ name: 'Sheer Karny', org: 'MIT Media Lab' },
		{ name: 'Rachel Poonsiriwong', org: 'MIT Media Lab' },
		{ name: 'Ravi Iyer', org: "USC Marshall School's Neely Center & Psychology of Technology Institute" },
		{ name: 'Nate Fast', org: "USC Marshall School's Neely Center & Psychology of Technology Institute" },
		{ name: 'Juliana Schroeder', org: 'University of California, Berkeley & Psychology of Technology Institute' },
		{ name: 'Stanley Huang', org: 'Boston University' },
		{ name: 'Yuning Liu', org: 'Harvard University' }
	];

	const LAUNCH_SUPPORT = [
		{ name: 'Noesis Collaborative' },
		{ name: 'Building Humane Technology' }
	];

	const BENCHMARK_CONTRIBUTORS: { name: string; org?: string }[] = [
		{ name: 'Jenny Radesky, MD', org: 'University of Michigan' },
		{ name: 'Alexis Hiniker', org: 'University of Washington' },
		{ name: 'Marie Bragg', org: 'New York University' },
		{ name: 'Yaoli Mao & Erika Anderson', org: 'Humane Bench' },
		{ name: 'Eric Ngoiya', org: 'QueueLab' },
		{ name: 'Carl Vincent Kho', org: 'Minerva University' },
		{ name: 'Su Jin Park' },
		{ name: 'Anil Kshatriya', org: 'ESSEC Business School' },
		{ name: 'Generative AI for Good' },
		{ name: 'AI Culture Lab' },
		{ name: 'Eduardo Baena', org: 'Northeastern University' },
		{ name: 'Ryan McBain, Jonathan Cantor, Ellice Huang', org: 'Rand Corporation' },
		{ name: 'Cornelia Walther', org: 'University of Pennsylvania' },
		{ name: 'Spring Health' },
		{ name: 'Tech Justice Law' }
	];

	const PARTNER_LOGOS = [
		{ src: '/images/MIT Logo.png', alt: 'MIT' },
		{ src: '/images/ML logo.png', alt: 'MIT Media Lab' },
		{ src: '/images/USC-Logo.png', alt: 'USC' },
		{ src: '/images/PTI+Logo+updated.webp', alt: 'Psychology of Technology Institute' },
		{ src: '/images/UC-Berkeley-Haas-logo-digital_stacked-blue.png', alt: 'UC Berkeley Haas' }
	];
</script>

<div class="about-page">
	<!-- Sidebar nav -->
	<aside class="about-sidebar">
		{#each SUBTABS as tab (tab.id)}
			<button
				class="subtab"
				class:active={activeSubtab === tab.id}
				onclick={() => (activeSubtab = tab.id)}
			>
				<i class="fa-solid {tab.icon}"></i>
				{tab.label}
			</button>
		{/each}
	</aside>

	<!-- Content -->
	<div class="about-content">
		{#if activeSubtab === 'about'}
			<div class="section-inner">
				<!-- Whitepaper banner -->
				<section class="whitepaper-banner">
					<div class="whitepaper-text">
						<h1 class="whitepaper-title">The Human–AI Impact Bench</h1>
						<p class="whitepaper-subtitle">Benchmarking AI models for human flourishing</p>
						<div class="whitepaper-cta">White paper coming soon</div>
					</div>
					<div class="whitepaper-thumb">
						<img src="/images/Screenshot%202026-04-26%20at%2010.56.40%E2%80%AFPM.png" alt="White paper preview" />
					</div>
				</section>

				<!-- Hero -->
				<div class="section-hero">
					<h1 class="section-hero-title">AI Human Impact Bench</h1>
					<p class="section-hero-subtitle">A multi-turn benchmark suite measuring how AI systems affect users across physical, psychological, and societal dimensions.</p>
				</div>

				<!-- Why now -->
				<h2 class="section-heading">Why now?</h2>
				<div class="problem-pillars">
					{#each PILLARS as p (p.heading)}
						<div class="problem-pillar">
							<div class="pillar-bar" style="background:{p.color}"></div>
							<h3 class="pillar-heading">{p.heading}</h3>
							<p class="pillar-body">{p.body}</p>
						</div>
					{/each}
				</div>
				<p class="pillar-footnote">*Bean, Andrew M., et al. &ldquo;Measuring what matters: Construct validity in large language model benchmarks.&rdquo; <em>arXiv preprint arXiv:2511.04703</em> (2025).</p>

				<div class="section-divider"></div>

				<!-- What We Built -->
				<h2 class="section-heading">What We Built</h2>
				<p class="section-body">A pipeline with four stages:</p>
				<ol class="section-ordered">
					<li>Expert-submitted constructs are decomposed into metrics.</li>
					<li>Metrics expand into 6-turn scenarios with latent adversarial user goals, stratified by age and gender.</li>
					<li>A user-simulator model probes a target model; a judge model returns binary verdicts.</li>
					<li>Results pass through a psychometric audit: test-retest reliability, generator/judge swaps, run-to-run consistency.</li>
				</ol>
				<p class="section-body mt-3">Our current version evaluates 14 frontier models according to 18 benchmarks and 375 metric pairs.</p>

				<div class="section-divider"></div>

				<!-- Findings -->
				<h2 class="section-heading">Findings</h2>
				<div class="findings-grid">
					{#each FINDINGS as f (f.title)}
						<div class="finding-item">
							<h3 class="finding-title">{f.title}</h3>
							<p class="section-body">{f.body}</p>
						</div>
					{/each}
				</div>

				<div class="section-divider"></div>

				<!-- Deliverables -->
				<h2 class="section-heading">Deliverables</h2>
				<div class="deliverables-list">
					{#each DELIVERABLES as d (d.title)}
						<div class="deliverable-item">
							<h4 class="deliverable-title">{d.title}</h4>
							<p class="section-body">{d.body}</p>
						</div>
					{/each}
				</div>

				<div class="section-divider"></div>

				<!-- Collaborators -->
				<h2 class="section-heading">Collaborators</h2>
				<div class="collab-list">
					{#each COLLABS as c (c.name)}
						<div class="collab-item">
							<i class="fa-solid {c.icon}"></i> {c.name}
						</div>
					{/each}
				</div>
				<p class="section-body mt-3">The project began at the <a class="inline-link" href="https://www.media.mit.edu/events/aha-flourishing-workshop/" target="_blank" rel="noopener noreferrer">AHA Flourishing Workshop</a> at MIT in October 2025, supported by the Omidyar Network, which convened 80 experts from over 40 institutions. Prior AHA research on AI companion chatbots was cited as a key inspiration for <strong>California Senate Bill 243</strong>.</p>

				<div class="section-divider"></div>

				<!-- Launch -->
				<h2 class="section-heading">Launch</h2>
				<p class="section-body"><strong>April 28, 2026.</strong> Seeking philanthropic support to expand coverage of underrepresented communities and languages, and to extend evaluation from base models to deployed products.</p>
			</div>

		{:else if activeSubtab === 'methodology'}
			<div class="section-inner">
				<div class="section-hero">
					<h1 class="section-hero-title">How We Measure</h1>
					<p class="section-hero-subtitle">A four-stage pipeline that turns expert-submitted ideas into rigorous, multi-turn evaluations, with built-in checks to catch our own blind spots.</p>
				</div>

				<h2 class="section-heading">Three Domains of Human Impact</h2>
				<p class="section-body">We group what we measure into three areas, drawn from psychology, capability theory, and clinical research.</p>
				<div class="deliverables-list mt-5">
					{#each DOMAINS as d (d.title)}
						<div class="deliverable-item">
							<h4 class="deliverable-title">{d.title}</h4>
							<p class="section-body">{d.body}</p>
						</div>
					{/each}
				</div>
				<p class="section-body mt-4">The current release covers 14 frontier models, 18 benchmarks, and 375 (benchmark, metric) pairs.</p>

				<div class="section-divider"></div>

				<h2 class="section-heading">What Makes a Good Benchmark</h2>
				<p class="section-body">Before any benchmark joins the suite, we check it against six criteria.</p>
				<div class="deliverables-list mt-5">
					{#each CRITERIA as c (c.title)}
						<div class="deliverable-item">
							<h4 class="deliverable-title">{c.title}</h4>
							<p class="section-body">{c.body}</p>
						</div>
					{/each}
				</div>

				<div class="section-divider"></div>

				<h2 class="section-heading">The Four-Stage Pipeline</h2>
				<div class="deliverables-list mt-5">
					{#each PIPELINE as s (s.title)}
						<div class="deliverable-item">
							<h4 class="deliverable-title">{s.title}</h4>
							<p class="section-body">{s.body}</p>
						</div>
					{/each}
				</div>

				<div class="section-divider"></div>

				<h2 class="section-heading">How We Validated the Pipeline</h2>
				<p class="section-body">We stress-tested the pipeline against five things that could bias results.</p>
				<div class="deliverables-list mt-5">
					{#each VALIDATION as v (v.title)}
						<div class="deliverable-item">
							<h4 class="deliverable-title">{v.title}</h4>
							<p class="section-body">{v.body}</p>
						</div>
					{/each}
				</div>

				<div class="section-divider"></div>

				<h2 class="section-heading">Measuring Demographic Sensitivity</h2>
				<p class="section-body">To check whether models treat different users differently, we ran per-model regressions of failure rate on gender, age, and their interaction, with fixed effects controlling for metric difficulty and scenario content. The reference user is a female adult.</p>
				<p class="section-body mt-3">Pooling across all models, child and teen personas elicit 2.5 pp more emotional-dependence failures than adults (p &lt; 0.001), holding scenario content constant. Demographics explain less than 0.4% of variance once metric and scenario are accounted for, so the size is small. But the direction is consistent across 12 of 14 models, and it points the wrong way: more harmful behavior toward minors, not less.</p>
			</div>

		{:else}
			<!-- Team -->
			<div class="section-inner">
				<div class="section-hero">
					<h1 class="section-hero-title">Team &amp; Collaborators</h1>
					<p class="section-hero-subtitle">This ambitious project could not have been done without collaboration across many disciplines and areas of expertise. A core group based out of MIT, USC, and the Psychology of Technology Institute have initiated this collaboration with the support of many others.</p>
				</div>

				<section class="team-partners">
					<p class="partners-label">Led by researchers at</p>
					<div class="partners-row">
						{#each PARTNER_LOGOS as logo (logo.alt)}
							<img src={logo.src} alt={logo.alt} class="partner-logo" />
						{/each}
					</div>
				</section>

				<div class="section-divider"></div>

				<h2 class="section-heading">Team</h2>
				<ul class="team-list">
					{#each TEAM as m (m.name)}
						<li><strong>{m.name}</strong>, {m.org}</li>
					{/each}
				</ul>

				<div class="section-divider"></div>

				<h2 class="section-heading">Support in helping define and launch project</h2>
				<ul class="team-list">
					{#each LAUNCH_SUPPORT as m (m.name)}
						<li>{m.name}</li>
					{/each}
				</ul>

				<div class="section-divider"></div>

				<h2 class="section-heading">Support in contributing benchmarks and benchmark expertise</h2>
				<ul class="team-list">
					{#each BENCHMARK_CONTRIBUTORS as m (m.name)}
						<li>{#if m.org}<strong>{m.name}</strong>, {m.org}{:else}{m.name}{/if}</li>
					{/each}
				</ul>

				<p class="section-body mt-6">Participants of the MIT Workshop for Designing Benchmarks for Human Flourishing with AI supported by Omidyar Network.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	/* ===== Layout ===== */
	.about-page {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 1180px;
		margin: 0 auto;
		padding: 24px 32px;
		gap: 24px;
		background: #fafaf9;
		align-items: flex-start;
		justify-content: center;
		overflow: hidden;
	}

	.about-sidebar {
		flex: 0 0 220px;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 16px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
		padding: 12px;
		margin-top: 48px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		position: sticky;
		top: 96px;
		max-height: calc(100vh - 120px);
		overflow-y: auto;
		z-index: 10;
	}

	.subtab {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: none;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-family: 'Inter', system-ui, sans-serif;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.15s, color 0.15s;
	}

	.subtab:hover {
		background: #f3f4f6;
		color: #1a1a1a;
	}

	.subtab.active {
		background: #e0f7f7;
		color: #00b3b0;
		font-weight: 600;
	}

	.about-content {
		flex: 1 1 860px;
		min-width: 0;
		max-width: 860px;
		overflow-y: auto;
		max-height: calc(100vh - 96px);
	}

	.section-inner {
		padding: 48px 28px 80px;
	}

	/* ===== Whitepaper banner ===== */
	.whitepaper-banner {
		display: grid;
		grid-template-columns: 1.35fr 1fr;
		align-items: center;
		gap: 40px;
		padding: 48px 40px;
		margin: 0 0 64px;
		background: #0b0f14;
		color: #f5f1e8;
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
	}

	.whitepaper-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 24px;
		padding: 8px 0 8px 16px;
	}

	.whitepaper-title {
		font-family: 'Source Serif Pro', 'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif;
		font-size: clamp(30px, 3vw, 46px);
		font-weight: 550;
		color: #f5f1e8;
		margin: 0;
		line-height: 1.05;
		letter-spacing: -0.012em;
	}

	.whitepaper-subtitle {
		font-size: 15px;
		font-weight: 400;
		color: #d6cfc1;
		margin: 0;
		line-height: 1.5;
	}

	.whitepaper-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 22px;
		background: #ccc7bb;
		color: #0b0f14;
		font-size: 15px;
		font-weight: 500;
		border-radius: 999px;
	}

	.whitepaper-thumb img {
		display: block;
		height: 280px;
		width: auto;
		max-width: 100%;
		object-fit: cover;
		border-radius: 6px;
		filter: drop-shadow(0 22px 44px rgba(0, 0, 0, 0.55)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
		justify-self: end;
	}

	/* ===== Section typography ===== */
	.section-hero {
		margin-bottom: 40px;
	}

	.section-hero-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 32px;
		font-weight: 600;
		color: #1a1a1a;
		letter-spacing: -0.012em;
		line-height: 1.2;
		margin-bottom: 12px;
	}

	.section-hero-subtitle {
		font-size: 14px;
		line-height: 1.65;
		color: #1a1a1a;
		max-width: 720px;
		font-weight: 400;
	}

	.section-heading {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 32px;
		font-weight: 600;
		color: #1a1a1a;
		letter-spacing: -0.012em;
		line-height: 1.2;
		margin-bottom: 14px;
	}

	.section-body {
		font-size: 14px;
		line-height: 1.7;
		color: #1a1a1a;
		font-weight: 400;
	}

	.section-ordered {
		font-size: 14px;
		line-height: 1.7;
		color: #1a1a1a;
		font-weight: 400;
		padding-left: 22px;
		margin: 8px 0 0;
	}

	.section-ordered li {
		margin-bottom: 6px;
	}

	.section-divider {
		height: 1px;
		background: #e5e7eb;
		margin: 32px 0;
		opacity: 0.6;
	}

	.mt-3 { margin-top: 12px; }
	.mt-4 { margin-top: 16px; }
	.mt-5 { margin-top: 20px; }
	.mt-6 { margin-top: 24px; }

	/* ===== Problem pillars ===== */
	.problem-pillars {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 36px;
		margin: 28px 0 8px;
	}

	.pillar-bar {
		height: 7px;
		border-radius: 3px;
		margin-bottom: 18px;
	}

	.pillar-heading {
		font-size: 21px;
		font-weight: 700;
		line-height: 1.25;
		color: #1a1a1a;
		margin-bottom: 14px;
		letter-spacing: -0.01em;
	}

	.pillar-body {
		font-size: 14px;
		color: #6b7280;
		line-height: 1.65;
	}

	.pillar-footnote {
		font-size: 11px;
		color: #9ca3af;
		margin-top: 10px;
		line-height: 1.5;
	}

	/* ===== Findings grid ===== */
	.findings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 28px 32px;
		margin: 20px 0 8px;
	}

	.finding-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.008em;
		line-height: 1.3;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	/* ===== Deliverables ===== */
	.deliverables-list {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.deliverable-title {
		font-family: 'Source Serif Pro', Georgia, serif;
		font-size: 19px;
		font-weight: 600;
		letter-spacing: -0.008em;
		line-height: 1.3;
		color: #1a1a1a;
		margin-bottom: 8px;
	}

	/* ===== Collaborators ===== */
	.collab-list {
		display: flex;
		flex-wrap: wrap;
		gap: 18px 22px;
		margin: 14px 0 4px;
	}

	.collab-item {
		font-size: 14px;
		font-weight: 500;
		color: #1a1a1a;
	}

	.collab-item :global(i) {
		color: #00b3b0;
		font-size: 13px;
		margin-right: 4px;
	}

	.inline-link {
		color: #038d8f;
		font-weight: 500;
		text-decoration: none;
		border-bottom: 1px solid rgba(3, 141, 143, 0.25);
		transition: color 0.15s, border-color 0.15s;
	}

	.inline-link:hover {
		color: #00b3b0;
		border-bottom-color: rgba(0, 179, 176, 0.6);
	}

	/* ===== Team ===== */
	.team-partners {
		padding: 16px 0 8px;
		text-align: center;
	}

	.partners-label {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6b7280;
		margin: 0 auto 20px;
	}

	.partners-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 40px;
		row-gap: 24px;
	}

	.partner-logo {
		height: 48px;
		width: auto;
		max-width: 160px;
		object-fit: contain;
		filter: grayscale(100%);
		opacity: 0.8;
		transition: filter 0.2s, opacity 0.2s;
	}

	.partner-logo:hover {
		filter: grayscale(0%);
		opacity: 1;
	}

	.team-list {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}

	.team-list li {
		font-size: 14px;
		color: #6b7280;
		line-height: 1.55;
		padding: 4px 0;
	}

	.team-list li strong {
		color: #1a1a1a;
		font-weight: 600;
	}
</style>
