import { getSupabase } from '$lib/supabase';
import type {
	Benchmark,
	ConversationWithResult,
	Model,
	MetricDetail,
	MetricListItem,
	MetricPlacements,
	MetricType,
	NutritionCategory,
	PipelineRole,
	PipelineRoleModel,
	Provider,
	Score,
	ScenarioWithConversations,
	TaxonomyArea,
	TaxonomySubarea
} from './types';
import type { ImportPayload, MetricExportRow } from './csv-import';

// Unlike src/lib/admin/db.ts, these reads don't go through SECURITY DEFINER
// RPCs — the underlying tables are public-read by design (see the "Public
// read access" section of supabase/metrics_schema.sql), so a plain
// `.from(...).select(...)` is the correct, minimal-indirection way to read
// them, same as the public /metrics page reads its R2 JSON directly.

// PostgREST returns a one-to-one embed (scores.conversation_id is unique) as
// a single object on recent versions, but as a one-item array on some setups
// — normalize defensively rather than assume either.
function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
	if (value == null) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Validates an admin capability key by calling the /admin dashboard's
 * admin_overview RPC and discarding the result — there's no standalone
 * validator RPC yet, and this tool shares the same admin_keys credential
 * store as /admin, so piggybacking is deliberate for now rather than
 * duplicating _assert_admin's error-code check against a second RPC.
 * Revisit once /metrics-admin gets its own write RPCs.
 */
export async function validateAdminKey(key: string): Promise<boolean> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('admin_overview', { p_admin_key: key });
	if (!error) return true;
	if (error.code === '28000' || error.message?.toLowerCase().includes('admin key')) return false;
	throw new Error(error.message);
}

export interface ImportSummary {
	benchmarks_processed: number;
	metrics_created: number;
	metrics_updated: number;
	metrics_unchanged: number;
	scenarios_added: number;
}

/** Merges the given payload into the existing benchmarks/metrics — matched
 * by (benchmark_slug, slug) — via the admin_import_metrics_csv SECURITY
 * DEFINER RPC — see its comment in supabase/metrics_schema.sql. Never
 * deletes: unmatched existing metrics are left untouched, matched metrics
 * whose content changed get a new version, matched metrics with identical
 * content are left alone. This is the one real (non-demo) write path in
 * /metrics-admin. */
export async function importMetricsCsv(
	adminKey: string,
	payload: ImportPayload
): Promise<ImportSummary> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_import_metrics_csv', {
		p_admin_key: adminKey,
		p_payload: payload
	});
	if (error) throw new Error(error.message);
	return data as ImportSummary;
}

export async function listBenchmarks(): Promise<Benchmark[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('benchmarks').select('*').order('name');
	if (error) throw new Error(error.message);
	return (data ?? []) as Benchmark[];
}

export async function listModels(): Promise<Model[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('models').select('*').order('display_name');
	if (error) throw new Error(error.message);
	return (data ?? []) as Model[];
}

/** Providers hold the api key, so — unlike models — they're not public-read;
 * this goes through admin_list_providers (SECURITY DEFINER), which never
 * returns the raw key, only api_key_set. See supabase/metrics_schema.sql. */
export async function listProviders(adminKey: string): Promise<Provider[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_list_providers', { p_admin_key: adminKey });
	if (error) throw new Error(error.message);
	return (data ?? []) as Provider[];
}

/** Sets (or clears, if apiKey is blank) one provider's api key via
 * admin_set_provider_api_key. The key is never read back — only
 * api_key_set (from listProviders) reflects whether it's configured. */
export async function setProviderApiKey(
	adminKey: string,
	providerId: string,
	apiKey: string
): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('admin_set_provider_api_key', {
		p_admin_key: adminKey,
		p_provider_id: providerId,
		p_api_key: apiKey
	});
	if (error) throw new Error(error.message);
}

/** Public-read like models/benchmarks — no secrets here, just which
 * provider + model string plays each pipeline role. */
export async function listPipelineRoleModels(): Promise<PipelineRoleModel[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('pipeline_role_models').select('*');
	if (error) throw new Error(error.message);
	return (data ?? []) as PipelineRoleModel[];
}

