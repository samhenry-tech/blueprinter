import path from "node:path";
import { cp, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { applyTemplateString, sortPathsDeepestFirst } from "./blueprintReplacements";

const collectPathsRecursive = async (root: string): Promise<string[]> => {
  const st = await stat(root);
  if (st.isFile()) return [root];
  const entries = await readdir(root, { withFileTypes: true });
  const out: string[] = [root];
  for (const e of entries) {
    out.push(...(await collectPathsRecursive(path.join(root, e.name))));
  }
  return out;
};

const updateRootsAfterRename = (roots: string[], from: string, to: string): string[] =>
  roots.map((r) => {
    if (r === from) return to;
    if (r.startsWith(from + path.sep)) return to + r.slice(from.length);
    return r;
  });

export const copyBlueprintFolderToCwd = async (
  blueprintDir: string,
  cwd: string
): Promise<string[]> => {
  const entries = await readdir(blueprintDir, { withFileTypes: true });
  const copiedRoots: string[] = [];
  for (const e of entries) {
    const from = path.join(blueprintDir, e.name);
    const to = path.join(cwd, e.name);
    await cp(from, to, { recursive: true });
    copiedRoots.push(to);
  }
  return copiedRoots;
};

export const applyReplacementsToCopiedTree = async (
  copiedTopLevelPaths: string[],
  vars: Record<string, string>
): Promise<void> => {
  let roots = [...copiedTopLevelPaths];

  const allPathsSorted = async (): Promise<string[]> => {
    const all = (await Promise.all(roots.map((r) => collectPathsRecursive(r)))).flat();
    return sortPathsDeepestFirst(all);
  };

  for (;;) {
    const paths = await allPathsSorted();
    let renamed = false;
    for (const p of paths) {
      const base = path.basename(p);
      const newBase = applyTemplateString(base, vars);
      if (!newBase || newBase === base) continue;
      const dest = path.join(path.dirname(p), newBase);
      await rename(p, dest);
      roots = updateRootsAfterRename(roots, p, dest);
      renamed = true;
      break;
    }
    if (!renamed) break;
  }

  const finalPaths = await allPathsSorted();
  for (const p of finalPaths) {
    try {
      if (!(await stat(p)).isFile()) continue;
    } catch {
      continue;
    }
    const buf = await readFile(p, "utf8");
    const next = applyTemplateString(buf, vars);
    if (next !== buf) await writeFile(p, next, "utf8");
  }
};
