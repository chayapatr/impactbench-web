// ===== Tooltip State =====

export interface TooltipData {
	x: number;
	y: number;
	name: string;
	score: number;
	type: string;
	id: string;
	description?: string;
	children?: { id?: string; name?: string; score?: number; children?: { score?: number }[] }[];
	harmful?: boolean;
	behavior_type?: 'flourishing' | 'restrain_harm';
}

export const tooltipState = $state({
	visible: false,
	gateMode: false,
	data: null as TooltipData | null
});

// ===== Nutrition Label (deep-dive) State =====

export const nutritionLabelState = $state({
	open: false
});

// ===== Scenario side-panel (opens to the right of the main sidebar) =====

export const scenarioPanelState = $state({
	open: false,
	metricId: null as string | null,
	scenarioMeta: null as import('../types').ScenarioMeta | null
});

export function openScenarioPanel(
	metricId: string,
	scenarioMeta: import('../types').ScenarioMeta
) {
	scenarioPanelState.open = true;
	scenarioPanelState.metricId = metricId;
	scenarioPanelState.scenarioMeta = scenarioMeta;
}

export function closeScenarioPanel() {
	scenarioPanelState.open = false;
	scenarioPanelState.metricId = null;
	scenarioPanelState.scenarioMeta = null;
}
