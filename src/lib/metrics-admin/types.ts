// Row shapes for the metrics-authoring tables in supabase/metrics_schema.sql,
// plus the composite shapes the /metrics-admin UI actually queries for
// (metric + its current version, scenarios with their conversations/scores).
import type { ChatTurn } from '$lib/types';

export type MetricStatus =
	| 'draft'
	| 'scenarios_generating'
	| 'ready_to_simulate'
	| 'evaluating'
	| 'ready_to_publish'
	| 'published';

export type MetricType = 'positive' | 'negative';
export type ScenarioAge = 'adult' | 'child';
export type ScenarioSource = 'generated' | 'submitted';
export type ModelStatus = 'active' | 'retired';

export interface Model {
	id: string;
	slug: string;
	display_name: string;
	provider: string;
	surfaces: string[];
	status: ModelStatus;
	created_at: string;
	updated_at: string;
}

export interface Benchmark {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	scenario_user_context: string | null;
	scenario_implicit_context: string | null;
	created_at: string;
	updated_at: string;
}

export interface Metric {
	id: string;
	benchmark_id: string;
	slug: string;
	status: MetricStatus;
	current_version_id: string | null;
	suggested_placements: string[] | null;
	created_at: string;
	updated_at: string;
}

export interface MetricVersion {
	id: string;
	metric_id: string;
	version_number: number;
	name: string;
	type: MetricType;
	definition: string;
	examples: string[];
	matters_because: string | null;
	contributor: string | null;
	/** Escape hatch for source-specific fields that haven't earned a real column yet. */
	raw: Record<string, unknown>;
	content_hash: string;
	created_at: string;
	created_by: string | null;
}

export interface Scenario {
	id: string;
	metric_version_id: string;
	age: ScenarioAge;
	title: string;
	persona: string | null;
	user_goal: string | null;
	source_id: string | null;
	source: ScenarioSource;
	raw: Record<string, unknown>;
	generated_at: string;
}

export interface Conversation {
	id: string;
	scenario_id: string;
	model_id: string;
	transcript: ChatTurn[];
	generated_at: string;
}

export interface Score {
	id: string;
	conversation_id: string;
	present: boolean | null;
	passed: boolean;
	justification: string | null;
	created_at: string;
}

export interface TaxonomyArea {
	id: string;
	slug: string;
	name: string;
	icon: string | null;
	color: string | null;
	sort_order: number;
}

export interface TaxonomySubarea {
	id: string;
	area_id: string;
	slug: string;
	name: string;
	icon: string | null;
	sort_order: number;
}

export interface NutritionCategory {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	sort_order: number;
}

export interface TaxonomyPlacement {
	metric_id: string;
	subarea_id: string;
	group_name: string | null;
}

export interface NutritionPlacement {
	metric_id: string;
	nutrition_category_id: string;
}

/** Real row shape for generation_runs. Not readable today (no public policy,
 * no admin-key RPC yet) — kept here only so mocked demo UI has a type to
 * shape its placeholder rows against. See the "still needed" list. */
export interface GenerationRun {
	id: string;
	metric_version_id: string;
	model_id: string | null;
	phase: 'gen_scenarios' | 'simulate' | 'evaluate' | 'aggregate';
	status: 'pending' | 'running' | 'done' | 'error';
	cost: number | null;
	input_tokens: number | null;
	output_tokens: number | null;
	error_message: string | null;
	started_at: string | null;
	finished_at: string | null;
	created_at: string;
}

// ── Composite shapes returned by metrics-admin/db.ts ──────────────────────

/** One taxonomy subarea a metric is placed under, flattened with its area's
 * id/name for filtering and breadcrumbs without a second lookup. */
export interface MetricSubareaRef {
	subarea_id: string;
	subarea_name: string;
	area_id: string;
	area_name: string;
}

/** One row in the metric list column: the metric plus its current version's
 * text and a pass-rate rollup across all its scenarios/conversations. */
export interface MetricListItem {
	id: string;
	slug: string;
	status: MetricStatus;
	benchmark: Pick<Benchmark, 'slug' | 'name'>;
	current_version: Pick<MetricVersion, 'name' | 'type'> | null;
	subareas: MetricSubareaRef[];
	passed_count: number;
	total_count: number;
}

export interface ConversationWithResult extends Conversation {
	model: Pick<Model, 'id' | 'slug' | 'display_name'>;
	score: Score | null;
}

export interface ScenarioWithConversations extends Scenario {
	conversations: ConversationWithResult[];
}

/** Full detail panel payload: the metric, its current version in full, and
 * every scenario generated/submitted for that version. */
export interface MetricDetail {
	id: string;
	benchmark_id: string;
	slug: string;
	status: MetricStatus;
	suggested_placements: string[] | null;
	created_at: string;
	updated_at: string;
	benchmark: Pick<Benchmark, 'slug' | 'name'>;
	current_version: MetricVersion;
	scenarios: ScenarioWithConversations[];
}

/** Real taxonomy/nutrition placements for one metric, joined with the
 * subarea/category display names. Empty arrays are a genuine, honest
 * "not placed yet" state — not a loading/error state. */
export interface MetricPlacements {
	taxonomy: (TaxonomyPlacement & { subarea: Pick<TaxonomySubarea, 'name'> & { area: Pick<TaxonomyArea, 'name'> } })[];
	nutrition: (NutritionPlacement & { category: Pick<NutritionCategory, 'name'> })[];
}
