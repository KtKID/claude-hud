import type { RenderContext } from '../../types.js';
import { getModelName, formatModelName, getProviderLabel } from '../../stdin.js';
import { model as modelColor, effort as effortColor } from '../colors.js';

/**
 * Render the model badge — `[Opus 4.7]` or `[Opus | Bedrock]` etc.
 *
 * Composition rules (preserved from the legacy project.ts behavior):
 *   1. Start from the raw display name and re-format per `display.modelFormat`
 *      (full / compact / short). `display.modelOverride` wins over the
 *      auto-detected name.
 *   2. If a provider label is positively identified (Bedrock, Vertex, etc.),
 *      append it inside the brackets separated by " | ".
 *   3. If the user has effort enabled, append the effort symbol/level.
 *   4. The whole assembly is wrapped in [] and colored via `colors.model`.
 *
 * Returns null when `display.showModel === false`.
 */
export function renderModelLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showModel === false) {
    return null;
  }

  const colors = ctx.config?.colors;
  const model = formatModelName(
    getModelName(ctx.stdin),
    display?.modelFormat,
    display?.modelOverride,
  );
  const providerLabel = getProviderLabel(ctx.stdin);

  const baseInner = providerLabel ? `${model} | ${providerLabel}` : model;

  if (ctx.effortLevel) {
    const effortText = ctx.effortSymbol ? `${ctx.effortSymbol}${ctx.effortLevel}` : ctx.effortLevel;
    const colored = effortColor(effortText, ctx.effortLevel, colors);
    return `${modelColor(`[${baseInner} `, colors)}${colored}${modelColor(']', colors)}`;
  }

  return modelColor(`[${baseInner}]`, colors);
}
