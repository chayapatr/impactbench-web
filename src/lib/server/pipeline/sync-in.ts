import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseAdmin } from './supabase-admin';
import { getPipelineRepoPath } from './env';

interface PipelineScenario {
	id: string;
	metric_id: string; // the metric's Supabase slug, by construction (see sync-out.ts)
	persona?: string;
	// bench-py's expand_demographics() (lib/core/generate.py, impactbench
	// repo) asks its demographic-rewrite prompt for a field called
	// "user_persona", but only ever reads back "persona" when merging the
	// result — so the age/demographic-adjusted rewrite lands in scenarios.json
	// under this key instead, and the original, unadjusted persona survives
	// untouched. Preferring user_persona here (browser/database side) fixes
	// the symptom (every demographic variant of a scenario showing identical
	// persona text) without touching that shared, upstream repo.
	user_persona?: string;
	user_goal?: string;
	latent_adversarial_goal?: string;
	landmarks?: Array<{ turn: number; instruction: string }>;
	demographic?: Record<string, string>;
	seed_title?: string;
}

/** Reads benchmarks/<slug>/scenarios.json after a gen_scenarios(_from_seeds)
 * run and upserts every row into Supabase's scenarios table, matched by
 * (metric_id, source_id) — same key admin_import_metrics_csv upserts on, so
 * re-running a phase (or running it after new seeds were imported) never
 * duplicates rows, only updates them in place. Metrics whose scenarios were
 * touched move from 'draft' to 'ready_to_simulate' (only if still 'draft' —
 * never regresses a metric that's already further along).
 */
export async function syncScenariosBack(
	benchmarkSlug: string
): Promise<{ upserted: number; skipped: number }> {
	const scenariosPath = path.join(
		getPipelineRepoPath(),
		'benchmarks',
		benchmarkSlug,
		'scenarios.json'
	);
	if (!fs.existsSync(scenariosPath)) {
		throw new Error(`scenarios.json not found for ${benchmarkSlug} — did the run actually finish?`);
	}
	const scenarios: PipelineScenario[] = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));

	const supabase = getSupabaseAdmin();
	const { data: benchmark, error: benchErr } = await supabase
		.from('benchmarks')
		.select('id')
		.eq('slug', benchmarkSlug)
		.single();
	if (benchErr || !benchmark) throw new Error(`Benchmark not found: ${benchmarkSlug}`);

	const { data: metrics, error: metricsErr } = await supabase
		.from('metrics')
		.select('id, slug')
		.eq('benchmark_id', benchmark.id);
	if (metricsErr) throw metricsErr;

	const metricIdBySlug = new Map((metrics ?? []).map((m) => [m.slug, m.id]));

	let upserted = 0;
	let skipped = 0;
	const touchedMetricIds = new Set<string>();

	for (const sc of scenarios) {
		const metricId = metricIdBySlug.get(sc.metric_id);
		if (!metricId) {
			// Stale/renamed metric slug in an old scenarios.json — skip rather
			// than guess, this row will regenerate correctly next real run.
			skipped++;
			continue;
		}

		const title = sc.seed_title ?? sc.user_goal ?? sc.id;
		const { error } = await supabase.from('scenarios').upsert(
			{
				metric_id: metricId,
				source_id: sc.id,
				source: 'generated',
				title: title.slice(0, 500),
				persona: sc.user_persona ?? sc.persona ?? null,
				user_goal: sc.user_goal ?? null,
				latent_adversarial_goal: sc.latent_adversarial_goal ?? null,
				landmarks: sc.landmarks ?? [],
				demographic: sc.demographic ?? {},
				raw: sc
			},
			{ onConflict: 'metric_id,source_id' }
		);
		if (error) throw error;
		upserted++;
		touchedMetricIds.add(metricId);
	}

	if (touchedMetricIds.size > 0) {
		await supabase
			.from('metrics')
			.update({ status: 'ready_to_simulate' })
			.in('id', [...touchedMetricIds])
			.eq('status', 'draft');
	}

	return { upserted, skipped };
}
