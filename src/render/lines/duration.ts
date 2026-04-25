import type { RenderContext } from '../../types.js';
import { label } from '../colors.js';

/**
 * Render the session-duration segment — `⏱️ 5m`.
 *
 * Returns null when display.showDuration is explicitly false or when no
 * sessionDuration was computed (e.g. transcript has no sessionStart yet).
 */
export function renderDurationLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showDuration === false) {
    return null;
  }
  if (!ctx.sessionDuration) {
    return null;
  }
  return label(`⏱️  ${ctx.sessionDuration}`, ctx.config?.colors);
}
