import path from "node:path";
import os from "node:os";
import { mkdir, writeFile, mkdtemp, readdir, stat, rm, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { BlueprintSource } from "../models/BlueprintSource";
import { buildGithubTarballUrl, parseGitHubRepoReference } from "./githubUtils";
import { downloadBytes } from "./api";
import { BLUEPRINT_FOLDER_NAME } from "./constants";


export const copyToLocation = async (source: BlueprintSource) => {
  if (source.type !== "github") {
    throw new Error(`copyToLocation only supports GitHub sources (got: ${source.type}).`);
  }

  const repoReference = parseGitHubRepoReference(source.source);
  if (!repoReference) {
    throw new Error(`Could not parse GitHub repository from source: ${source.source}`);
  }

  const cwd = process.cwd();
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "blueprinter-"));

  try {
    const githubTarballUrl = buildGithubTarballUrl(repoReference);
    const tarballBytes = await downloadBytes(githubTarballUrl);

    const localTempPath = path.join(tmpRoot, "repo.tar.gz");
    await writeFile(localTempPath, tarballBytes);

    const extractedDir = path.join(tmpRoot, "extracted");
    await mkdir(extractedDir, { recursive: true });
    await extractTarFile(localTempPath, extractedDir);

    const extractedBlueprintFolder = await getExtractedBlueprintFolder(extractedDir);

    const s = await stat(extractedBlueprintFolder).catch(() => null);
    if (!s || !s.isDirectory()) {
      throw new Error(`Expected folder "${BLUEPRINT_FOLDER_NAME}/" at repo root (${repoReference.owner}/${repoReference.repo}${repoReference.ref ? `@${repoReference.ref}` : ""}).`);
    }

    await copyBlueprintContentsToCwd(extractedBlueprintFolder, cwd);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};

const extractTarFile = async (tarGzPath: string, destDir: string) => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xzf", tarGzPath, "-C", destDir], { stdio: "pipe" });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to extract tarball (tar exit ${code}). ${stderr}`.trim()));
    });
  });
};

const getExtractedBlueprintFolder = async (extractedDir: string) => {
  const entries = await readdir(extractedDir, { withFileTypes: true });
  const firstFolder = entries.find((e) => e.isDirectory())?.name;
  if (!firstFolder) throw new Error(`No folder found in extracted directory: ${extractedDir}`);
  return path.join(extractedDir, firstFolder, BLUEPRINT_FOLDER_NAME);
};

const copyBlueprintContentsToCwd = async (blueprintDir: string, cwd: string) => {
  for (const name of await readdir(blueprintDir)) {
    await cp(path.join(blueprintDir, name), path.join(cwd, name), { recursive: true, force: true });
  }
};