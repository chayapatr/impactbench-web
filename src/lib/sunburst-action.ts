// Svelte use: action wrapping the D3 sunburst chart
import * as d3 from 'd3';
import type { SunburstNodeData } from './types';
import { scoreToColor, scoreToArcValue, averageScore } from './scores';

// ===== Constants =====

const CENTER_R = 100;
const RING1_INNER = 105;
const RING1_OUTER = 195;
const RING2_INNER = 200;
const RING2_OUTER = 335;
const RING3_INNER = 340;
const RING3_OUTER = 455;
const TRANSITION_DURATION = 500;
const VIEWBOX_R = (RING2_OUTER + 40) / 0.96;

type ArcDatum = d3.HierarchyRectangularNode<SunburstNodeData>;
interface BehaviorArcDatum {
	id: string;
	name: string;
	score: number;
	valence: 'positive' | 'negative';
	x0: number;
	x1: number;
}

export interface SunburstCallbacks {
	onSubareaClick: (subareaId: string) => void;
	onAreaClick: (areaId: string) => void;
	onCenterClick: () => void;
	onTooltipShow: (event: MouseEvent, node: SunburstNodeData) => void;
	onTooltipMove: (event: MouseEvent) => void;
	onTooltipHide: () => void;
}

// ===== Gradient Helpers =====

function buildSubareaGradients(
	defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
	nodes: ArcDatum[]
): void {
	nodes
		.filter((d) => d.depth === 2)
		.forEach((d) => {
			const metrics = d.data.children ?? [];
			if (metrics.length === 0) return;
			const scores = metrics.map((m) => m.score ?? 0);
			const avgS = averageScore(scores);
			const sorted = [...scores].sort((a, b) => b - a);
			const half = Math.ceil(sorted.length / 2);
			const innerScore = averageScore(sorted.slice(0, half));
			const outerScore = averageScore(sorted.slice(half));

			const gradId = `subarea-grad-${d.data.id}`;
			const grad = defs
				.append('radialGradient')
				.attr('id', gradId)
				.attr('gradientUnits', 'userSpaceOnUse')
				.attr('cx', 0)
				.attr('cy', 0)
				.attr('r', RING2_OUTER)
				.attr('fr', RING2_INNER);

			grad.append('stop').attr('offset', '0%').attr('stop-color', scoreToColor(innerScore));
			grad.append('stop').attr('offset', '50%').attr('stop-color', scoreToColor(avgS));
			grad.append('stop').attr('offset', '100%').attr('stop-color', scoreToColor(outerScore));
		});
}

function subareaFill(d: ArcDatum): string {
	if (d.depth === 2 && (d.data.children?.length ?? 0) > 1) {
		return `url(#subarea-grad-${d.data.id})`;
	}
	return scoreToColor(d.data.score ?? 0);
}

function truncate(str: string, maxLen: number): string {
	return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
}

function lightenColor(hex: string): string {
	const c = d3.color(hex);
	if (!c) return hex;
	const rgb = c.rgb();
	rgb.r = Math.min(255, rgb.r + 25);
	rgb.g = Math.min(255, rgb.g + 25);
	rgb.b = Math.min(255, rgb.b + 25);
	return rgb.formatHex();
}

// ===== Arc Path =====

function getArcPath(d: ArcDatum): string {
	const innerR = d.depth === 1 ? RING1_INNER : d.depth === 2 ? RING2_INNER : RING3_INNER;
	const outerR = d.depth === 1 ? RING1_OUTER : d.depth === 2 ? RING2_OUTER : RING3_OUTER;
	const arc = d3
		.arc<ArcDatum>()
		.innerRadius(innerR)
		.outerRadius(outerR)
		.startAngle((n) => (n as unknown as { x0: number }).x0)
		.endAngle((n) => (n as unknown as { x1: number }).x1)
		.padAngle(0.012)
		.padRadius(150)
		.cornerRadius(3);
	return arc(d) ?? '';
}

// ===== D3 Hierarchy =====

