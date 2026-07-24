import fs from 'node:fs';
import path from 'node:path';
import { dump } from 'js-yaml';
import { getSupabaseAdmin } from './supabase-admin';
import { getPipelineRepoPath } from './env';

/** Writes benchmarks/<slug>/benchmark.yaml from whatever's currently in
 * Supabase, so a pipeline run always reflects the latest curated content
 * ("auto-sync on every run" — never a stale, manually-exported copy).
 *
 * Writes every metric in the benchmark, not just the one the UI action was
 * triggered on: gen_scenarios_from_seeds skips any metric with no
 * seed_scenarios and bench-py's row_cache means already-generated metrics
 * are cache hits, not re-billed API calls, so a whole-benchmark sync is both
 * simpler and safe to run from any single metric's "Generate Scenarios"
 * button — see gen_scenarios.py's run_from_seeds and lib/task/row_cache.
 *
 * A metric's real Supabase slug is used directly as the pipeline's opaque
 * metric["id"] — scenarios.json rows come back tagged with that same slug in
 * metric_id, so sync-in can match them straight back to the Supabase metric
 * by slug with no separate id-mapping table.
 */
export async function writeBenchmarkYaml(
	benchmarkSlug: string
): Promise<{ metricCount: number; seedCount: number }> {
	const supabase = getSupabaseAdmin();

	const { data: benchmark, error: benchErr } = await supabase
		.from('benchmarks')
		.select('id, slug, name, description, scenario_user_context, scenario_implicit_context')
		.eq('slug', benchmarkSlug)
		.single();
	if (benchErr || !benchmark) {
		throw new Error(`Benchmark not found: ${benchmarkSlug}`);
	}

	const { data: metrics, error: metricsErr } = await supabase
		.from('metrics')
		.select('id, slug, name, type, definition, examples, matters_because')
		.eq('benchmark_id', benchmark.id)
		.order('slug');
	if (metricsErr) throw metricsErr;
	if (!metrics || metrics.length === 0) {
		throw new Error(`Benchmark ${benchmarkSlug} has no metrics to sync.`);
	}

	const metricIds = metrics.map((m) => m.id);
	const { data: scenarios, error: scenariosErr } = await supabase
		.from('scenarios')
		.select('metric_id, title')
		.in('metric_id', metricIds)
		.eq('source', 'submitted')
		.order('generated_at');
	if (scenariosErr) throw scenariosErr;

	const seedsByMetricId = new Map<string, string[]>();
	for (const s of scenarios ?? []) {
		const list = seedsByMetricId.get(s.metric_id) ?? [];
		list.push(s.title);
		seedsByMetricId.set(s.metric_id, list);
	}

	const goal: Record<string, unknown> = {
		name: benchmark.name,
		description: benchmark.description ?? ''
	};
	if (benchmark.scenario_user_context || benchmark.scenario_implicit_context) {
		goal.scenario = {
			...(benchmark.scenario_user_context
				? { user_context: benchmark.scenario_user_context }
				: {}),
			...(benchmark.scenario_implicit_context
				? { implicit_context: benchmark.scenario_implicit_context }
				: {})
		};
	}

	let seedCount = 0;
	goal.metrics = metrics.map((m) => {
		const seeds = seedsByMetricId.get(m.id) ?? [];
		seedCount += seeds.length;
		return {
			id: m.slug,
			name: m.name,
			type: m.type,
			definition: m.definition,
			...(m.examples && m.examples.length ? { examples: m.examples } : {}),
			...(m.matters_because ? { matters_because: m.matters_because } : {}),
			...(seeds.length ? { seed_scenarios: seeds } : {})
		};
	});

	const benchDir = path.join(getPipelineRepoPath(), 'benchmarks', benchmarkSlug);
	fs.mkdirSync(benchDir, { recursive: true });
	fs.writeFileSync(path.join(benchDir, 'benchmark.yaml'), dump(goal, { lineWidth: -1 }));

	return { metricCount: metrics.length, seedCount };
}