export async function setPipelineRoleModel(
	adminKey: string,
	role: PipelineRole,
	providerId: string,
	model: string
): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('admin_set_pipeline_role_model', {
		p_admin_key: adminKey,
		p_role: role,
		p_provider_id: providerId,
		p_model: model
	});
	if (error) throw new Error(error.message);
}

export async function listTaxonomyAreas(): Promise<TaxonomyArea[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('taxonomy_areas').select('*').order('sort_order');
	if (error) throw new Error(error.message);
	return (data ?? []) as TaxonomyArea[];
}

export async function listTaxonomySubareas(): Promise<TaxonomySubarea[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('taxonomy_subareas').select('*').order('sort_order');
	if (error) throw new Error(error.message);
	return (data ?? []) as TaxonomySubarea[];
}

export async function listNutritionCategories(): Promise<NutritionCategory[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('nutrition_categories')
		.select('*')
		.order('sort_order');
	if (error) throw new Error(error.message);
	return (data ?? []) as NutritionCategory[];
}

interface RawMetricExportRow {
	name: string;
	type: MetricType;
	definition: string;
	examples: string[];
	raw: Record<string, unknown>;
	suggested_placements: string[] | null;
	benchmark: Pick<Benchmark, 'name'> | null;
	scenarios: { title: string; source: string; generated_at: string }[];
}

/** Every metric's content, shaped as rows in the exact CSV column format
 * import_metrics_csv.py / parseImportPlan expect (see
 * $lib/metrics-admin/csv-import.ts) — so exporting, hand-editing, and
 * re-importing round-trips. Pass a benchmark id to export just that
 * benchmark, or omit it to export everything. */
export async function getMetricsForExport(benchmarkId?: string): Promise<MetricExportRow[]> {
	const supabase = getSupabase();
	let query = supabase
		.from('metrics')
		.select(
			`
			name, type, definition, examples, raw, suggested_placements,
			benchmark:benchmarks(name),
			scenarios(title, source, generated_at)
		`
		)
		.order('slug');
	if (benchmarkId) query = query.eq('benchmark_id', benchmarkId);
	const { data, error } = await query;
	if (error) throw new Error(error.message);

	return ((data ?? []) as unknown as RawMetricExportRow[]).map((row) => {
		const scenarios = [...row.scenarios].sort((a, b) => {
			if (a.source !== b.source) return a.source === 'submitted' ? -1 : 1;
			return a.generated_at.localeCompare(b.generated_at);
		});
		const internalCategory = row.raw.internal_category;
		const submittedDate = row.raw.submitted_date;
		return {
			benchmarkName: row.benchmark?.name ?? '',
			metricName: row.name,
			definition: row.definition,
			type: row.type,
			examples: row.examples,
			suggestedPlacements: row.suggested_placements ?? [],
			internalCategory: typeof internalCategory === 'string' ? internalCategory : null,
			submittedDate: typeof submittedDate === 'string' ? submittedDate : null,
			scenarioTitles: scenarios.slice(0, 3).map((s) => s.title)
		} satisfies MetricExportRow;
	});
}

/** Real placements for a metric — genuinely empty until either a curator
 * assigns one (needs a write RPC, not built yet) or a future import seeds
 * taxonomy_placements/nutrition_placements directly. An empty result here
 * is accurate data, not a loading state. */
export async function getMetricPlacements(metricId: string): Promise<MetricPlacements> {
	const supabase = getSupabase();
	const [taxonomyRes, nutritionRes] = await Promise.all([
		supabase
			.from('taxonomy_placements')
			.select(
				'metric_id, subarea_id, group_name, subarea:taxonomy_subareas(name, area:taxonomy_areas(name))'
			)
			.eq('metric_id', metricId),
		supabase
			.from('nutrition_placements')
			.select('metric_id, nutrition_category_id, category:nutrition_categories(name)')
			.eq('metric_id', metricId)
	]);
	if (taxonomyRes.error) throw new Error(taxonomyRes.error.message);
	if (nutritionRes.error) throw new Error(nutritionRes.error.message);
	return {
		taxonomy: (taxonomyRes.data ?? []) as unknown as MetricPlacements['taxonomy'],
		nutrition: (nutritionRes.data ?? []) as unknown as MetricPlacements['nutrition']
	};
}

