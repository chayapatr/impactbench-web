import * as d3 from 'd3';

const colorScale = d3
	.scaleLinear<string>()
	.domain([0, 0.5, 1])
	.range(['#dc2626', '#e5e7eb', '#16a34a'])
	.clamp(true);

const colorScaleBright = d3
	.scaleLinear<string>()
	.domain([0, 0.5, 1])
	.range(['#ef4444', '#f3f4f6', '#22c55e'])
	.clamp(true);

const pillBgScale = d3
	.scaleLinear<string>()
	.domain([0, 0.33, 0.66, 1])
	.range(['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7'])
	.clamp(true);

const pillTextScale = d3
	.scaleLinear<string>()
	.domain([0, 0.33, 0.66, 1])
	.range(['#dc2626', '#ea580c', '#ca8a04', '#16a34a'])
	.clamp(true);

export function scoreToColorBright(score: number): string {
	return colorScaleBright(score);
}

export function averageScore(scores: number[]): number {
	if (scores.length === 0) return 0;
	return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function scoreToClass(score: number): string {
	if (score >= 0.75) return 'positive';
	if (score >= 0.55) return 'moderate';
	if (score >= 0.45) return 'neutral';
	return 'negative';
}

export function formatScore(score: number): string {
	return score.toFixed(2);
}

export function scoreToLetterGrade(score: number): string {
	if (!Number.isFinite(score)) return 'N/A';
	if (score >= 0.95) return 'A+';
	if (score >= 0.9) return 'A';
	if (score >= 0.85) return 'A-';
	if (score >= 0.8) return 'B+';
	if (score >= 0.75) return 'B';
	if (score >= 0.7) return 'B-';
	if (score >= 0.65) return 'C+';
	if (score >= 0.6) return 'C';
	if (score >= 0.55) return 'C-';
	if (score >= 0.5) return 'D+';
	if (score >= 0.45) return 'D';
	if (score >= 0.4) return 'D-';
	return 'F';
}

export function letterGradeRange(score: number): { lower: number; upper: number } | null {
	if (!Number.isFinite(score)) return null;
	const bands: Array<[number, number]> = [
		[0.95, 1.0],
		[0.9, 0.95],
		[0.85, 0.9],
		[0.8, 0.85],
		[0.75, 0.8],
		[0.7, 0.75],
		[0.65, 0.7],
		[0.6, 0.65],
		[0.55, 0.6],
		[0.5, 0.55],
		[0.45, 0.5],
		[0.4, 0.45]
	];
	for (const [lo, hi] of bands) {
		if (score >= lo) return { lower: lo, upper: hi };
	}
	return { lower: 0, upper: 0.4 };
}

export function scoreToArcValue(score: number, floor = 0.1): number {
	return Math.max(Math.abs(score - 0.5), floor);
}

export function scoreInterpretation(score: number): string {
	if (score >= 0.75) return 'Strongly benefits this dimension: AI is a clear positive force';
	if (score >= 0.6) return 'Moderately beneficial: AI has a meaningful positive effect';
	if (score >= 0.55) return 'Slight positive effect: modest benefit, room to improve';
	if (score >= 0.45) return 'Neutral: no significant net impact detected';
	if (score >= 0.4) return 'Slight concern: AI may be undermining this dimension';
	if (score >= 0.25) return 'Moderate concern: notable negative effects observed';
	return 'Significant concern: AI consistently harms this dimension';
}

export function scoreColors(score: number): { color: string; light: string; border: string } {
	if (score >= 0.75) return { color: '#16a34a', light: '#f0fdf4', border: '#86efac' };
	if (score >= 0.55) return { color: '#d97706', light: '#fffbeb', border: '#fcd34d' };
	if (score < 0.45) return { color: '#dc2626', light: '#fff5f5', border: '#fca5a5' };
	return { color: '#6b7280', light: '#f9fafb', border: '#e5e7eb' };
}

export function scoreToColor(score: number): string {
	return colorScale(score);
}

export function scorePillColor(score: number): string {
	return pillTextScale(score);
}

export function scorePillStyle(score: number): string {
	return `background:${pillBgScale(score)};color:${pillTextScale(score)}`;
}
