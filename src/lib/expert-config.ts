/**
 * Configuration + helpers for the `/experts/[expertId]` review experience.
 */

/**
 * Which benchmark this expert is scoped to. We only surface
 * HumaneBench metrics under their assigned subarea.
 */
export const EXPERT_BENCHMARK_SLUG = 'humanebench';

export interface MaskedModel {
	label: string; // "Model A"
	id: string; // real model id, still used for data lookups
}

/**
 * The (only) three models we present to experts. Real ids are preserved on
 * the backend when submissions are made, but experts see Model A/B/C only.
 */
const EXPERT_MODEL_POOL: readonly string[] = [
	'claude-sonnet-4-6',
	'gemini-2-5-pro',
	'qwen3-80b'
];

function isValidMapping(parsed: unknown): parsed is MaskedModel[] {
	const labels = ['Model A', 'Model B', 'Model C'];
	if (!Array.isArray(parsed) || parsed.length !== EXPERT_MODEL_POOL.length) return false;
	return (
		parsed.every(
			(m, i) =>
				m &&
				typeof m === 'object' &&
				typeof (m as MaskedModel).id === 'string' &&
				EXPERT_MODEL_POOL.includes((m as MaskedModel).id) &&
				(m as MaskedModel).label === labels[i]
		) && new Set(parsed.map((m) => (m as MaskedModel).id)).size === parsed.length
	);
}

/**
 * Return a stable Model A/B/C mapping. Prefer a previously persisted mapping
 * (e.g. from Supabase); otherwise shuffle once. `regenerated` is true when
 * the caller should persist the returned mapping.
 */
export function resolveExpertMaskedModels(existing?: MaskedModel[] | null): {
	mapping: MaskedModel[];
	regenerated: boolean;
} {
	if (existing && isValidMapping(existing)) {
		return { mapping: existing, regenerated: false };
	}

	const labels = ['Model A', 'Model B', 'Model C'];
	const shuffled = [...EXPERT_MODEL_POOL];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return {
		mapping: labels.map((label, i) => ({
			label,
			id: shuffled[i]
		})),
		regenerated: true
	};
}
