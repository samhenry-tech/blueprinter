import { promises } from "fs";
import path from "path";
import { BlueprintConfig } from "../models/BlueprintConfig";
import { VariableValue } from "../models/VariableValue";
import { ReplacementValue } from "../models/ReplacementValue";
import { getReplacementValues } from "./applyReplacementsHelpers";
import { Adjustment, applyAdjustment } from "./adjustmentsHelpers";

const defaultIgnoredDirectories = ["node_modules", ".git", "dist", "build"];

export const applyReplacementsToProject = async (
  config: BlueprintConfig,
  answers: VariableValue[]
) => {

  const replacementValues = getReplacementValues(config, answers);

  const rootDirectory = process.cwd();

  await applyReplacementsInDirectory(rootDirectory, replacementValues);
};

const applyReplacementsInDirectory = async (
  directoryPath: string,
  replacements: ReplacementValue[],
) => {
  const entries = await promises.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (defaultIgnoredDirectories.includes(entry.name.toLowerCase())) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      await applyReplacementsInDirectory(entryPath, replacements);
    } else if (entry.isFile()) {
      await applyReplacementsToFileContents(entryPath, replacements);
      await applyReplacementsToFileNames(entryPath, replacements);
    }
  }

  if (directoryPath !== process.cwd()) {
    await applyReplacementsToFolderNames(directoryPath, replacements);
  }
};

const applyReplacementsToFolderNames = async (
  folderPath: string,
  replacements: ReplacementValue[],
) => {
  await renamePathWithReplacements(folderPath, replacements);
};

const applyReplacementsToFileNames = async (
  filePath: string,
  replacements: ReplacementValue[],
) => {
  await renamePathWithReplacements(filePath, replacements);
};

const applyReplacementsToFileContents = async (
  filePath: string,
  replacements: ReplacementValue[],
) => {
  const originalContent = await promises.readFile(filePath, "utf8");
  const updatedContent = applyReplacementsToText(originalContent, replacements);

  if (updatedContent !== originalContent) {
    await promises.writeFile(filePath, updatedContent, "utf8");
  }
};

const renamePathWithReplacements = async (
  currentPath: string,
  replacements: ReplacementValue[],
) => {
  const directoryName = path.dirname(currentPath);
  const currentName = path.basename(currentPath);

  const updatedName = applyReplacementsToText(currentName, replacements);

  if (updatedName === currentName) {
    return;
  }

  const updatedPath = path.join(directoryName, updatedName);

  await promises.rename(currentPath, updatedPath);
};

const applyReplacementsToText = (
  text: string,
  replacements: ReplacementValue[],
): string => {
  return replacements.reduce(applyVariableReplacement, text);
};

const applyVariableReplacement = (
  text: string,
  replacement: ReplacementValue,
): string => {
  return text.replace(replacement.variableRegex, (_, adjustment: Adjustment) => {
    return applyAdjustment(replacement.value, adjustment);
  });
};





