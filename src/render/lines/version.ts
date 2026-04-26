import type { RenderContext } from '../../types.js';
import { label } from '../colors.js';

/**
 * Render the Claude Code version segment — `CC v2.1.111`.
 *
 * Returns null when the user hasn't opted in via display.showClaudeCodeVersion
 * or when the version probe failed to produce a value.
 */
export function renderVersionLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (!display?.showClaudeCodeVersion) {
    return null;
  }
  if (!ctx.claudeCodeVersion) {
    return null;
  }
  return label(`CC v${ctx.claudeCodeVersion}`, ctx.config?.colors);
}
