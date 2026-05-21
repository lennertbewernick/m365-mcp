import { spawn } from "node:child_process";
import { parse as shellParse } from "shell-quote";

export interface M365Result {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  parsed: unknown;
  command: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 1_000_000;

function parseArgs(command: string): string[] {
  const trimmed = command.trim().replace(/^m365\s+/, "");
  const tokens = shellParse(trimmed);
  const args: string[] = [];
  for (const t of tokens) {
    if (typeof t === "string") {
      args.push(t);
    } else if (t && typeof t === "object" && "op" in t) {
      throw new Error(
        `Shell operators are not allowed in m365_run (got: ${JSON.stringify(t)}). Use one command at a time.`,
      );
    }
  }
  return args;
}

function ensureJsonOutput(args: string[]): string[] {
  const has = args.some(
    (a, i) =>
      a === "-o" ||
      a === "--output" ||
      a.startsWith("--output=") ||
      (args[i - 1] === "-o" || args[i - 1] === "--output"),
  );
  return has ? args : [...args, "--output", "json"];
}

export async function runM365(
  command: string,
  opts: { timeoutMs?: number; forceJson?: boolean } = {},
): Promise<M365Result> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, forceJson = true } = opts;
  let args = parseArgs(command);
  if (args.length === 0) {
    throw new Error("Empty command. Provide a m365 subcommand, e.g. 'status' or 'outlook message list'.");
  }
  if (forceJson) args = ensureJsonOutput(args);

  const fullCommand = ["m365", ...args].join(" ");

  return await new Promise<M365Result>((resolve, reject) => {
    const child = spawn("m365", args, { env: process.env });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > MAX_OUTPUT_BYTES) {
        killed = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn m365: ${err.message}. Is the CLI installed? (npm i -g @pnp/cli-microsoft365)`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      let parsed: unknown = null;
      const text = stdout.trim();
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
      resolve({
        ok: code === 0 && !killed,
        exitCode: code ?? -1,
        stdout,
        stderr,
        parsed,
        command: fullCommand,
      });
    });
  });
}

export function formatResult(r: M365Result): string {
  if (r.ok && r.parsed !== null) {
    return `\`\`\`json\n${JSON.stringify(r.parsed, null, 2)}\n\`\`\``;
  }
  if (r.ok) {
    return r.stdout || "(no output)";
  }
  const parts: string[] = [`m365 exited with code ${r.exitCode}.`];
  parts.push(`Command: ${r.command}`);
  if (r.stderr.trim()) parts.push(`stderr:\n${r.stderr.trim()}`);
  if (r.stdout.trim()) parts.push(`stdout:\n${r.stdout.trim()}`);
  return parts.join("\n\n");
}
