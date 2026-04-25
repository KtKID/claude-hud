import type { RenderContext } from '../../types.js';
import { project as projectColor } from '../colors.js';
import { getFileHref, safeHyperlink, sanitizeDisplayText } from './_text-utils.js';

/**
 * Render JUST the project path segment — `kongming-agent`, with an OSC-8
 * hyperlink to `file:///full/path` so terminal users can click through.
 *
 * Historically this line bundled model + project + git + version + duration
 * + cost + speed + sessionName + extraLabel + customLine. The split into
 * dedicated line modules (model.ts, git.ts, version.ts, ...) lets users
 * place each piece independently via elementOrder + mergeGroups.
 *
 * Returns null when display.showProject is false or the stdin payload has
 * no cwd.
 */
export function renderProjectLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (display?.showProject === false) {
    return null;
  }

  const cwd = ctx.stdin.cwd;
  if (!cwd) {
    return null;
  }

  const segments = cwd.split(/[/\\]/).filter(Boolean);
  const pathLevels = ctx.config?.pathLevels ?? 1;
  const projectPath = sanitizeDisplayText(
    segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/',
  );

  const colors = ctx.config?.colors;
  const coloredProject = projectColor(projectPath, colors);
  return safeHyperlink(getFileHref(cwd), coloredProject);
}
