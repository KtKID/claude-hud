import type { RenderContext } from '../../types.js';
import { getOutputSpeed } from '../../speed-tracker.js';
import { label } from '../colors.js';
import { t } from '../../i18n/index.js';

/**
 * Render the output-token speed segment — `out: 42.1 tok/s`.
 *
 * Returns null when display.showSpeed isn't enabled or when speed-tracker
 * can't compute a stable rate yet (insufficient samples / sub-window timing).
 */
export function renderSpeedLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  if (!display?.showSpeed) {
    return null;
  }
  const speed = getOutputSpeed(ctx.stdin);
  if (speed === null) {
    return null;
  }
  return label(
    `${t('format.out')}: ${speed.toFixed(1)} ${t('format.tokPerSec')}`,
    ctx.config?.colors,
  );
}
