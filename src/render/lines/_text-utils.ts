import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Shared text-handling helpers for line render modules. Extracted from the
 * legacy project.ts so model.ts / git.ts / project.ts can reuse them without
 * duplication.
 */

const CONTROL_AND_BIDI_PATTERN =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u206A-\u206F]/g;

export function sanitizeDisplayText(value: string): string {
  return value.replace(CONTROL_AND_BIDI_PATTERN, '');
}

function hyperlink(uri: string, text: string): string {
  const esc = '\x1b';
  const st = '\\';
  return `${esc}]8;;${uri}${esc}${st}${text}${esc}]8;;${esc}${st}`;
}

export function getFileHref(filePath: string): string | null {
  try {
    return pathToFileURL(path.resolve(filePath)).toString();
  } catch {
    return null;
  }
}

export function resolvePathWithinCwd(cwd: string, candidatePath: string): string | null {
  const resolvedCwd = path.resolve(cwd);
  const resolvedPath = path.resolve(cwd, candidatePath);
  const relative = path.relative(resolvedCwd, resolvedPath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolvedPath;
  }
  return null;
}

/**
 * Wrap `text` in an OSC-8 terminal hyperlink pointing at `uri`. Only emits
 * the escape sequence for https: and file: protocols; other schemes return
 * the bare text. Bad URIs fall through to bare text as well.
 */
export function safeHyperlink(uri: string | undefined | null, text: string): string {
  if (!uri) {
    return text;
  }

  const sanitizedUri = sanitizeDisplayText(uri);
  try {
    const parsed = new URL(sanitizedUri);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'file:') {
      return text;
    }
    return hyperlink(parsed.toString(), text);
  } catch {
    return text;
  }
}
