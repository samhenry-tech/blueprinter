import path from "node:path";
import os from "node:os";
import { mkdir, writeFile, mkdtemp, readdir, stat, copyFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { BlueprintSource } from "../models/BlueprintSource";
import { BlueprintConfig } from "../models/BlueprintConfig";
import { buildGithubTarballUrl, parseGitHubRepoReference } from "./githubUtils";
import { downloadBytes } from "./runUtils";

const blueprintFolderName = "blueprint";

export const copyToLocation = async (source: BlueprintSource, blueprintConfig: BlueprintConfig) => {
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

    const repoRoot = await findSingleTopLevelFolder(extractedDir);
    const blueprintDir = path.join(repoRoot, blueprintFolderName);

    const s = await stat(blueprintDir).catch(() => null);
    if (!s || !s.isDirectory()) {
      throw new Error(
        `Expected folder "${blueprintFolderName}/" at repo root (${repoReference.owner}/${repoReference.repo}${repoReference.ref ? `@${repoReference.ref}` : ""}).`,
      );
    }

    await copyBlueprintContentsToCwd(blueprintDir, cwd);
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

const findSingleTopLevelFolder = async (dir: string): Promise<string> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) {
    const names = entries.map((e) => e.name).join(", ");
    throw new Error(`Unexpected tarball structure in ${dir}. Entries: ${names}`);
  }
  return path.join(dir, dirs[0]!.name);
};

const copyBlueprintContentsToCwd = async (blueprintDir: string, cwd: string) => {
  const walk = async (current: string) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const relFromBlueprint = path.relative(blueprintDir, abs);
      if (!relFromBlueprint || relFromBlueprint.startsWith("..") || path.isAbsolute(relFromBlueprint)) {
        throw new Error(`Refusing to copy outside blueprint folder: ${abs}`);
      }
      const dest = path.join(cwd, relFromBlueprint);

      if (entry.isDirectory()) {
        await mkdir(dest, { recursive: true });
        await walk(abs);
        continue;
      }

      if (entry.isFile()) {
        await mkdir(path.dirname(dest), { recursive: true });
        await copyFile(abs, dest);
        continue;
      }

      // Ignore symlinks and other special files for safety/portability.
    }
  };

  await walk(blueprintDir);
};