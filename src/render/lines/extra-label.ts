import type { RenderContext } from '../../types.js';
import { label } from '../colors.js';

/**
 * Render the dynamic label produced by `--extra-cmd` user scripts.
 * Already sanitized (ANSI/control chars stripped) by extra-cmd.ts before
 * landing in ctx.extraLabel, so we just color-wrap it here.
 *
 * Returns null when no extra-cmd was supplied or it produced no label.
 */
export function renderExtraLabelLine(ctx: RenderContext): string | null {
  if (!ctx.extraLabel) {
    return null;
  }
  return label(ctx.extraLabel, ctx.config?.colors);
}