function buildD3Hierarchy(data: SunburstNodeData): ArcDatum[] {
	const root = d3.hierarchy<SunburstNodeData>(data, (d) => {
		if (d.type === 'root') return d.children ?? [];
		if (d.type === 'area') return d.children ?? [];
		return [];
	});

	root.sum((d) => {
		if (d.type === 'subarea') {
			const parentArea = (data.children ?? []).find((area) =>
				area.children?.some((s) => s.id === d.id)
			);
			const nSib = parentArea?.children?.length ?? 1;
			return 1 / nSib;
		}
		return 0;
	});

	d3.partition<SunburstNodeData>().size([2 * Math.PI, 1])(root);
	return root.descendants().filter((d) => d.depth > 0) as ArcDatum[];
}

// ===== Labels =====

function drawLabels(
	nodes: ArcDatum[],
	parent: d3.Selection<SVGGElement, unknown, null, undefined>
): void {
	const labelsGroup = parent.append('g').attr('class', 'labels-group');
	const labelDefs = labelsGroup.append('defs');

	// Area labels — curved textPath
	nodes
		.filter((d) => d.depth === 1)
		.forEach((d) => {
			const x0Raw = (d as unknown as { x0: number }).x0;
			const x1Raw = (d as unknown as { x1: number }).x1;
			const arcSpan = x1Raw - x0Raw;
			if (arcSpan < 0.2) return;
			const midAngle = (x0Raw + x1Raw) / 2;
			const midR = (RING1_INNER + RING1_OUTER) / 2;
			const pathId = `area-label-path-${d.data.id}`;
			const isFlipped = midAngle >= Math.PI / 2 && midAngle < Math.PI * 1.5;
			const clampedSpan = Math.min(arcSpan * 0.75, Math.PI * 0.9);
			const x0 = midAngle - clampedSpan / 2;
			const x1 = midAngle + clampedSpan / 2;
			const largeArc = clampedSpan > Math.PI ? 1 : 0;

			let pathD: string;
			if (!isFlipped) {
				const sx = Math.sin(x0) * midR,
					sy = -Math.cos(x0) * midR;
				const ex = Math.sin(x1) * midR,
					ey = -Math.cos(x1) * midR;
				pathD = `M ${sx} ${sy} A ${midR} ${midR} 0 ${largeArc} 1 ${ex} ${ey}`;
			} else {
				const sx = Math.sin(x1) * midR,
					sy = -Math.cos(x1) * midR;
				const ex = Math.sin(x0) * midR,
					ey = -Math.cos(x0) * midR;
				pathD = `M ${sx} ${sy} A ${midR} ${midR} 0 ${largeArc} 0 ${ex} ${ey}`;
			}

			labelDefs.append('path').attr('id', pathId).attr('d', pathD);
			labelsGroup
				.append('text')
				.attr('class', 'area-label')
				.attr('data-node-id', d.data.id)
				.style('fill', '#111827')
				.style('font-size', '14px')
				.style('font-weight', '800')
				.style('letter-spacing', '0.05em')
				.style('pointer-events', 'none')
				.style('transition', 'opacity 150ms ease')
				.append('textPath')
				.attr('href', `#${pathId}`)
				.attr('startOffset', '50%')
				.attr('text-anchor', 'middle')
				.text(d.data.name.toUpperCase());
		});

	// Subarea labels — radial text
	nodes
		.filter((d) => d.depth === 2)
		.forEach((d) => {
			const x0 = (d as unknown as { x0: number }).x0;
			const x1 = (d as unknown as { x1: number }).x1;
			if (x1 - x0 < 0.15) return;
			const angle = (x0 + x1) / 2;
			const midR = (RING2_INNER + RING2_OUTER) / 2;
			const px = Math.sin(angle) * midR;
			const py = -Math.cos(angle) * midR;
			const rotDeg = (angle * 180) / Math.PI - 90;
			const flip = angle > Math.PI ? 180 : 0;
			const maxChars = Math.max(8, Math.floor((RING2_OUTER - RING2_INNER) / 6.5));

			labelsGroup
				.append('text')
				.attr('class', 'subarea-label')
				.attr('data-node-id', d.data.id)
				.attr('x', 0)
				.attr('y', 0)
				.attr('transform', `translate(${px},${py}) rotate(${rotDeg + flip})`)
				.style('fill', '#1f2937')
				.style('font-size', '12px')
				.style('font-weight', '600')
				.style('text-anchor', 'middle')
				.style('dominant-baseline', 'middle')
				.style('pointer-events', 'none')
				.style('transition', 'opacity 150ms ease')
				.text(truncate(d.data.name, maxChars));
		});
}

