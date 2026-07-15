import type { MaskedModel } from '$lib/expert-config';

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
}

export interface ExpertRow {
	id: string;
	name: string;
	email: string;
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

export type Database = {
	public: {
		Tables: {
			experts: {
				Row: ExpertRow;
				Insert: Partial<ExpertRow> &
					Pick<ExpertRow, 'name' | 'email' | 'subarea_id' | 'subarea_label'>;
				Update: Partial<ExpertRow>;
				Relationships: [];
			};
			expert_evaluations: {
				Row: ScenarioEvaluationInput & {
					submitted: boolean;
					updated_at: string;
				};
				Insert: ScenarioEvaluationInput & { submitted?: boolean };
				Update: Partial<ScenarioEvaluationInput> & { submitted?: boolean };
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
};