interface RawListRow {
	id: string;
	slug: string;
	status: MetricListItem['status'];
	name: string;
	type: MetricType;
	benchmark: Pick<Benchmark, 'slug' | 'name'> | null;
	taxonomy_placements: {
		subarea_id: string;
		subarea: { name: string; area: { id: string; name: string } | null } | null;
	}[];
	scenarios: { conversations: { score: { passed: boolean } | { passed: boolean }[] | null }[] }[];
}

export async function listMetrics(): Promise<MetricListItem[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('metrics')
		.select(
			`
			id, slug, status, name, type,
			benchmark:benchmarks(slug, name),
			taxonomy_placements(subarea_id, subarea:taxonomy_subareas(name, area:taxonomy_areas(id, name))),
			scenarios(
				conversations(
					score:scores(passed)
				)
			)
		`
		)
		.order('slug');
	if (error) throw new Error(error.message);

	return ((data ?? []) as unknown as RawListRow[]).map((row) => {
		let passed = 0;
		let total = 0;
		for (const scenario of row.scenarios ?? []) {
			for (const conversation of scenario.conversations) {
				const score = firstOrNull(conversation.score);
				if (!score) continue;
				total += 1;
				if (score.passed) passed += 1;
			}
		}
		const subareas = (row.taxonomy_placements ?? [])
			.map((p) =>
				p.subarea?.area
					? {
							subarea_id: p.subarea_id,
							subarea_name: p.subarea.name,
							area_id: p.subarea.area.id,
							area_name: p.subarea.area.name
						}
					: null
			)
			.filter((s): s is MetricListItem['subareas'][number] => s !== null);
		return {
			id: row.id,
			slug: row.slug,
			status: row.status,
			name: row.name,
			type: row.type,
			benchmark: row.benchmark ?? { slug: '', name: '(unknown benchmark)' },
			subareas,
			passed_count: passed,
			total_count: total
		} satisfies MetricListItem;
	});
}

interface RawConversationEmbed extends Omit<ConversationWithResult, 'score'> {
	score: Score | Score[] | null;
}
interface RawScenarioEmbed extends Omit<ScenarioWithConversations, 'conversations'> {
	conversations: RawConversationEmbed[];
}
interface RawDetailRow extends Omit<MetricDetail, 'benchmark' | 'scenarios'> {
	benchmark: MetricDetail['benchmark'] | null;
	scenarios: RawScenarioEmbed[];
}

export async function getMetricDetail(metricId: string): Promise<MetricDetail | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('metrics')
		.select(
			`
			id, benchmark_id, slug, status, name, type, definition, examples,
			matters_because, contributor, raw, content_hash, suggested_placements,
			created_at, updated_at,
			benchmark:benchmarks(slug, name),
			scenarios(
				id, metric_id, demographic, title, persona, user_goal,
				latent_adversarial_goal, landmarks, source_id, source, raw, generated_at,
				conversations(
					id, scenario_id, model_id, sample_index, transcript, generated_at,
					model:models(id, slug, display_name),
					score:scores(id, conversation_id, present, passed, justification, created_at)
				)
			)
		`
		)
		.eq('id', metricId)
		.maybeSingle();
	if (error) throw new Error(error.message);

	const row = data as unknown as RawDetailRow | null;
	if (!row) return null;

	const scenarios: ScenarioWithConversations[] = row.scenarios.map((scenario) => ({
		...scenario,
		conversations: scenario.conversations.map(
			(conversation): ConversationWithResult => ({
				...conversation,
				score: firstOrNull(conversation.score)
			})
		)
	}));

	return {
		...row,
		benchmark: row.benchmark ?? { slug: '', name: '(unknown benchmark)' },
		scenarios
	};
}
