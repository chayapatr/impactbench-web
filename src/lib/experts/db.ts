import { getSupabase } from '$lib/supabase';
import type { MaskedModel } from '$lib/expert-config';
import type {
	CreateExpertInput,
	ExpertFormState,
	ExpertRow,
	ScenarioEvaluationInput
} from '$lib/experts/types';

export class ExpertDraftConflictError extends Error {
	constructor(message = 'expert_draft_conflict') {
		super(message);
		this.name = 'ExpertDraftConflictError';
	}
}

function asExpertRow(data: unknown): ExpertRow {
	return data as ExpertRow;
}

function isConflictError(error: { message?: string; code?: string } | null): boolean {
	if (!error) return false;
	return (
		error.code === 'P0001' ||
		(error.message?.includes('expert_draft_conflict') ?? false)
	);
}

export async function createExpert(input: CreateExpertInput): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('create_expert', {
		p_name: input.name,
		p_email: input.email,
		p_job_title: input.job_title ?? null,
		p_website: input.website || null,
		p_cv_filename: input.cv_filename || null,
		p_expertise_description: input.expertise_description ?? null,
		p_expertise_subarea_ids: input.expertise_subarea_ids,
		p_subarea_id: input.subarea_id,
		p_subarea_label: input.subarea_label
	});

	if (error) throw new Error(error.message);
	return asExpertRow(data);
}

export async function getExpert(id: string): Promise<ExpertRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('get_expert', { p_id: id });
	if (error) throw new Error(error.message);
	return data ? asExpertRow(data) : null;
}

export async function saveExpertDraft(
	id: string,
	expectedUpdatedAt: string,
	patch: {
		form_state?: ExpertFormState;
		model_mapping?: MaskedModel[] | null;
		pre_read_acknowledged?: boolean;
		pre_read_signer_name?: string | null;
	}
): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('update_expert_draft', {
		p_id: id,
		p_expected_updated_at: expectedUpdatedAt,
		p_form_state: patch.form_state ?? null,
		p_model_mapping: patch.model_mapping ?? null,
		p_pre_read_acknowledged: patch.pre_read_acknowledged ?? null,
		p_pre_read_signer_name: patch.pre_read_signer_name ?? null
	});

	if (isConflictError(error)) throw new ExpertDraftConflictError(error?.message);
	if (error) throw new Error(error.message);
	return asExpertRow(data);
}

/** First writer wins; always returns the canonical mapping row. */
export async function claimExpertModelMapping(
	id: string,
	mapping: MaskedModel[]
): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('claim_expert_model_mapping', {
		p_id: id,
		p_mapping: mapping
	});
	if (error) throw new Error(error.message);
	return asExpertRow(data);
}

export async function acknowledgePreRead(
	id: string,
	signedName: string,
	expectedUpdatedAt: string
): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('acknowledge_expert_pre_read', {
		p_id: id,
		p_signed_name: signedName,
		p_expected_updated_at: expectedUpdatedAt
	});
	if (isConflictError(error)) throw new ExpertDraftConflictError(error?.message);
	if (error) throw new Error(error.message);
	return asExpertRow(data);
}

export async function markExpertCompleted(id: string): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('mark_expert_completed', { p_id: id });
	if (error) throw new Error(error.message);
	return asExpertRow(data);
}

export async function submitScenarioEvaluation(input: ScenarioEvaluationInput): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('upsert_expert_evaluation', {
		p_expert_id: input.expert_id,
		p_metric_id: input.metric_id,
		p_metric_name: input.metric_name,
		p_scenario_id: input.scenario_id,
		p_scenario_title: input.scenario_title,
		p_model_id: input.model_id,
		p_masked_model_label: input.masked_model_label,
		p_scenario_accurate: input.scenario_accurate,
		p_scenario_accurate_edit: input.scenario_accurate_edit,
		p_scenario_realistic: input.scenario_realistic,
		p_scenario_realistic_edit: input.scenario_realistic_edit,
		p_rating: input.rating,
		p_influenced_aspects: input.influenced_aspects,
		p_influenced_aspects_other: input.influenced_aspects_other,
		p_confidence: input.confidence,
		p_main_challenge: input.main_challenge,
		p_main_challenge_other: input.main_challenge_other,
		p_justification: input.justification,
		p_other_feedback: input.other_feedback,
		p_submitted_at: input.submitted_at ?? new Date().toISOString()
	});
	if (error) throw new Error(error.message);
}
