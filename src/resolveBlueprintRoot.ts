import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { BlueprintSource } from "./models/BlueprintSource";

const GITHUB_OWNER_REPO =
  /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])$/;

const toGitCloneUrl = (source: string): string => {
  const s = source.trim();
  if (s.startsWith("git@github.com:")) {
    const rest = s.slice("git@github.com:".length).replace(/\.git$/i, "");
    return `https://github.com/${rest}.git`;
  }
  if (/^https?:\/\//i.test(s)) {
    if (/github\.com/i.test(s) && !/\.git(\?|$)/i.test(s)) {
      const [base, ...qs] = s.split("?");
      return `${base.replace(/\/+$/, "")}.git${qs.length ? `?${qs.join("?")}` : ""}`;
    }
    return s;
  }
  if (GITHUB_OWNER_REPO.test(s)) {
    const [owner, repo] = s.split("/");
    return `https://github.com/${owner}/${repo}.git`;
  }
  return s;
};

const resolveFolderRoot = (source: string): string => {
  const resolved = path.isAbsolute(source) ? path.normalize(source) : path.resolve(process.cwd(), source);
  if (!existsSync(resolved)) {
    throw new Error(`Blueprint folder does not exist: ${resolved}`);
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Blueprint source is not a folder: ${resolved}`);
  }
  return resolved;
};

export type ResolvedRoot = {
  rootPath: string;
  cleanup: () => Promise<void>;
};

export const resolveBlueprintRoot = async (src: BlueprintSource): Promise<ResolvedRoot> => {
  if (src.type === "folder") {
    return {
      rootPath: resolveFolderRoot(src.source),
      cleanup: async () => {
        /* noop */
      },
    };
  }

  const cloneUrl = toGitCloneUrl(src.source);
  const parentDir = await mkdtemp(path.join(tmpdir(), "blueprinter-"));
  const cloneInto = path.join(parentDir, "repo");

  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn("git", ["clone", "--depth", "1", cloneUrl, cloneInto], { stdio: "inherit" });
      p.on("error", reject);
      p.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`git clone exited with code ${code ?? "unknown"}`));
      });
    });
  } catch (e) {
    await rm(parentDir, { recursive: true, force: true });
    throw e;
  }

  return {
    rootPath: cloneInto,
    cleanup: () => rm(parentDir, { recursive: true, force: true }),
  };
};
