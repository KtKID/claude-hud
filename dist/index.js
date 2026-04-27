import { readStdin, getUsageFromStdin } from "./stdin.js";
import { parseTranscript } from "./transcript.js";
import { render } from "./render/index.js";
import { countConfigs } from "./config-reader.js";
import { getGitStatus } from "./git.js";
import { loadConfig } from "./config.js";
import { parseExtraCmdArg, runExtraCmd } from "./extra-cmd.js";
import { getClaudeCodeVersion } from "./version.js";
import { getMemoryUsage } from "./memory.js";
import { resolveEffortLevel } from "./effort.js";
import { applyContextWindowFallback } from "./context-cache.js";
import { recordContextSample } from "./context-history.js";
import { predictContextEta } from "./context-eta.js";
import { getUsageFromExternalSnapshot } from "./external-usage.js";
import { setLanguage, t } from "./i18n/index.js";
export { getUsageFromExternalSnapshot } from "./external-usage.js";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
export async function main(overrides = {}) {
    const deps = {
        readStdin,
        getUsageFromStdin,
        getUsageFromExternalSnapshot,
        parseTranscript,
        countConfigs,
        getGitStatus,
        loadConfig,
        parseExtraCmdArg,
        runExtraCmd,
        getClaudeCodeVersion,
        getMemoryUsage,
        applyContextWindowFallback,
        render,
        now: () => Date.now(),
        log: console.log,
        ...overrides,
    };
    try {
        const stdin = await deps.readStdin();
        if (!stdin) {
            // Running without stdin - this happens during setup verification
            const config = await deps.loadConfig();
            setLanguage(config.language);
            const isMacOS = process.platform === "darwin";
            deps.log(t("init.initializing"));
            if (isMacOS) {
                deps.log(t("init.macosNote"));
            }
            return;
        }
        const transcriptPath = stdin.transcript_path ?? "";
        const transcript = await deps.parseTranscript(transcriptPath);
        deps.applyContextWindowFallback(stdin, {}, transcript.sessionName, {
            lastCompactBoundaryAt: transcript.lastCompactBoundaryAt,
            lastCompactPostTokens: transcript.lastCompactPostTokens,
        });
        const { claudeMdCount, rulesCount, mcpCount, hooksCount, outputStyle } = await deps.countConfigs(stdin.cwd);
        const config = await deps.loadConfig();
        setLanguage(config.language);
        const gitStatus = config.gitStatus.enabled
            ? await deps.getGitStatus(stdin.cwd)
            : null;
        let usageData = null;
        if (config.display.showUsage !== false) {
            usageData = deps.getUsageFromStdin(stdin);
            if (!usageData) {
                usageData = deps.getUsageFromExternalSnapshot(config, deps.now());
            }
        }
        const extraCmd = deps.parseExtraCmdArg();
        const extraLabel = extraCmd ? await deps.runExtraCmd(extraCmd) : null;
        const sessionDuration = formatSessionDuration(transcript.sessionStart, deps.now);
        const claudeCodeVersion = config.display.showClaudeCodeVersion
            ? await deps.getClaudeCodeVersion()
            : undefined;
        const effortInfo = config.display.showEffortLevel
            ? resolveEffortLevel(stdin.effort)
            : null;
        const memoryUsage = config.display.showMemoryUsage && config.lineLayout === "expanded"
            ? await deps.getMemoryUsage()
            : null;
        // Record this tick's context sample for the ETA predictor and obtain
        // the freshly-trimmed window. recordContextSample is a no-op (returns
        // just the new sample) when no transcript_path is available.
        //
        // Skip used_percentage === 0 — Claude Code reports 0 on early ticks
        // before usage is computed; treating that as a real sample would skew
        // the regression and waste a slot in the rolling window.
        let contextEta = null;
        if (config.display.showContextEta) {
            const usedPercent = stdin.context_window?.used_percentage;
            const totalInputTokens = stdin.context_window?.total_input_tokens ?? 0;
            if (typeof usedPercent === "number" &&
                Number.isFinite(usedPercent) &&
                usedPercent > 0) {
                const sample = {
                    timestamp: deps.now(),
                    percent: usedPercent,
                    totalInputTokens: typeof totalInputTokens === "number" ? totalInputTokens : 0,
                };
                const window = recordContextSample(stdin, sample, transcript.lastCompactBoundaryAt);
                const history = window.slice(0, -1);
                contextEta = predictContextEta(history, sample);
            }
        }
        const ctx = {
            stdin,
            transcript,
            claudeMdCount,
            rulesCount,
            mcpCount,
            hooksCount,
            sessionDuration,
            gitStatus,
            usageData,
            memoryUsage,
            config,
            extraLabel,
            outputStyle,
            claudeCodeVersion,
            effortLevel: effortInfo?.level,
            effortSymbol: effortInfo?.symbol,
            contextEta,
        };
        deps.render(ctx);
    }
    catch (error) {
        deps.log("[claude-hud] Error:", error instanceof Error ? error.message : "Unknown error");
    }
}
export function formatSessionDuration(sessionStart, now = () => Date.now()) {
    if (!sessionStart) {
        return "";
    }
    const ms = now() - sessionStart.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return "<1m";
    if (mins < 60)
        return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
}
const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];
const isSamePath = (a, b) => {
    try {
        return realpathSync(a) === realpathSync(b);
    }
    catch {
        return a === b;
    }
};
if (argvPath && isSamePath(argvPath, scriptPath)) {
    void main();
}
//# sourceMappingURL=index.js.map