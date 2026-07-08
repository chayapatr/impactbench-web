/**
 * Configuration + helpers for the hidden `/experts` mock experience.
 * Not linked from anywhere in the public app.
 */

import type { AIModel } from './types';

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
	label: string; // "Model 1"
	id: string; // real model id, still used for data lookups
}

/**
 * Load the private "Model N → real id" mapping from
 * `static/data/expert-model-mapping.json`. That file is gitignored so the
 * mapping isn't exposed in source control. If it's missing at runtime, we
 * fall back to labeling models in their `appState.models` order, which
 * keeps the UI working (just with a less-scrambled masking).
 */
export async function loadExpertModelMapping(
	fetchFn: typeof fetch,
	fallbackModels: AIModel[]
): Promise<MaskedModel[]> {
	try {
		const res = await fetchFn('/data/expert-model-mapping.json');
		if (res.ok) {
			const data = (await res.json()) as MaskedModel[];
			if (Array.isArray(data) && data.length > 0) return data;
		}
	} catch {
		// swallow — fall through to fallback
	}
	return fallbackModels.map((m, i) => ({ label: `Model ${i + 1}`, id: m.id }));
}