// ===== Draw Arcs =====

function drawArcs(
	g: d3.Selection<SVGGElement, unknown, null, undefined>,
	nodes: ArcDatum[],
	animate: boolean,
	callbacks: SunburstCallbacks
): void {
	const arcGroup = g.append('g').attr('class', 'arcs-group');
	const defs = arcGroup.append<SVGDefsElement>('defs');
	buildSubareaGradients(defs, nodes);

	const paths = arcGroup
		.selectAll<SVGPathElement, ArcDatum>('.arc-path')
		.data(nodes, (d) => d.data.id)
		.join('path')
		.attr('class', 'arc-path')
		.attr('data-id', (d) => d.data.id)
		.attr('data-type', (d) => d.data.type)
		.attr('fill', (d) => subareaFill(d))
		.attr('d', (d) => getArcPath(d));

	if (animate) {
		paths.attr('opacity', 0).transition().duration(TRANSITION_DURATION).attr('opacity', 1);
	}

	paths
		.on('mouseenter', function (event: MouseEvent, d: ArcDatum) {
			highlightNode(d, nodes);
			callbacks.onTooltipShow(event, d.data);
		})
		.on('mousemove', (event: MouseEvent) => callbacks.onTooltipMove(event))
		.on('mouseleave', function () {
			unhighlightAll(nodes);
			callbacks.onTooltipHide();
			applyFocus(nodes);
		})
		.on('click', function (_event: MouseEvent, d: ArcDatum) {
			if (d.data.type === 'area') {
				focusedId = d.data.id;
				focusedType = 'area';
				applyFocus(nodes);
				callbacks.onAreaClick(d.data.id);
			} else if (d.data.type === 'subarea') {
				focusedId = d.data.id;
				focusedType = 'subarea';
				applyFocus(nodes);
				callbacks.onSubareaClick(d.data.id);
			}
		});

	drawLabels(nodes, arcGroup);
}

function transitionArcs(
	g: d3.Selection<SVGGElement, unknown, null, undefined>,
	nodes: ArcDatum[]
): void {
	const arcGroup = g.select('.arcs-group');
	arcGroup.select('defs').remove();
	const defs = arcGroup.insert<SVGDefsElement>('defs', ':first-child');
	buildSubareaGradients(defs, nodes);

	const paths = arcGroup
		.selectAll<SVGPathElement, ArcDatum>('.arc-path')
		.data(nodes, (d) => d.data.id);

	paths
		.transition()
		.duration(TRANSITION_DURATION)
		.ease(d3.easeCubicInOut)
		.attr('fill', (d) => subareaFill(d))
		.attr('d', (d) => getArcPath(d));

	paths
		.enter()
		.append('path')
		.attr('class', 'arc-path')
		.attr('d', (d) => getArcPath(d))
		.attr('fill', (d) => subareaFill(d))
		.attr('opacity', 0)
		.transition()
		.duration(TRANSITION_DURATION)
		.attr('opacity', 1);

	paths
		.exit()
		.transition()
		.duration(TRANSITION_DURATION / 2)
		.attr('opacity', 0)
		.remove();
}

// The currently focused node id/type (persists across hover)
let focusedId: string | null = null;
let focusedType: 'area' | 'subarea' | null = null;

