import { githubFileSchema, githubFilesSchema } from "../models/GithubFile";
import { GithubRepoReference } from "../models/GithubRepoReference";
import { buildContentsUrl } from "./githubUtils";

export const getGithubFile = async (repo: GithubRepoReference, path: string) => {
  const url = buildContentsUrl(repo, path);
  const json = await githubFetchJson(url);
  return githubFileSchema.parse(json);
};

export const getGithubFolder = async (repo: GithubRepoReference, path: string) => {
  const url = buildContentsUrl(repo, path);
  const json = await githubFetchJson(url);
  return githubFilesSchema.parse(json);
};


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