import { githubFileSchema, githubFilesSchema } from "../models/GithubFile";
import { GithubRepoReference } from "../models/GithubRepoReference";

export const parseGitHubRepoRef = (input: string): GithubRepoReference | null => {
  const raw = input.trim();
  if (!raw) return null;

  // owner/repo shorthand
  if (/^[^/]+\/[^/]+$/.test(raw) && !/^https?:\/\//i.test(raw) && !/^git@/i.test(raw) && !/^ssh:\/\//i.test(raw)) {
    const [owner, repo0] = raw.split("/");
    const repo = repo0.replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  }

  // git@github.com:owner/repo(.git)
  if (raw.startsWith("git@github.com:")) {
    const rest = raw.slice("git@github.com:".length).replace(/\.git$/i, "");
    const [owner, repo] = rest.split("/");
    if (!owner || !repo) return null;
    return { owner, repo };
  }

  // ssh://git@github.com/owner/repo(.git)
  if (/^ssh:\/\/git@github\.com\//i.test(raw)) {
    const rest = raw.replace(/^ssh:\/\/git@github\.com\//i, "").replace(/\.git$/i, "");
    const [owner, repo] = rest.split("/");
    if (!owner || !repo) return null;
    return { owner, repo };
  }

  // https://github.com/owner/repo(.git) and optionally /tree/<ref>/...
  if (/^https?:\/\//i.test(raw)) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return null;
    }
    const host = u.hostname.toLowerCase();
    if (host !== "github.com" && !host.endsWith(".github.com")) return null;

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/i, "");

    let ref: string | undefined;
    const treeIdx = parts.findIndex((p) => p === "tree");
    if (treeIdx >= 0 && parts[treeIdx + 1]) {
      ref = parts[treeIdx + 1]!;
    }

    return { owner, repo, ref };
  }

  return null;
};

const githubApiBase = "https://api.github.com";

export const fetchGithubFile = async (repo: GithubRepoReference, path: string) => {
  const url = buildContentsUrl(repo, path);
  return await getGithubFile(url);
};

export const checkGithubFolderExists = async (repo: GithubRepoReference, path: string): Promise<boolean> => {
  const { remainingPath, folderName } = getFolderAndPath(path);
  if (!folderName) throw new Error(`Folder name not found in path: ${path}`);

  const url = buildContentsUrl(repo, remainingPath);
  const files = await getGithubFolder(url);
  return files.some((file) => file.name === folderName && file.type === "dir");
};

const getGithubFile = async (url: string) => {
  const json = await githubFetchJson(url)
  return githubFileSchema.parse(json);
}

const getGithubFolder = async (url: string) => {
  const json = await githubFetchJson(url)
  return githubFilesSchema.parse(json);
}

const githubFetchJson = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "blueprinter",
    },
  });

  if (res.status === 404) {
    throw new Error(`Not found on GitHub: ${url}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub request failed (${res.status} ${res.statusText}). ${body}`.trim());
  }

  const json = await res.json();
  return json;
};

const buildContentsUrl = (repoReference: GithubRepoReference, path: string): string => {
  const { owner, repo, ref } = repoReference;
  const encodedPath = path
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join("/");

  const base = `${githubApiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  if (!ref) return base;
  return `${base}?ref=${encodeURIComponent(ref)}`;
};

const getFolderAndPath = (path: string): { remainingPath: string; folderName: string } => {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  const match = normalized.match(/^(?:(.*)\/)?([^/]+)$/);
  return {
    remainingPath: match?.[1] ?? "",
    folderName: match?.[2] ?? "",
  };
};