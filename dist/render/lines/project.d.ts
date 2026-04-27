import type { RenderContext } from '../../types.js';
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
export declare function renderProjectLine(ctx: RenderContext): string | null;
//# sourceMappingURL=project.d.ts.map