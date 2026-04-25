import type { RenderContext } from '../../types.js';
import { label } from '../colors.js';

/**
 * Render the active outputStyle from settings as `style: <name>`.
 * Previously bundled inside renderEnvironmentLine; pulled out so users can
 * place it independently via elementOrder.
 *
 * The environment line continues to render the four config counts
 * (CLAUDE.md / rules / MCPs / hooks) — it no longer surfaces outputStyle.
 *
 * Returns null when display.showOutputStyle is off or no outputStyle exists.
 */
export function renderOutputStyleLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (!display?.showOutputStyle) {
    return null;
  }
  if (!ctx.outputStyle) {
    return null;
  }
  return label(`style: ${ctx.outputStyle}`, ctx.config?.colors);
}
