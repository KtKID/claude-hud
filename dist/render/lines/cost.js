import { resolveSessionCost, formatUsd } from '../../cost.js';
import { t } from '../../i18n/index.js';
import { label } from '../colors.js';
export function renderCostEstimate(ctx) {
    if (ctx.config?.display?.showCost !== true) {
        return null;
    }
    const cost = resolveSessionCost(ctx.stdin, ctx.transcript.sessionTokens);
    if (!cost) {
        return null;
    }
    const labelKey = cost.source === 'native' ? 'label.cost' : 'label.estimatedCost';
    return label(`${t(labelKey)} ${formatUsd(cost.totalUsd)}`, ctx.config?.colors);
}
/**
 * elementOrder-friendly alias so the render dispatcher can treat 'cost'
 * uniformly with the other line modules. Behavior is identical to
 * renderCostEstimate; the original name is kept exported for callers (such
 * as the legacy renderProjectLine) that still reference it.
 */
export function renderCostLine(ctx) {
    return renderCostEstimate(ctx);
}
//# sourceMappingURL=cost.js.map