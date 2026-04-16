import path from "path";
import { BlueprintSource } from "./models/BlueprintSource";
import { existsSync, statSync } from "fs";


/** GitHub `owner/repo` shorthand (two segments). */
const GITHUB_OWNER_REPO =
  /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])$/;

const isGithubRemote = (s: string): boolean => {
  const lower = s.toLowerCase();
  if (s.startsWith("git@github.com:")) return /^git@github\.com:[^/]+\/[^/]+/.test(s);
  if (lower.startsWith("ssh://git@github.com/")) return true;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const h = u.hostname.toLowerCase();
      return h === "github.com" || h.endsWith(".github.com");
    } catch {
      return false;
    }
  }
  return false;
};

const isPathLikeFolder = (s: string): boolean => {
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith("\\\\")) return true;
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("~/")) return true;
  if (s.includes("\\")) return true;
  const parts = s.split("/").filter(Boolean);
  if (parts.length > 2) return true;
  if (parts.length === 2 && !GITHUB_OWNER_REPO.test(s)) return true;
  return false;
};

export const parseSupportedSource = (raw: string): BlueprintSource | null => {
  const s = raw.trim();
  if (!s) return null;

  try {
    const resolved = path.isAbsolute(s) ? path.normalize(s) : path.resolve(process.cwd(), s);
    if (existsSync(resolved)) {
      const st = statSync(resolved);
      if (st.isDirectory()) return { type: "folder", source: s };
    }
  } catch {
    /* ignore */
  }

  if (/^https?:\/\//i.test(s) || /^git@/i.test(s) || /^ssh:\/\//i.test(s)) {
    if (isGithubRemote(s)) return { type: "github", source: s };
    return null;
  }

  if (isPathLikeFolder(s)) return { type: "folder", source: s };

  if (GITHUB_OWNER_REPO.test(s)) return { type: "github", source: s };

  return null;
};