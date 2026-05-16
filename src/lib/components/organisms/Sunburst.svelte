<script lang="ts">
	import { sunburstAction, type SunburstCallbacks } from '$lib/sunburst-action';
	import { tooltipState } from '$lib/store.svelte';
	import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from '$lib/descriptions';
	import type { SunburstNodeData } from '$lib/types';

	interface Props {
		data: SunburstNodeData | null;
		onSubareaClick: (id: string) => void;
		onAreaClick: (id: string) => void;
		onCenterClick: () => void;
		gateMode?: boolean;
	}

	let { data, onSubareaClick, onAreaClick, onCenterClick, gateMode = false }: Props = $props();

	let svgEl: SVGSVGElement | undefined = $state();

	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function showTooltip(event: MouseEvent, node: SunburstNodeData) {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		// Estimate tooltip size for positioning
		let x = event.clientX + 14;
		let y = event.clientY - 10;
		if (x + 280 > vw) x = event.clientX - 280 - 14;
		if (y + 200 > vh) y = event.clientY - 200 + 10;
		if (y < 8) y = 8;

		tooltipState.gateMode = gateMode;
		tooltipState.data = {
			x,
			y,
			name: node.name,
			score: node.score ?? 0,
			type: node.type,
			id: node.id,
			children: node.children,
			harmful: node.harmful,
			behavior_type: node.behavior_type
		};
		tooltipState.visible = true;
	}

	function moveTooltip(event: MouseEvent) {
		if (!tooltipState.data) return;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let x = event.clientX + 14;
		let y = event.clientY - 10;
		if (x + 280 > vw) x = event.clientX - 280 - 14;
		if (y + 200 > vh) y = event.clientY - 200 + 10;
		if (y < 8) y = 8;
		tooltipState.data = { ...tooltipState.data, x, y };
	}

	function hideTooltip() {
		hideTimer = setTimeout(() => {
			tooltipState.visible = false;
			hideTimer = null;
		}, 80);
	}

	// Wrap in closures so the action always calls the current prop values
	const callbacks: SunburstCallbacks = {
		onSubareaClick: (id) => onSubareaClick(id),
		onAreaClick: (id) => onAreaClick(id),
		onCenterClick: () => onCenterClick(),
		onTooltipShow: showTooltip,
		onTooltipMove: moveTooltip,
		onTooltipHide: hideTooltip
	};

	// Expose zoom methods to parent via bind:this equivalent
	export function zoomToSubarea(
		id: string,
		behaviors: Array<{ id: string; name: string; score: number; valence: 'positive' | 'negative' }>
	) {
		if (svgEl) {
			const fn = (svgEl as unknown as Record<string, unknown>).__zoomToSubarea as
				| ((
						id: string,
						b: typeof behaviors
				  ) => void)
				| undefined;
			fn?.(id, behaviors);
		}
	}

	export function resetZoom() {
		if (svgEl) {
			const fn = (svgEl as unknown as Record<string, unknown>).__resetZoom as
				| (() => void)
				| undefined;
			fn?.();
		}
	}

	export function focusNode(id: string, type: 'area' | 'subarea') {
		if (svgEl) {
			const fn = (svgEl as unknown as Record<string, unknown>).__focusNode as
				| ((id: string, type: 'area' | 'subarea') => void)
				| undefined;
			fn?.(id, type);
		}
	}

	export function clearFocus() {
		if (svgEl) {
			const fn = (svgEl as unknown as Record<string, unknown>).__clearFocus as
				| (() => void)
				| undefined;
			fn?.();
		}
	}
</script>

<div id="sunburst-wrapper" class="flex items-center justify-center w-full h-full">
	<svg
		id="sunburst-svg"
		bind:this={svgEl}
		use:sunburstAction={{ data, callbacks }}
		class="block overflow-visible"
		style="max-height:calc(100vh - 160px)"
	></svg>
</div>

<style>
	:global(.arc-path) {
		cursor: pointer;
		transition: opacity 0.25s ease;
	}
	:global(.arc-path.hover-dimmed) {
		opacity: 0.25;
	}
	:global(.arc-path.focus-dimmed) {
		opacity: 0.15;
	}
	:global(.arc-path.focus-active) {
		opacity: 1;
	}
	:global(.arc-path.audience-dimmed) {
		opacity: 0.15;
	}
	:global(.zoom-back-text) {
		font-size: 20px;
		font-weight: 700;
		fill: #374151;
		text-anchor: middle;
		dominant-baseline: middle;
	}
	:global(.zoom-back-circle) {
		stroke: #e5e7eb;
		stroke-width: 1.5;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
	}
</style>
