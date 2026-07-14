// /viewer imports a run of the `nutritional-label` benchmark, whose scores are
// keyed by that benchmark's own metric ids (m01..m83). Published nutrition.json
// is keyed by the *source* metric each was drawn from (e.g. humanagency-bench__m14)
// and carries `label_metric_id` to bridge the two.
//
// This used to be a hardcoded copy of the label (metric names, types, categories,
// and category prose). It had already drifted from benchmark.yaml, so it's derived
// from the published data now. Category descriptions come from $lib/descriptions,
// the same source the rest of the site uses.
import type { NutritionCategoryData } from '$lib/data';

export interface MetricMapEntry {
	name: string;
	type: 'positive' | 'negative';
	categories: string[];
}

export interface MetricMaps {
	METRIC_MAP: Record<string, MetricMapEntry>;
	CATEGORY_LABELS: Record<string, string>;
	CATEGORY_ORDER: string[];
}

export function buildMetricMaps(nutrition: NutritionCategoryData[]): MetricMaps {
	const METRIC_MAP: Record<string, MetricMapEntry> = {};
	const CATEGORY_LABELS: Record<string, string> = {};
	const CATEGORY_ORDER: string[] = [];

	for (const cat of nutrition) {
		CATEGORY_ORDER.push(cat.id);
		CATEGORY_LABELS[cat.id] = cat.label;

		for (const metric of cat.metrics) {
			const id = metric.label_metric_id;
			if (!id) continue;

			// A metric can sit in more than one category (e.g. humanebench__m07 is
			// both learning and creativity), so accumulate rather than overwrite.
			const existing = METRIC_MAP[id];
			if (existing) {
				existing.categories.push(cat.id);
			} else {
				METRIC_MAP[id] = {
					name: metric.name,
					type: metric.type,
					categories: [cat.id]
				};
			}
		}
	}

	return { METRIC_MAP, CATEGORY_LABELS, CATEGORY_ORDER };
}
