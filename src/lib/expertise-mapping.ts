/**
 * Expertise → metrics mapping.
 *
 * Given one or more subarea IDs (as selected in the "Be an Expert" form),
 * returns the metrics that live under those subareas according to
 * `static/data/metric-subarea-map.json`.
 *
 * NOTE: Not yet wired into the app. Kept as a standalone module so the
 * expert-onboarding flow (and any downstream metric-assignment tooling)
 * can import it when needed.
 *
 * Usage:
 *   import { getMetricsForSubareas, SUBAREA_ID_TO_KEY } from '$lib/expertise-mapping';
 *
 *   const map = await loadMetricSubareaMap(); // fetch('/data/metric-subarea-map.json')
 *   const metrics = getMetricsForSubareas(map, ['social-relationships', 'safety-protection']);
 */

export interface MetricPlacement {
	area: string;
	area_name: string;
	subarea: string;
	subarea_name: string;
}

export interface MetricEntry {
	benchmark: string;
	benchmark_slug: string;
	metric_id: string;
	metric_short_id: string;
	metric_name: string;
	placements: MetricPlacement[];
}

export interface SubareaMetric {
	metric_id: string;
	metric_name: string;
	benchmark: string;
}

export interface MetricSubareaMap {
	generated_from: { csv: string; taxonomy: string };
	metrics: MetricEntry[];
	by_area_subarea: Record<string, Record<string, SubareaMetric[]>>;
}

/**
 * Subarea IDs shown in the "Be an Expert" form → keys used inside
 * `by_area_subarea` (which is indexed by display name).
 *
 * The form uses stable slug IDs; the map's second-level keys are the
 * display names from the taxonomy, so we bridge them here.
 */
export const SUBAREA_ID_TO_KEY: Record<string, { area: string; subarea: string }> = {
	'safety-protection': { area: 'Societal', subarea: 'Safety & Protection' },
	'social-relationships': { area: 'Societal', subarea: 'Social Relationships' },
	'education-career-finance': { area: 'Physical', subarea: 'Education, Career & Finance' },
	'mental-wellbeing': { area: 'Psychological', subarea: 'Mental Wellbeing' },
	'autonomy-preservation': { area: 'Psychological', subarea: 'Autonomy Preservation' },
	'creativity-cognitive-expression': {
		area: 'Psychological',
		subarea: 'Creativity & Cognitive Expression'
	},
	'self-determination': { area: 'Psychological', subarea: 'Self-Determination' },
	learning: { area: 'Psychological', subarea: 'Learning' }
};

/** Fetch the generated mapping JSON at runtime. */
export async function loadMetricSubareaMap(
	url = '/data/metric-subarea-map.json'
): Promise<MetricSubareaMap> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to load metric-subarea map: ${res.status}`);
	return (await res.json()) as MetricSubareaMap;
}

/**
 * Return the metrics that belong to any of the given subarea IDs, deduplicated
 * by `metric_id`. Preserves the order in which subareas are passed in.
 */
export function getMetricsForSubareas(
	map: MetricSubareaMap,
	subareaIds: string[]
): SubareaMetric[] {
	const seen = new Set<string>();
	const out: SubareaMetric[] = [];
	for (const id of subareaIds) {
		const key = SUBAREA_ID_TO_KEY[id];
		if (!key) continue;
		const metrics = map.by_area_subarea?.[key.area]?.[key.subarea] ?? [];
		for (const m of metrics) {
			if (seen.has(m.metric_id)) continue;
			seen.add(m.metric_id);
			out.push(m);
		}
	}
	return out;
}

/**
 * Same as `getMetricsForSubareas`, but groups results by subarea (using the
 * form's slug IDs as keys) so the caller can show a per-subarea breakdown.
 */
export function getMetricsBySubarea(
	map: MetricSubareaMap,
	subareaIds: string[]
): Record<string, SubareaMetric[]> {
	const out: Record<string, SubareaMetric[]> = {};
	for (const id of subareaIds) {
		const key = SUBAREA_ID_TO_KEY[id];
		if (!key) {
			out[id] = [];
			continue;
		}
		out[id] = map.by_area_subarea?.[key.area]?.[key.subarea] ?? [];
	}
	return out;
}
