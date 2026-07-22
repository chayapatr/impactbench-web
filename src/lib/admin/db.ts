import { getSupabase } from '$lib/supabase';
import type {
	AdminEvaluationDetail,
	AdminMetricFeedback,
	AdminMetricSummary,
	AdminOverview
} from './types';

/** Thrown when the supplied admin key is missing, revoked, or unknown. */
export class AdminAuthError extends Error {
	constructor(message = 'invalid admin key') {
		super(message);
		this.name = 'AdminAuthError';
	}
}

/**
 * The validator raises with SQLSTATE 28000 (invalid_authorization_specification)
 * for a bad/missing key. Detect that so the UI can show a clean "invalid key"
 * state instead of a generic error.
 */
function isAuthError(error: { message?: string; code?: string } | null): boolean {
	if (!error) return false;
	return error.code === '28000' || (error.message?.toLowerCase().includes('admin key') ?? false);
}

export async function adminOverview(key: string): Promise<AdminOverview> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_overview', { p_admin_key: key });
	if (isAuthError(error)) throw new AdminAuthError(error?.message);
	if (error) throw new Error(error.message);
	return data as AdminOverview;
}

export async function adminMetricsSummary(key: string): Promise<AdminMetricSummary[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_metrics_summary', { p_admin_key: key });
	if (isAuthError(error)) throw new AdminAuthError(error?.message);
	if (error) throw new Error(error.message);
	return (data ?? []) as AdminMetricSummary[];
}

export async function adminMetricEvaluations(
	key: string,
	metricId: string
): Promise<AdminEvaluationDetail[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_metric_evaluations', {
		p_admin_key: key,
		p_metric_id: metricId
	});
	if (isAuthError(error)) throw new AdminAuthError(error?.message);
	if (error) throw new Error(error.message);
	return (data ?? []) as AdminEvaluationDetail[];
}

export async function adminMetricFeedback(
	key: string,
	metricId: string
): Promise<AdminMetricFeedback[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('admin_metric_feedback', {
		p_admin_key: key,
		p_metric_id: metricId
	});
	if (isAuthError(error)) throw new AdminAuthError(error?.message);
	if (error) throw new Error(error.message);
	return (data ?? []) as AdminMetricFeedback[];
}

/** Returns true when `key` is a live (non-revoked) admin capability UUID. */
export async function validateAdminKey(key: string): Promise<boolean> {
	try {
		await adminOverview(key);
		return true;
	} catch (e) {
		if (e instanceof AdminAuthError) return false;
		throw e;
	}
}
