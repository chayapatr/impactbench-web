import { getSupabase } from '$lib/supabase';
import type { MaskedModel } from '$lib/expert-config';
import type {
	CreateExpertInput,
	ExpertFormState,
	ExpertRow,
	ScenarioEvaluationInput
} from '$lib/experts/types';

export async function createExpert(input: CreateExpertInput): Promise<ExpertRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('experts')
		.insert({
			name: input.name,
			email: input.email,
			job_title: input.job_title ?? null,
			website: input.website || null,
			cv_filename: input.cv_filename || null,
			expertise_description: input.expertise_description ?? null,
			expertise_subarea_ids: input.expertise_subarea_ids,
			subarea_id: input.subarea_id,
			subarea_label: input.subarea_label,
			form_state: {},
			status: 'in_progress'
		})
		.select()
		.single();

	if (error) throw new Error(error.message);
	return data as ExpertRow;
}

export async function getExpert(id: string): Promise<ExpertRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase.from('experts').select('*').eq('id', id).maybeSingle();
	if (error) throw new Error(error.message);
	return data as ExpertRow | null;
}

export async function saveExpertDraft(
	id: string,
	patch: {
		form_state?: ExpertFormState;
		model_mapping?: MaskedModel[] | null;
		pre_read_acknowledged?: boolean;
		pre_read_signer_name?: string | null;
	}
): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase
		.from('experts')
		.update({
			...patch,
			updated_at: new Date().toISOString()
		})
		.eq('id', id);
	if (error) throw new Error(error.message);
}

export async function acknowledgePreRead(id: string, signedName: string): Promise<void> {
	await saveExpertDraft(id, {
		pre_read_acknowledged: true,
		pre_read_signer_name: signedName
	});
}

export async function markExpertCompleted(id: string): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase
		.from('experts')
		.update({
			status: 'completed',
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.eq('id', id);
	if (error) throw new Error(error.message);
}

export async function submitScenarioEvaluation(input: ScenarioEvaluationInput): Promise<void> {
	const supabase = getSupabase();
	const row = {
		...input,
		submitted: true,
		submitted_at: input.submitted_at ?? new Date().toISOString()
	};
	const { error } = await supabase.from('expert_evaluations').upsert(row, {
		onConflict: 'expert_id,metric_id,scenario_id,model_id'
	});
	if (error) throw new Error(error.message);
}
