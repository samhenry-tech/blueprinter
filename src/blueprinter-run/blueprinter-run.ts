import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import inquirer from "inquirer";
import { blueprintSourceListSchema, type BlueprintSource } from "../models/BlueprintSource";
import { BlueprintConfig, blueprintConfigSchema } from "../models/BlueprintConfig";
import { getUserDataPath, parseSupportedSource } from "../run-helper";
import { checkGithubFolderExists, parseGitHubRepoReference } from "./githubUtils";
import { getGithubFile } from "./githubApi";
import { downloadFile } from "./api";
import { BLUEPRINT_CONFIG_FILENAME, BLUEPRINT_FOLDER_NAME } from "./constants";
import { copyToLocation } from "./copyToLocation";
import { writeFile } from "node:fs/promises";
import { displayMessage, displayNewLines, waitWithMessage } from "../messaging-helpers";
import { applyReplacementsToProject } from "./applyReplacementsToProject";
import { VariableValue } from "../models/VariableValue";

export const getBlueprinterPreviousSourcesFileLocation = (): string => {
  const dir = getUserDataPath("blueprinter");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, "blueprinter-sources.json");
};

const previousSourcesFileLocation = getBlueprinterPreviousSourcesFileLocation();

export const commandRun = async () => {
  // Step 1: Print the run intro
  await printRunIntro();
  displayNewLines(2);

  // Step 2: Read the previous sources
  const previousSources = readPreviousSources();

  // Step 3: Pick the blueprint source
  const choice = await pickBlueprintSource(previousSources);
  const source: BlueprintSource = choice === "new" ? await promptNewSource() : choice;

  // Step 4: Read and validate the blueprint source
  const blueprintConfig = await waitWithMessage(readAndValidateBlueprintSource(source), "Reading blueprint source...");
  await saveSource(source);
  await displayMessage("Blueprint source is validated and ready to use.");
  displayNewLines(2);

  // Step 5: Ask all the questions
  const answers = await askQuestions(blueprintConfig);
  displayNewLines(2);

  // Step 6: Copy the project to the current directory
  await displayMessage("Now lets copy the project to the current directory.");
  await waitWithMessage(copyToLocation(source), "Copying project to current directory");
  displayNewLines(2);

  // Step 7: Apply the replacements to the project
  await displayMessage("Now lets apply the replacements to the project.");
  await waitWithMessage(applyReplacementsToProject(blueprintConfig, answers), "Applying replacements to project");
  displayNewLines(2);

  // Step 8: Print the completion message
  await displayMessage("Your project is ready!");
  await displayMessage("You can now start working on your project.");
  await displayMessage("--------------------------------", 0);
  await displayMessage("Thank you for using Blueprinter!");
};

const printRunIntro = async () => {
  await displayMessage("Welcome to Blueprinter!");
  await displayMessage("This is a tool that helps you create a project from a blueprint source.");
  await displayMessage("It asks a few questions, then generates the project based on your answers.");
  await displayMessage("--------------------------------", 0);
  await displayMessage("Let's get started!");
};

const readPreviousSources = (): BlueprintSource[] => {
  try {
    const data = JSON.parse(readFileSync(previousSourcesFileLocation, "utf8"));
    return blueprintSourceListSchema.parse(data);
  } catch {
    return [];
  }
};

const saveSource = async (source: BlueprintSource) => {
  const sources = readPreviousSources();
  if (!sources.some((s) => s.source === source.source)) {
    sources.push(source);
    await writeFile(previousSourcesFileLocation, JSON.stringify(sources, null, 2));
  }
};

type SourceChoice = BlueprintSource | "new";

const pickBlueprintSource = async (
  previousSources: BlueprintSource[]
): Promise<SourceChoice> => {
  const choices = [
    ...previousSources.map((ps) => ({
      name: `${ps.source} (${ps.type === "github" ? "GitHub" : "Folder"})`,
      value: ps,
    })),
    { name: "Enter a new source…", value: "new" as const },
  ];

  const { selection } = await inquirer.prompt<{ selection: SourceChoice }>([
    {
      type: "select",
      name: "selection",
      message: "What is your blueprint source?",
      choices,
    },
  ]);

  return selection;
};

const promptNewSource = async (): Promise<BlueprintSource> => {
  while (true) {
    const { source: raw } = await inquirer.prompt<{ source: string }>([
      {
        type: "input",
        name: "source",
        message: "Source (GitHub URL, owner/repo, or path to a folder):",
        validate: (v) => (String(v ?? "").trim().length > 0 ? true : "Source Required"),
      },
    ]);
    const parsed = parseSupportedSource(raw.trim());
    if (parsed) return parsed;
    console.log(
      "That source is not supported. Only local folder paths and GitHub repositories are supported."
    );
  }
};

const readAndValidateBlueprintSource = async (source: BlueprintSource): Promise<BlueprintConfig> => {
  if (source.type === "github") {
    const repoReference = parseGitHubRepoReference(source.source);
    if (!repoReference) {
      throw new Error(`Could not parse GitHub repository from source: ${source.source}`);
    }

    const getAndParseConfigPromise = async () => {
      const githubFile = await getGithubFile(repoReference, BLUEPRINT_CONFIG_FILENAME);
      if (!githubFile.download_url) {
        throw new Error(`Download URL not found for GitHub file: ${githubFile.path}`);
      }

      const config = await downloadFile(githubFile.download_url);
      return blueprintConfigSchema.parse(config);
    }

    const folderExistsPromise = async () => {
      const folderExists = await checkGithubFolderExists(repoReference, BLUEPRINT_FOLDER_NAME);
      if (!folderExists)
        throw new Error(`Blueprint folder not found at ${repoReference.owner}/${repoReference.repo}/${BLUEPRINT_FOLDER_NAME}`);
    }

    const [config] = await Promise.all([getAndParseConfigPromise(), folderExistsPromise()])
    return config;
  }

  throw new Error(`Unsupported blueprint source type: ${source.type}`);
};



const askQuestions = async (blueprintConfig: BlueprintConfig): Promise<VariableValue[]> => {
  await displayMessage("Now lets ask you a few questions to customize your project.");

  const answers = await inquirer.prompt<Record<string, string>>([
    ...blueprintConfig.variables.map((variable) => ({
      type: "input",
      name: variable.variableName,
      message: variable.question,
    })),
  ]);

  return blueprintConfig.variables.map((variable) => ({
    variableName: variable.variableName,
    value: String(answers[variable.variableName] ?? ""),
  }));
};