import type { SunburstNodeData } from './types';
import { formatScore, scoreToClass } from './color-scale';
import { AREA_DESCRIPTIONS, SUBAREA_DESCRIPTIONS } from './descriptions';

// ===== State =====

let tooltipEl: HTMLElement;
let hideTimer: number | null = null;

export function initTooltip(): void {
  tooltipEl = document.getElementById('tooltip') as HTMLElement;
}

export function showTooltip(
  event: MouseEvent,
  node: SunburstNodeData
): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  const score = node.score ?? 0;
  const scoreClass = scoreToClass(score);
  const scoreStr = formatScore(score);

  let typeLabel = '';
  switch (node.type) {
    case 'area': typeLabel = 'Well-being Area'; break;
    case 'subarea': typeLabel = 'Subarea'; break;
    case 'metric': typeLabel = 'Metric'; break;
    default: typeLabel = '';
  }

  // Score bar
  const pct = Math.round(score * 100);
  const scoreBarHtml = `
    <div class="tooltip-score-bar-track">
      <div class="tooltip-score-bar-fill ${scoreClass}" style="width:${pct}%"></div>
    </div>
  `;

  // Description line
  let descriptionHtml = '';
  if (node.type === 'area') {
    const desc = AREA_DESCRIPTIONS[node.id] ?? '';
    if (desc) {
      descriptionHtml = `<div class="tooltip-description">${escapeHtml(desc)}</div>`;
    }
    const allMetrics = node.children?.flatMap((s) => s.children ?? []) ?? [];
    if (allMetrics.length > 0) {
      descriptionHtml += metricBreakdownHtml(allMetrics);
    }
  } else if (node.type === 'subarea') {
    const desc = SUBAREA_DESCRIPTIONS[node.id] ?? '';
    if (desc) {
      descriptionHtml = `<div class="tooltip-description">${escapeHtml(desc)}</div>`;
    }
    const metrics = node.children ?? [];
    if (metrics.length > 0) {
      descriptionHtml += metricBreakdownHtml(metrics);
    }
  } else if (node.type === 'metric') {
    descriptionHtml = `<div class="tooltip-meta">${node.harmful ? '↓ Harmful behaviour metric' : '↑ Beneficial behaviour metric'}</div>`;
  }

  tooltipEl.innerHTML = `
    <div class="tooltip-title">${escapeHtml(node.name)}</div>
    <div class="tooltip-score ${scoreClass}">${scoreStr}</div>
    ${scoreBarHtml}
    <div class="tooltip-meta">${typeLabel}</div>
    ${descriptionHtml}
  `;

  tooltipEl.classList.add('visible');
  tooltipEl.setAttribute('aria-hidden', 'false');

  positionTooltip(event);
}

export function moveTooltip(event: MouseEvent): void {
  positionTooltip(event);
}

export function hideTooltip(): void {
  hideTimer = window.setTimeout(() => {
    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
    hideTimer = null;
  }, 80);
}

function positionTooltip(event: MouseEvent): void {
  const rect = tooltipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = event.clientX + 14;
  let y = event.clientY - 10;

  // Keep within viewport
  if (x + rect.width + 10 > vw) {
    x = event.clientX - rect.width - 14;
  }
  if (y + rect.height + 10 > vh) {
    y = event.clientY - rect.height + 10;
  }
  if (y < 8) y = 8;

  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

function metricBreakdownHtml(metrics: { score?: number }[]): string {
  const passing  = metrics.filter((m) => (m.score ?? 0) >= 0.55).length;
  const failing  = metrics.filter((m) => (m.score ?? 0) < 0.45).length;
  const neutral  = metrics.length - passing - failing;
  const total    = metrics.length;

  const passPct  = Math.round((passing / total) * 100);
  const failPct  = Math.round((failing / total) * 100);
  const neutPct  = 100 - passPct - failPct;

  const barHtml = `
    <div class="tooltip-split-bar">
      ${passPct  > 0 ? `<div class="tooltip-split-seg positive" style="width:${passPct}%"></div>`  : ''}
      ${neutPct  > 0 ? `<div class="tooltip-split-seg neutral"  style="width:${neutPct}%"></div>`  : ''}
      ${failPct  > 0 ? `<div class="tooltip-split-seg negative" style="width:${failPct}%"></div>`  : ''}
    </div>`;

  const dots = [
    passing > 0 ? `<span class="tooltip-dot positive"></span>${passing} passing` : '',
    neutral > 0 ? `<span class="tooltip-dot neutral"></span>${neutral} neutral`  : '',
    failing > 0 ? `<span class="tooltip-dot negative"></span>${failing} failing` : '',
  ].filter(Boolean).join('<span class="tooltip-dot-sep">·</span>');

  return `
    ${barHtml}
    <div class="tooltip-breakdown">${dots} <span class="tooltip-meta-inline">(${total} metrics)</span></div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