function applyFocus(nodes: ArcDatum[]): void {
	if (!focusedId) {
		d3.selectAll<SVGPathElement, ArcDatum>('.arc-path')
			.classed('focus-dimmed', false)
			.classed('focus-active', false);
		return;
	}

	// Build the set of ids that should be fully visible
	const visibleIds = new Set<string>();

	if (focusedType === 'area') {
		// Show the area arc + all its subarea children
		nodes.forEach((d) => {
			if (d.data.id === focusedId) visibleIds.add(d.data.id);
			if (d.depth === 2 && d.parent?.data.id === focusedId) visibleIds.add(d.data.id);
		});
	} else if (focusedType === 'subarea') {
		// Show the subarea arc + its parent area arc
		nodes.forEach((d) => {
			if (d.data.id === focusedId) {
				visibleIds.add(d.data.id);
				if (d.parent?.data.id) visibleIds.add(d.parent.data.id);
			}
		});
	}

	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path').each(function (d) {
		const visible = visibleIds.has(d.data.id);
		d3.select(this).classed('focus-dimmed', !visible).classed('focus-active', visible);
	});
}

function clearFocus(): void {
	focusedId = null;
	focusedType = null;
	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path')
		.classed('focus-dimmed', false)
		.classed('focus-active', false);
}

function highlightNode(target: ArcDatum, nodes: ArcDatum[]): void {
	void nodes;
	const ancestorIds = new Set<string>();
	let current: d3.HierarchyNode<SunburstNodeData> | null = target;
	while (current) {
		if (current.data.id) ancestorIds.add(current.data.id);
		current = current.parent;
	}
	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path').each(function (d) {
		const isHighlighted = d.data.id === target.data.id || ancestorIds.has(d.data.id);
		d3.select(this)
			.classed('hover-dimmed', !isHighlighted)
			.classed('hover-highlighted', isHighlighted)
			.attr('fill', isHighlighted ? lightenColor(scoreToColor(d.data.score ?? 0)) : subareaFill(d));
	});
	// Dim labels not in the hovered ancestor chain
	d3.selectAll<SVGTextElement, unknown>('.area-label, .subarea-label').each(function () {
		const id = (this as SVGTextElement).getAttribute('data-node-id') ?? '';
		const isHighlighted = ancestorIds.has(id);
		d3.select(this).style('opacity', isHighlighted ? 1 : 0.2);
	});
}

function unhighlightAll(_nodes: ArcDatum[]): void {
	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path')
		.classed('hover-dimmed', false)
		.classed('hover-highlighted', false)
		.attr('fill', (d) => subareaFill(d));
	d3.selectAll<SVGTextElement, unknown>('.area-label, .subarea-label').style('opacity', 1);
}

function drawCenterImage(g: d3.Selection<SVGGElement, unknown, null, undefined>): void {
	const defs = g.append('defs');
	defs
		.append('clipPath')
		.attr('id', 'center-clip')
		.append('circle')
		.attr('r', CENTER_R - 4);
	g.append('circle')
		.attr('class', 'center-circle')
		.attr('r', CENTER_R)
		.attr('fill', 'none')
		.style('cursor', 'default');
	g.append('image')
		.attr('href', '/images/human-figure.png')
		.attr('x', -(CENTER_R - 4))
		.attr('y', -(CENTER_R - 4))
		.attr('width', (CENTER_R - 4) * 2)
		.attr('height', (CENTER_R - 4) * 2)
		.attr('clip-path', 'url(#center-clip)')
		.attr('preserveAspectRatio', 'xMidYMid meet')
		.style('cursor', 'default');
}

// ===== Behavior Arcs =====

