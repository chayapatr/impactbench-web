// Shapes returned by the admin_* SECURITY DEFINER RPCs (see supabase/schema.sql).
// These mirror the jsonb the database builds; all reads are gated behind a
// non-revoked admin capability UUID.

export interface AdminOverview {
	experts_total: number;
	experts_completed: number;
	experts_in_progress: number;
	evaluations_total: number;
	metrics_covered: number;
	scenarios_covered: number;
	last_submission_at: string | null;
}

export interface AdminMetricSummary {
	metric_id: string;
	metric_name: string | null;
	evaluation_count: number;
	expert_count: number;
	scenario_count: number;
	last_submitted_at: string | null;
	/** rating value -> count, e.g. { yes: 4, no: 1, "(unrated)": 2 } */
	rating_breakdown: Record<string, number> | null;
}

export interface AdminEvaluationDetail {
	expert_id: string;
	expert_name: string | null;
	expert_subarea: string | null;
	metric_id: string;
	metric_name: string | null;
	scenario_id: string;
	scenario_title: string | null;
	model_id: string;
	masked_model_label: string | null;
	scenario_accurate: string | null;
	scenario_accurate_edit: string | null;
	scenario_realistic: string | null;
	scenario_realistic_edit: string | null;
	rating: string | null;
	influenced_aspects: string | null;
	influenced_aspects_other: string | null;
	confidence: string | null;
	main_challenge: string | null;
	main_challenge_other: string | null;
	justification: string | null;
	other_feedback: string | null;
	submitted_at: string;
}

/** Metric-level feedback from experts.form_state (before scenario evals). */
export interface AdminMetricFeedback {
	expert_id: string;
	expert_name: string | null;
	expert_subarea: string | null;
	metric_id: string;
	relevance: string | null;
	relevance_edit: string | null;
	label_different: string | null;
	label_edit: string | null;
	examples_adequate: string | null;
	examples_edit: string | null;
	other_feedback: string | null;
	updated_at: string;
}
