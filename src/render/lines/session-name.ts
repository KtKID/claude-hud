import type { RenderContext } from '../../types.js';
import { label } from '../colors.js';

/**
 * Render the session name from `/rename` or transcript slug.
 * Returns null when display.showSessionName is off or transcript has no name.
 */
export function renderSessionNameLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (!display?.showSessionName) {
    return null;
  }
  if (!ctx.transcript.sessionName) {
    return null;
  }
  return label(ctx.transcript.sessionName, ctx.config?.colors);
}