function drawBehaviorArcs(
	g: d3.Selection<SVGGElement, unknown, null, undefined>,
	behaviors: Array<{ id: string; name: string; score: number; valence: 'positive' | 'negative' }>,
	subareaX0: number,
	subareaX1: number,
	onResetZoom: () => void
): void {
	g.select('.behavior-arcs-group').remove();
	g.select('.zoom-back-group').remove();

	const behaviorGroup = g.append('g').attr('class', 'behavior-arcs-group');
	const totalSpan = subareaX1 - subareaX0;
	const perBehavior = totalSpan / Math.max(behaviors.length, 1);

	const behaviorData: BehaviorArcDatum[] = behaviors.map((b, i) => ({
		...b,
		x0: subareaX0 + i * perBehavior,
		x1: subareaX0 + (i + 1) * perBehavior
	}));

	const arc = d3
		.arc<BehaviorArcDatum>()
		.innerRadius(RING3_INNER)
		.outerRadius(RING3_OUTER)
		.startAngle((d) => d.x0)
		.endAngle((d) => d.x1)
		.padAngle(0.008)
		.padRadius(150)
		.cornerRadius(3);

	behaviorGroup
		.selectAll<SVGPathElement, BehaviorArcDatum>('.behavior-arc')
		.data(behaviorData)
		.join('path')
		.attr('class', 'behavior-arc')
		.attr('data-id', (d) => d.id)
		.attr('fill', (d) => (d.score > 0.05 ? '#16a34a' : d.score < -0.05 ? '#dc2626' : '#9ca3af'))
		.attr('d', (d) => arc(d) ?? '')
		.attr('opacity', 0)
		.transition()
		.duration(300)
		.delay((_d, i) => i * 30)
		.attr('opacity', 0.9);

	const labelsGroup = behaviorGroup.append('g').attr('class', 'behavior-labels');
	behaviorData.forEach((d) => {
		const span = d.x1 - d.x0;
		if (span < 0.12) return;
		const maxChars = span > 0.25 ? 14 : 8;
		const angle = (d.x0 + d.x1) / 2;
		const midR = (RING3_INNER + RING3_OUTER) / 2;
		labelsGroup
			.append('text')
			.attr('class', 'behavior-label')
			.attr(
				'transform',
				`translate(${Math.sin(angle) * midR},${-Math.cos(angle) * midR}) rotate(${(angle * 180) / Math.PI - 90 + (angle > Math.PI ? 180 : 0)})`
			)
			.style('text-anchor', 'middle')
			.style('dominant-baseline', 'middle')
			.style('font-size', '8px')
			.style('font-weight', '600')
			.style('fill', '#fff')
			.style('pointer-events', 'none')
			.text(truncate(d.name, maxChars));
	});

	// Zoom-back button
	const backGroup = g.append('g').attr('class', 'zoom-back-group').style('cursor', 'pointer');
	backGroup.append('circle').attr('class', 'zoom-back-circle').attr('r', 28).attr('fill', 'white');
	backGroup.append('text').attr('class', 'zoom-back-text').text('×');
	backGroup.on('click', onResetZoom);
}

// ===== Audience Highlight =====

export function highlightAudienceAreas(areaIds: string[]): void {
	if (areaIds.length === 0) {
		d3.selectAll<SVGPathElement, ArcDatum>('.arc-path').classed('audience-dimmed', false);
		return;
	}
	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path').each(function (d) {
		const inPriority = areaIds.includes(d.data.areaId ?? '') || areaIds.includes(d.data.id);
		d3.select(this).classed('audience-dimmed', !inPriority);
	});
}

export function clearAudienceHighlight(): void {
	d3.selectAll<SVGPathElement, ArcDatum>('.arc-path').classed('audience-dimmed', false);
}

// ===== Svelte Action =====

export interface SunburstActionParams {
	data: SunburstNodeData | null;
	callbacks: SunburstCallbacks;
}

