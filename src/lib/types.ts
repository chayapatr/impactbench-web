// ===== Taxonomy Types =====

export interface Metric {
	id: string;
	name: string;
	harmful: boolean;
	behavior_type?: 'flourishing' | 'restrain_harm';
	measurement?: 'presence' | 'absence';
	// Optional. Populated from upstream benchmark.yaml `metric_contributor` field
	// once the data pipeline emits it; safe to read as undefined until then.
	metric_contributor?: string;
}

export interface MetricMeta {
	contributor: string;
	mattersBecause: string;
}

export interface MetricGroup {
	name: string;
	metric_ids: string[];
}

export interface Subarea {
	id: string;
	name: string;
	icon: string;
	metrics: Metric[];
	groups?: MetricGroup[];
}

export interface Area {
	id: string;
	name: string;
	icon: string;
	color: string;
	subareas: Subarea[];
}

export interface Taxonomy {
	areas: Area[];
}

// ===== Model Types =====

export interface AIModel {
	id: string;
	name: string;
	provider: string;
	version: string;
	releaseYear: number;
	description?: string;
}

// ===== Benchmark Data Types =====

export type BenchmarkKey = string; // "modelId|age"
export type MetricScores = Record<string, number>; // metricId -> score [0..1]
export type BenchmarkData = Record<BenchmarkKey, MetricScores>;

// ===== Filter State =====

export interface FilterState {
	model: string;
	age: string;
}

// ===== D3 Hierarchy Types =====

export interface SunburstNodeData {
	id: string;
	name: string;
	icon?: string;
	score?: number;
	depth: number;
	type: 'root' | 'area' | 'subarea' | 'metric';
	areaId?: string;
	subareaId?: string;
	color?: string;
	harmful?: boolean;
	behavior_type?: 'flourishing' | 'restrain_harm';
	children?: SunburstNodeData[];
	value?: number;
}

// ===== Scenario Types =====

export interface ScenarioMeta {
	scenario_id: string;
	title: string;
	age: 'child' | 'adult';
	benchmark: string;
	metric_contributor?: string;
	verdicts?: Record<string, string>;
}

export interface ScenarioIndex {
	[metricId: string]: ScenarioMeta[];
}

export interface ChatTurn {
	role: 'user' | 'assistant';
	content: string;
}

export interface ScenarioDetail {
	id: string;
	metric_id: string;
	metric_name: string;
	metric_type: string;
	user_goal: string;
	persona: string;
	latent_adversarial_goal?: string;
	transcript: ChatTurn[];
	justification?: string;
}

// ===== Smart Nutrition =====

export interface SmartConstruct {
	text: string;
	benchmark: string;
	metric_contributor?: string;
	score: number;
	icon?: string;
	summary?: string;
}

export interface SmartTopModel {
	name: string;
	provider: string;
	score: number;
	flatScore?: number;
	constructScores: number[];
	worstAreas: { name: string; score: number }[];
}

export interface SmartNutritionOpts {
	userText: string;
	constructs: SmartConstruct[];
	topModels: SmartTopModel[];
}
