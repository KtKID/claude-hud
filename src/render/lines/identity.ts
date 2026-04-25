import type { RenderContext } from "../../types.js";
import {
  getContextPercent,
  getBufferedPercent,
  getTotalTokens,
} from "../../stdin.js";
import { coloredBar, label, getContextColor, RESET, dim, yellow, red } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { t } from "../../i18n/index.js";
import { progressLabel } from "./label-align.js";
import type { ContextEtaPrediction } from "../../types.js";

const DEBUG =
  process.env.DEBUG?.includes("claude-hud") || process.env.DEBUG === "*";

export function renderIdentityLine(
  ctx: RenderContext,
  alignLabels = false,
): string {
  const rawPercent = getContextPercent(ctx.stdin);
  const bufferedPercent = getBufferedPercent(ctx.stdin);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? "enabled";
  const percent = autocompactMode === "disabled" ? rawPercent : bufferedPercent;
  const colors = ctx.config?.colors;

  if (DEBUG && autocompactMode === "disabled") {
    console.error(
      `[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`,
    );
  }

  const display = ctx.config?.display;
  const contextThresholds = {
    warning: display?.contextWarningThreshold,
    critical: display?.contextCriticalThreshold,
  };
  const contextValueMode = display?.contextValue ?? "percent";
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  const contextValueDisplay = `${getContextColor(percent, colors, contextThresholds)}${contextValue}${RESET}`;

  let line =
    display?.showContextBar !== false
      ? `${progressLabel("label.context", colors, alignLabels)} ${coloredBar(percent, getAdaptiveBarWidth(), colors, contextThresholds)} ${contextValueDisplay}`
      : `${progressLabel("label.context", colors, alignLabels)} ${contextValueDisplay}`;

  if (display?.showTokenBreakdown !== false && percent >= (display?.contextCriticalThreshold ?? 85)) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens(
        (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0),
      );
      line += label(
        ` (${t("format.in")}: ${input}, ${t("format.cache")}: ${cache})`,
        colors,
      );
    }
  }

  if (display?.showContextEta && ctx.contextEta) {
    line += ` ${formatContextEta(ctx.contextEta)}`;
  }

  return line;
}

/**
 * Format an ETA prediction as a colored "→ ~Xm to full" suffix.
 * Color thresholds:
 *   > 30m  dim      (no urgency)
 *   10-30m yellow   (heads-up)
 *   < 10m  red      (act now)
 * Low-confidence predictions get a trailing "?" to flag noise.
 */
function formatContextEta(eta: ContextEtaPrediction): string {
  const minutes = eta.minutesUntilFull;
  const suffix = eta.confidence === "low" ? "?" : "";
  const text = `→ ~${formatMinutes(minutes)} ${t("format.contextEtaUntilFull")}${suffix}`;

  if (minutes < 10) return red(text);
  if (minutes < 30) return yellow(text);
  return dim(text);
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes - hours * 60);
    return remaining > 0 ? `${hours}h${remaining}m` : `${hours}h`;
  }
  if (minutes >= 1) {
    return `${Math.round(minutes)}m`;
  }
  return `<1m`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(0)}k`;
  }
  return n.toString();
}

function formatContextValue(
  ctx: RenderContext,
  percent: number,
  mode: "percent" | "tokens" | "remaining" | "both",
): string {
  const totalTokens = getTotalTokens(ctx.stdin);
  const size = ctx.stdin.context_window?.context_window_size ?? 0;

  if (mode === "tokens") {
    if (size > 0) {
      return `${formatTokens(totalTokens)}/${formatTokens(size)}`;
    }
    return formatTokens(totalTokens);
  }

  if (mode === "both") {
    if (size > 0) {
      return `${percent}% (${formatTokens(totalTokens)}/${formatTokens(size)})`;
    }
    return `${percent}%`;
  }

  if (mode === "remaining") {
    return `${Math.max(0, 100 - percent)}%`;
  }

  return `${percent}%`;
}
