/**
 * Configuration + helpers for the hidden `/experts` mock experience.
 * Not linked from anywhere in the public app.
 */

/** Mock signed-in expert. Swap for real auth later. */
export const MOCK_EXPERT_USER = {
	name: 'Expert ABC',
	subareaId: 'social-relationships',
	subareaLabel: 'Social Relationships'
} as const;

/**
 * Which benchmark this expert is scoped to. For the mock we only surface
 * HumaneBench × Social Relationships metrics (per the product spec).
 */
export const EXPERT_BENCHMARK_SLUG = 'humanebench';

/** Per-scenario evaluation form the expert is asked to fill out. */
export const EXPERT_QUALTRICS_URL = 'https://usc.qualtrics.com/jfe/form/SV_8B4UrSDBpVMZrXU';

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

const EXPERT_MASK_STORAGE_KEY = 'impactbench.expertModelMapping.v1';

/**
 * Return the expert's masked model list ("Model A/B/C" → real ids), with the
 * real ids shuffled once per browser and persisted so a refresh doesn't
 * reveal which model is which. The real id is *only* used for looking up
 * conversation data and is submitted alongside each evaluation so the
 * backend can un-mask it.
 */
export function getExpertMaskedModels(): MaskedModel[] {
	const labels = ['Model A', 'Model B', 'Model C'];

	// Try to restore a previously randomised assignment so the mapping is
	// stable across reloads for the same expert.
	if (typeof window !== 'undefined') {
		try {
			const raw = window.localStorage.getItem(EXPERT_MASK_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as MaskedModel[];
				if (
					Array.isArray(parsed) &&
					parsed.length === EXPERT_MODEL_POOL.length &&
					parsed.every(
						(m, i) =>
							m &&
							typeof m.id === 'string' &&
							EXPERT_MODEL_POOL.includes(m.id) &&
							m.label === labels[i]
					) &&
					new Set(parsed.map((m) => m.id)).size === parsed.length
				) {
					return parsed;
				}
			}
		} catch {
			// fall through and re-shuffle
		}
	}

	// Fisher–Yates shuffle of the pool
	const shuffled = [...EXPERT_MODEL_POOL];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	const mapping: MaskedModel[] = labels.map((label, i) => ({
		label,
		id: shuffled[i]
	}));

	if (typeof window !== 'undefined') {
		try {
			window.localStorage.setItem(EXPERT_MASK_STORAGE_KEY, JSON.stringify(mapping));
		} catch {
			// ignore storage failures
		}
	}
	return mapping;
}
