import type { RenderContext } from '../../types.js';
import { custom as customColor } from '../colors.js';

/**
 * Render the static custom-text line set via `display.customLine` config.
 * Distinct from `--extra-cmd` (which produces ctx.extraLabel via a script).
 *
 * Returns null when customLine is empty or unset.
 */
export function renderCustomLine(ctx: RenderContext): string | null {
  const text = ctx.config?.display?.customLine;
  if (!text) {
    return null;
  }
  return customColor(text, ctx.config?.colors);
}
