import type { RenderContext } from '../../types.js';
export declare function renderCostEstimate(ctx: RenderContext): string | null;
/**
 * elementOrder-friendly alias so the render dispatcher can treat 'cost'
 * uniformly with the other line modules. Behavior is identical to
 * renderCostEstimate; the original name is kept exported for callers (such
 * as the legacy renderProjectLine) that still reference it.
 */
export declare function renderCostLine(ctx: RenderContext): string | null;
//# sourceMappingURL=cost.d.ts.map