export function sunburstAction(
	svgEl: SVGSVGElement,
	params: SunburstActionParams
): { update: (p: SunburstActionParams) => void; destroy: () => void } {
	let currentData: SunburstNodeData | null = null;
	let currentNodes: ArcDatum[] = [];
	let isZoomed = false;

	const rootSvg = d3.select(svgEl);
	const size = Math.min(Math.min(960, window.innerWidth - 80), 900);

	rootSvg
		.attr('width', size)
		.attr('height', size)
		.attr('viewBox', `${-VIEWBOX_R} ${-VIEWBOX_R} ${VIEWBOX_R * 2} ${VIEWBOX_R * 2}`)
		.attr('preserveAspectRatio', 'xMidYMid meet');

	const g = rootSvg.append('g').attr('class', 'sunburst-g');

	function updateLayout() {
		const wrapper = svgEl.closest<HTMLElement>('#sunburst-wrapper');
		if (!wrapper) return;
		const s = Math.min(wrapper.clientWidth - 48, 860);
		rootSvg.attr('width', s).attr('height', s);
	}

	updateLayout();

	const resizeHandler = () => {
		if (currentData) updateLayout();
	};
	window.addEventListener('resize', resizeHandler);

	function resetZoomFull() {
		clearFocus();
		if (!isZoomed && g.select('.behavior-arcs-group').empty()) return;
		g.select('.behavior-arcs-group').transition().duration(200).attr('opacity', 0).remove();
		g.select('.zoom-back-group').remove();
		g.transition().duration(400).ease(d3.easeCubicInOut).attr('transform', '');
		g.selectAll<SVGPathElement, ArcDatum>('.arc-path')
			.transition()
			.duration(300)
			.attr('opacity', 1);
		isZoomed = false;
	}

	function zoomToSubarea(
		subareaId: string,
		behaviors: Array<{ id: string; name: string; score: number; valence: 'positive' | 'negative' }>
	) {
		let subareaX0 = 0;
		let subareaX1 = (2 * Math.PI) / 3;

		const subareaPath = g.select<SVGPathElement>(`.arc-path[data-id="${subareaId}"]`);
		if (!subareaPath.empty()) {
			const datum = subareaPath.datum() as ArcDatum;
			if (datum) {
				subareaX0 = (datum as unknown as { x0: number }).x0;
				subareaX1 = (datum as unknown as { x1: number }).x1;
			}
		}

		g.selectAll<SVGPathElement, ArcDatum>('.arc-path').each(function (d) {
			const isRelated =
				d.data.id === subareaId ||
				d.data.subareaId === subareaId ||
				(d.depth === 1 &&
					(() => {
						const sp = g.select<SVGPathElement>(`.arc-path[data-id="${subareaId}"]`);
						return !sp.empty() && (sp.datum() as ArcDatum)?.data?.areaId === d.data.id;
					})());
			d3.select(this)
				.transition()
				.duration(300)
				.attr('opacity', isRelated ? 1 : 0.2);
		});

		const midAngle = (subareaX0 + subareaX1) / 2;
		const zoomR = (RING2_INNER + RING2_OUTER) / 2;
		const cx = Math.sin(midAngle) * zoomR;
		const cy = -Math.cos(midAngle) * zoomR;
		const scale = 1.15;
		const tx = cx * (1 - scale);
		const ty = cy * (1 - scale);

		g.transition()
			.duration(400)
			.ease(d3.easeCubicInOut)
			.attr('transform', `matrix(${scale},0,0,${scale},${tx},${ty})`);

		isZoomed = true;
		setTimeout(() => drawBehaviorArcs(g, behaviors, subareaX0, subareaX1, resetZoomFull), 200);
	}

	// Expose APIs on the SVG element for external callers
	(svgEl as unknown as Record<string, unknown>).__zoomToSubarea = zoomToSubarea;
	(svgEl as unknown as Record<string, unknown>).__resetZoom = resetZoomFull;
	(svgEl as unknown as Record<string, unknown>).__clearFocus = clearFocus;
	(svgEl as unknown as Record<string, unknown>).__focusNode = (
		id: string,
		type: 'area' | 'subarea'
	) => {
		focusedId = id;
		focusedType = type;
		applyFocus(currentNodes);
	};

	function render(data: SunburstNodeData, animate: boolean) {
		currentData = data;
		g.selectAll('*').remove();
		currentNodes = buildD3Hierarchy(data);
		drawArcs(g, currentNodes, animate, params.callbacks);
		drawCenterImage(g);
	}

	function update(newData: SunburstNodeData) {
		currentData = newData;
		currentNodes = buildD3Hierarchy(newData);
		transitionArcs(g, currentNodes);
	}

	if (params.data) render(params.data, false);

	return {
		update(p: SunburstActionParams) {
			if (!p.data) return;
			if (!currentData) {
				render(p.data, false);
			} else {
				update(p.data);
			}
		},
		destroy() {
			window.removeEventListener('resize', resizeHandler);
		}
	};
}

// Re-export scoreToArcValue so it's importable from here too
export { scoreToArcValue };
