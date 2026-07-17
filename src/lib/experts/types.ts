import type { ExpertChoiceOrder, MaskedModel } from '$lib/expert-config';

export type ExpertStatus = 'in_progress' | 'completed';

/** Serializable draft payload stored in experts.form_state */
export interface ExpertFormState {
	progress?: Record<
		string,
		{
			feedback: {
				relevance: string;
				relevanceEdit: string;
				labelDifferent: string;
				labelEdit: string;
				examplesAdequate: string;
				examplesEdit: string;
				other: string;
				submitted: boolean;
			};
			evaluated: string[];
		}
	>;
	evaluations?: Record<string, Record<string, unknown>>;
	unlocked?: string[];
	selectedMetricIdx?: number;
	phase?: 'feedback' | 'scenario';
	scenarioIdx?: number;
	modelIdx?: number;
	/** Frozen per-metric scenario order (scenario_id[]), keyed by metric id. */
	scenarioOrders?: Record<string, string[]>;
	/** Frozen Model A/B/C mapping per (metric, scenario) pair, keyed by `${metricId}__${scenarioId}`. */
	modelMappings?: Record<string, MaskedModel[]>;
	/**
	 * Frozen per-expert yes/no and pass/fail display polarity.
	 * Not-sure / borderline is always last; first option is randomised once.
	 */
	choiceOrder?: ExpertChoiceOrder;
	orientationAcknowledged?: boolean;
}

export interface ExpertRow {
	id: string;
	name: string;
	/** Present on create; redacted (null) on capability-token reads. */
	email: string | null;
	job_title: string | null;
	website: string | null;
	cv_filename: string | null;
	expertise_description: string | null;
	expertise_subarea_ids: string[];
	subarea_id: string;
	subarea_label: string;
	model_mapping: MaskedModel[] | null;
	form_state: ExpertFormState;
	pre_read_acknowledged: boolean;
	pre_read_signer_name: string | null;
	status: ExpertStatus;
	completed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreateExpertInput {
	name: string;
	email: string;
	job_title?: string;
	website?: string;
	cv_filename?: string;
	expertise_description?: string;
	expertise_subarea_ids: string[];
	subarea_id: string;
	subarea_label: string;
}

export interface ScenarioEvaluationInput {
	expert_id: string;
	metric_id: string;
	metric_name: string;
	scenario_id: string;
	scenario_title: string;
	model_id: string;
	masked_model_label: string;
	scenario_accurate: string;
	scenario_accurate_edit: string;
	scenario_realistic: string;
	scenario_realistic_edit: string;
	rating: string;
	influenced_aspects: string;
	influenced_aspects_other: string;
	confidence: string;
	main_challenge: string;
	main_challenge_other: string;
	justification: string;
	other_feedback: string;
	submitted_at?: string;
}

type RpcFn<Args extends Record<string, unknown>, Returns> = {
	Args: Args;
	Returns: Returns;
};

export type Database = {
	public: {
		Tables: {
			experts: {
				Row: ExpertRow;
				Insert: never;
				Update: never;
				Relationships: [];
			};
			expert_evaluations: {
				Row: ScenarioEvaluationInput & {
					submitted: boolean;
					updated_at: string;
				};
				Insert: never;
				Update: never;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			create_expert: RpcFn<
				{
					p_name: string;
					p_email: string;
					p_job_title: string | null;
					p_website: string | null;
					p_cv_filename: string | null;
					p_expertise_description: string | null;
					p_expertise_subarea_ids: string[];
					p_subarea_id: string;
					p_subarea_label: string;
				},
				ExpertRow
			>;
			get_expert: RpcFn<{ p_id: string }, ExpertRow | null>;
			update_expert_draft: RpcFn<
				{
					p_id: string;
					p_expected_updated_at: string;
					p_form_state: ExpertFormState | null;
					p_model_mapping: MaskedModel[] | null;
					p_pre_read_acknowledged: boolean | null;
					p_pre_read_signer_name: string | null;
				},
				ExpertRow
			>;
			claim_expert_model_mapping: RpcFn<
				{ p_id: string; p_mapping: MaskedModel[] },
				ExpertRow
			>;
			acknowledge_expert_pre_read: RpcFn<
				{ p_id: string; p_signed_name: string; p_expected_updated_at: string },
				ExpertRow
			>;
			mark_expert_completed: RpcFn<
				{
					p_id: string;
					p_required_evaluations: {
						metric_id: string;
						scenario_id: string;
						model_id: string;
					}[];
				},
				ExpertRow
			>;
			upsert_expert_evaluation: RpcFn<
				{
					p_expert_id: string;
					p_metric_id: string;
					p_metric_name: string;
					p_scenario_id: string;
					p_scenario_title: string;
					p_model_id: string;
					p_masked_model_label: string;
					p_scenario_accurate: string;
					p_scenario_accurate_edit: string;
					p_scenario_realistic: string;
					p_scenario_realistic_edit: string;
					p_rating: string;
					p_influenced_aspects: string;
					p_influenced_aspects_other: string;
					p_confidence: string;
					p_main_challenge: string;
					p_main_challenge_other: string;
					p_justification: string;
					p_other_feedback: string;
					p_submitted_at: string;
				},
				undefined
			>;
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
