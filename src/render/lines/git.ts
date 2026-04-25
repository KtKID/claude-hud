import * as fs from 'node:fs';
import type { RenderContext } from '../../types.js';
import {
  git as gitColor,
  gitBranch as gitBranchColor,
  warning as warningColor,
  critical as criticalColor,
  red,
  green,
  yellow,
  dim,
} from '../colors.js';
import {
  getFileHref,
  resolvePathWithinCwd,
  safeHyperlink,
  sanitizeDisplayText,
} from './_text-utils.js';

/**
 * Render the git status segment — `git:(branch* ↑2 ↓1 [+5 -3])`.
 *
 * Honours every gitStatus.* sub-toggle that existed when this logic lived
 * inside renderProjectLine. Returns null when:
 *   - gitStatus.enabled is false
 *   - no GitStatus was collected (e.g. cwd is not a git repo)
 *   - branchOverflow === 'wrap' (handled here as "still render, caller
 *     decides line-break"); the caller is expected to honor wrap by placing
 *     this element on its own line via mergeGroups configuration
 */
export function renderGitLine(ctx: RenderContext): string | null {
  const gitConfig = ctx.config?.gitStatus;
  if (gitConfig?.enabled === false) {
    return null;
  }
  if (!ctx.gitStatus) {
    return null;
  }

  const colors = ctx.config?.colors;
  const branchText = sanitizeDisplayText(
    ctx.gitStatus.branch +
      ((gitConfig?.showDirty ?? true) && ctx.gitStatus.isDirty ? '*' : ''),
  );
  const coloredBranch = gitBranchColor(branchText, colors);
  const linkedBranch = safeHyperlink(ctx.gitStatus.branchUrl, coloredBranch);
  const gitInner: string[] = [linkedBranch];

  if (gitConfig?.showAheadBehind) {
    if (ctx.gitStatus.ahead > 0) {
      gitInner.push(formatAheadCount(ctx.gitStatus.ahead, gitConfig, colors));
    }
    if (ctx.gitStatus.behind > 0) {
      gitInner.push(gitBranchColor(`↓${ctx.gitStatus.behind}`, colors));
    }
  }

  if (gitConfig?.showFileStats && ctx.gitStatus.lineDiff) {
    const { added, deleted } = ctx.gitStatus.lineDiff;
    const diffParts: string[] = [];
    if (added > 0) diffParts.push(green(`+${added}`));
    if (deleted > 0) diffParts.push(red(`-${deleted}`));
    if (diffParts.length > 0) {
      gitInner.push(`[${diffParts.join(' ')}]`);
    }
  }

  return `${gitColor('git:(', colors)}${gitInner.join(' ')}${gitColor(')', colors)}`;
}

function formatAheadCount(
  ahead: number,
  gitConfig: RenderContext['config']['gitStatus'] | undefined,
  colors: RenderContext['config']['colors'] | undefined,
): string {
  const value = `↑${ahead}`;
  const criticalThreshold = gitConfig?.pushCriticalThreshold ?? 0;
  const warningThreshold = gitConfig?.pushWarningThreshold ?? 0;

  if (criticalThreshold > 0 && ahead >= criticalThreshold) {
    return criticalColor(value, colors);
  }

  if (warningThreshold > 0 && ahead >= warningThreshold) {
    return warningColor(value, colors);
  }

  return gitBranchColor(value, colors);
}

/**
 * Render the "files changed since last commit" line that follows the git
 * status — e.g. `~auth.ts(+5 -3)  +new.ts  -deleted.ts  ?2 untracked`.
 *
 * Returns null when:
 *   - gitStatus.showFileStats is false
 *   - no fileStats data
 *   - terminal is too narrow (< 60 cols) to render meaningfully
 *
 * The caller (render/index.ts) appends this line right after the git element
 * row when applicable.
 */
export function renderGitFilesLine(
  ctx: RenderContext,
  terminalWidth: number | null = null,
): string | null {
  const gitConfig = ctx.config?.gitStatus;
  if (!(gitConfig?.showFileStats ?? false)) return null;
  if (!ctx.gitStatus?.fileStats) return null;

  const { trackedFiles, untracked } = ctx.gitStatus.fileStats;
  if (trackedFiles.length === 0 && untracked === 0) return null;
  if (terminalWidth !== null && terminalWidth < 60) return null;

  const cwd = ctx.stdin.cwd;
  const sorted = [...trackedFiles].sort((a, b) => {
    try {
      const aPath = cwd ? resolvePathWithinCwd(cwd, a.fullPath) : null;
      const bPath = cwd ? resolvePathWithinCwd(cwd, b.fullPath) : null;
      const aMtime = aPath ? fs.statSync(aPath).mtimeMs : 0;
      const bMtime = bPath ? fs.statSync(bPath).mtimeMs : 0;
      return bMtime - aMtime;
    } catch {
      return 0;
    }
  });

  const shown = sorted.slice(0, 6);
  const overflow = sorted.length - shown.length;
  const statParts: string[] = [];

  for (const trackedFile of shown) {
    const prefix =
      trackedFile.type === 'added'
        ? green('+')
        : trackedFile.type === 'deleted'
          ? red('-')
          : yellow('~');
    const safeBasename = sanitizeDisplayText(trackedFile.basename);
    const coloredName =
      trackedFile.type === 'added'
        ? green(safeBasename)
        : trackedFile.type === 'deleted'
          ? red(safeBasename)
          : yellow(safeBasename);
    const resolvedPath = cwd ? resolvePathWithinCwd(cwd, trackedFile.fullPath) : null;
    const linkedName = resolvedPath
      ? safeHyperlink(getFileHref(resolvedPath), coloredName)
      : coloredName;
    let entry = `${prefix}${linkedName}`;

    if (trackedFile.lineDiff) {
      const diffParts: string[] = [];
      if (trackedFile.lineDiff.added > 0) {
        diffParts.push(green(`+${trackedFile.lineDiff.added}`));
      }
      if (trackedFile.lineDiff.deleted > 0) {
        diffParts.push(red(`-${trackedFile.lineDiff.deleted}`));
      }
      if (diffParts.length > 0) {
        entry += dim(`(${diffParts.join(' ')})`);
      }
    }

    statParts.push(entry);
  }

  if (overflow > 0) statParts.push(dim(`+${overflow} more`));
  if (untracked > 0) statParts.push(dim(`?${untracked}`));

  return statParts.join('  ');
}
