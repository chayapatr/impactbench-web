import { getSupabase } from '$lib/supabase';
import type {
	Benchmark,
	ConversationWithResult,
	Model,
	MetricDetail,
	MetricListItem,
	MetricPlacements,
	MetricType,
	MetricVersion,
	NutritionCategory,
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

const CURRENT_VERSION_FK = 'metrics_current_version_fk';

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
	suggested_placements: string[] | null;
	benchmark: Pick<Benchmark, 'name'> | null;
	current_version:
		| (Pick<MetricVersion, 'name' | 'type' | 'definition' | 'examples' | 'raw'> & {
				scenarios: { title: string; source: string; generated_at: string }[];
		  })
		| null;
}

/** Every metric's current content, shaped as rows in the exact CSV column
 * format import_metrics_csv.py / parseImportPlan expect (see
 * $lib/metrics-admin/csv-import.ts) — so exporting, hand-editing, and
 * re-importing round-trips. Pass a benchmark id to export just that
 * benchmark, or omit it to export everything. Draft metrics with no
 * current_version are skipped (there's nothing to export yet). */
export async function getMetricsForExport(benchmarkId?: string): Promise<MetricExportRow[]> {
	const supabase = getSupabase();
	let query = supabase
		.from('metrics')
		.select(
			`
			suggested_placements,
			benchmark:benchmarks(name),
			current_version:metric_versions!${CURRENT_VERSION_FK}(
				name, type, definition, examples, raw,
				scenarios(title, source, generated_at)
			)
		`
		)
		.order('slug');
	if (benchmarkId) query = query.eq('benchmark_id', benchmarkId);
	const { data, error } = await query;
	if (error) throw new Error(error.message);

	return ((data ?? []) as unknown as RawMetricExportRow[])
		.filter((row) => row.current_version !== null)
		.map((row) => {
			const v = row.current_version!;
			const scenarios = [...v.scenarios].sort((a, b) => {
				if (a.source !== b.source) return a.source === 'submitted' ? -1 : 1;
				return a.generated_at.localeCompare(b.generated_at);
			});
			const raw = v.raw as Record<string, unknown>;
			const internalCategory = raw.internal_category;
			const submittedDate = raw.submitted_date;
			return {
				benchmarkName: row.benchmark?.name ?? '',
				metricName: v.name,
				definition: v.definition,
				type: v.type,
				examples: v.examples,
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
	benchmark: Pick<Benchmark, 'slug' | 'name'> | null;
	taxonomy_placements: {
		subarea_id: string;
		subarea: { name: string; area: { id: string; name: string } | null } | null;
	}[];
	current_version: {
		name: string;
		type: MetricType;
		scenarios: { conversations: { score: { passed: boolean } | { passed: boolean }[] | null }[] }[];
	} | null;
}

export async function listMetrics(): Promise<MetricListItem[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('metrics')
		.select(
			`
			id, slug, status,
			benchmark:benchmarks(slug, name),
			taxonomy_placements(subarea_id, subarea:taxonomy_subareas(name, area:taxonomy_areas(id, name))),
			current_version:metric_versions!${CURRENT_VERSION_FK}(
				name, type,
				scenarios(
					conversations(
						score:scores(passed)
					)
				)
			)
		`
		)
		.order('slug');
	if (error) throw new Error(error.message);

	return ((data ?? []) as unknown as RawListRow[]).map((row) => {
		let passed = 0;
		let total = 0;
		for (const scenario of row.current_version?.scenarios ?? []) {
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
			benchmark: row.benchmark ?? { slug: '', name: '(unknown benchmark)' },
			current_version: row.current_version
				? { name: row.current_version.name, type: row.current_version.type }
				: null,
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
interface RawDetailRow {
	id: string;
	benchmark_id: string;
	slug: string;
	status: MetricDetail['status'];
	suggested_placements: string[] | null;
	created_at: string;
	updated_at: string;
	benchmark: MetricDetail['benchmark'] | null;
	current_version: (MetricVersion & { scenarios: RawScenarioEmbed[] }) | null;
}

export async function getMetricDetail(metricId: string): Promise<MetricDetail | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('metrics')
		.select(
			`
			id, benchmark_id, slug, status, suggested_placements, created_at, updated_at,
			benchmark:benchmarks(slug, name),
			current_version:metric_versions!${CURRENT_VERSION_FK}(
				id, metric_id, version_number, name, type, definition, examples,
				matters_because, contributor, raw, content_hash, created_at, created_by,
				scenarios(
					id, metric_version_id, age, title, persona, user_goal, source_id, source, raw, generated_at,
					conversations(
						id, scenario_id, model_id, transcript, generated_at,
						model:models(id, slug, display_name),
						score:scores(id, conversation_id, present, passed, justification, created_at)
					)
				)
			)
		`
		)
		.eq('id', metricId)
		.maybeSingle();
	if (error) throw new Error(error.message);

	const row = data as unknown as RawDetailRow | null;
	if (!row?.current_version) return null;

	const scenarios: ScenarioWithConversations[] = row.current_version.scenarios.map((scenario) => ({
		...scenario,
		conversations: scenario.conversations.map(
			(conversation): ConversationWithResult => ({
				...conversation,
				score: firstOrNull(conversation.score)
			})
		)
	}));

	return {
		id: row.id,
		benchmark_id: row.benchmark_id,
		slug: row.slug,
		status: row.status,
		suggested_placements: row.suggested_placements,
		created_at: row.created_at,
		updated_at: row.updated_at,
		benchmark: row.benchmark ?? { slug: '', name: '(unknown benchmark)' },
		current_version: row.current_version,
		scenarios
	};
}
