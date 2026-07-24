// Row shapes for the metrics-authoring tables in supabase/metrics_schema.sql,
// plus the composite shapes the /metrics-admin UI actually queries for
// (metric + its current version, scenarios with their conversations/scores).
import type { ChatTurn } from '$lib/types';

// Workflow order — also the order /metrics-admin's sidebar filter and the
// "Status" sort use. No "generating"/"simulating" in-progress statuses:
// those are transient (a modal's local progress state while an action
// runs), not worth persisting — a row lands on the next status below once
// the action completes. There's also no separate "ready to evaluate" /
// "evaluating" status: real per-model evaluation is still undesigned (it's
// inherently per-model, so a single metric-level status can't capture it),
// so a metric that's passed its test simulation is just 'ready_to_publish'
// already — evaluation results will layer on top once that's designed.
export const METRIC_STATUS_ORDER = [
	'draft',
	'ready_to_simulate',
	'ready_to_publish',
	'published'
] as const;

export type MetricStatus = (typeof METRIC_STATUS_ORDER)[number];

export type MetricType = 'positive' | 'negative';
export type ScenarioSource = 'generated' | 'submitted';
export type ModelStatus = 'active' | 'retired';

export interface Model {
	id: string;
	slug: string;
	display_name: string;
	provider_id: string;
	/** The real litellm model string (config.yaml's targets[].model) --
	 * often different from slug (slug is the short run_dir id). Null for a
	 * model row nobody's filled this in for yet; such rows are excluded from
	 * the Pipeline roles dropdown in Models & Ops. */
	litellm_model: string | null;
	surfaces: string[];
	status: ModelStatus;
	created_at: string;
	updated_at: string;
}

/** Real provider identity (anthropic/openai/deepinfra/xai/publicai) --
 * deliberately separate from litellm's `source` dialect (config.yaml shows
 * e.g. xAI and PublicAI both dialect as `source: openai`). Holds the api
 * key server-side only: this shape (from admin_list_providers) never
 * includes the raw key, just whether one is set. */
export interface Provider {
	id: string;
	slug: string;
	display_name: string;
	source: string;
	base_url: string | null;
	extra_headers: Record<string, string>;
	api_key_set: boolean;
	created_at: string;
	updated_at: string;
}

/** Which model plays each fixed pipeline role -- config.yaml's user_model
 * (gen_metrics, gen_scenarios, demographic expansion, and the adversarial
 * "user" simulator in `simulate`) and evaluator_model (evaluate). Public-read
 * (no secrets here, just provider + model string); base URL/auth are
 * resolved from the linked Provider at run time by the bridge, not
 * duplicated here. */
export type PipelineRole = 'user_model' | 'evaluator_model';

export interface PipelineRoleModel {
	role: PipelineRole;
	provider_id: string;
	model: string;
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

/** A metric's identity, workflow state, and content are all one row now —
 * there's no separate version history. An edit is just an update; the only
 * thing content_hash is for is letting the CSV importer cheaply tell
 * "actually changed" from "re-imported the same row". */
export interface Metric {
	id: string;
	benchmark_id: string;
	slug: string;
	status: MetricStatus;
	name: string;
	type: MetricType;
	definition: string;
	examples: string[];
	matters_because: string | null;
	contributor: string | null;
	/** Escape hatch for source-specific fields that haven't earned a real column yet. */
	raw: Record<string, unknown>;
	content_hash: string;
	suggested_placements: string[] | null;
	created_at: string;
	updated_at: string;
}

export interface Landmark {
	turn: number;
	instruction: string;
}

export interface Scenario {
	id: string;
	metric_id: string;
	/** Arbitrary demographic-axis -> descriptive-value map, e.g.
	 * { age: "Adult (18+)" } -- config.yaml's demographics block is an open
	 * set of axes, not just age, so this isn't a fixed enum. */
	demographic: Record<string, string>;
	title: string;
	persona: string | null;
	user_goal: string | null;
	/** What the user is implicitly trying to elicit -- not shown to the
	 * target model. Null for submitted (not yet pipeline-generated) scenarios. */
	latent_adversarial_goal: string | null;
	/** Turn-by-turn adversarial pressure script. Empty for submitted scenarios. */
	landmarks: Landmark[];
	source_id: string | null;
	source: ScenarioSource;
	raw: Record<string, unknown>;
	generated_at: string;
}

export interface Conversation {
	id: string;
	scenario_id: string;
	model_id: string;
	/** Which independent sample this is when generation.num_samples > 1 (see
	 * the docs' "Reliability" section) -- 0 for the common single-sample case. */
	sample_index: number;
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
	metric_id: string;
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

/** One row in the metric list column: the metric's name/type plus a
 * pass-rate rollup across all its scenarios/conversations. */
export interface MetricListItem {
	id: string;
	slug: string;
	status: MetricStatus;
	name: string;
	type: MetricType;
	benchmark: Pick<Benchmark, 'slug' | 'name'>;
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

/** Full detail panel payload: the metric (content and all) plus its
 * benchmark and every scenario generated/submitted for it. */
export interface MetricDetail extends Metric {
	benchmark: Pick<Benchmark, 'slug' | 'name'>;
	scenarios: ScenarioWithConversations[];
}

/** Real taxonomy/nutrition placements for one metric, joined with the
 * subarea/category display names. Empty arrays are a genuine, honest
 * "not placed yet" state — not a loading/error state. */
export interface MetricPlacements {
	taxonomy: (TaxonomyPlacement & {
		subarea: Pick<TaxonomySubarea, 'name'> & { area: Pick<TaxonomyArea, 'name'> };
	})[];
	nutrition: (NutritionPlacement & { category: Pick<NutritionCategory, 'name'> })[];
}
