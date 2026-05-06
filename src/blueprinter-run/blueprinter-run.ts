import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import inquirer from "inquirer";
import { blueprintSourceListSchema, type BlueprintSource } from "../models/BlueprintSource";
import { BlueprintConfig, blueprintConfigSchema } from "../models/BlueprintConfig";
import { parseSupportedSource } from "../run-helper";
import { resolveBlueprintRoot } from "../resolveBlueprintRoot";
import { copyBlueprintFolderToCwd, applyReplacementsToCopiedTree } from "../applyBlueprintToCwd";
import { checkGithubFolderExists, parseGitHubRepoReference } from "./githubUtils";
import { getGithubFile } from "./githubApi";
import { downloadFile } from "./runUtils";

const previousSourcesFileLocation = path.join(process.cwd(), ".blueprinter-sources.json");

export const commandRun = async () => {
  // Step 1: Print the run intro
  printRunIntro();

  // Step 2: Read the previous sources
  const previousSources = readPreviousSources();

  // Step 3: Pick the blueprint source
  const choice = await pickBlueprintSource(previousSources);
  const source: BlueprintSource = choice === "new" ? await promptNewSource() : choice;

  // Step 4: Read and validate the blueprint source
  console.log("Reading blueprint source...");
  const blueprintConfig = await readAndValidateBlueprintSource(source);
  console.log("Blueprint source is validated and ready to use.");

  // Step 5: Ask all the questions
  const answers = await askQuestions(blueprintConfig);
  console.log("Blueprint config:", blueprintConfig);

  // Step 6: Copy the project to the current directory

  // Step 7: Apply the replacements to the project

  // Step 8: Print the completion message
};

const printRunIntro = () => {
  console.log("Welcome to Blueprinter!");
  console.log("This is a tool that helps you create a project from a blueprint source.");
  console.log("It asks a few questions, then generates the project based on your answers.");
  console.log("");
  console.log("--------------------------------");
  console.log("");
  console.log("Let's get started!");
  console.log("");
};

const readPreviousSources = (): BlueprintSource[] => {
  try {
    const data = JSON.parse(readFileSync(previousSourcesFileLocation, "utf8"));
    return blueprintSourceListSchema.parse(data);
  } catch {
    return [];
  }
};

type SourceChoice = BlueprintSource | "new";

const pickBlueprintSource = async (
  previousSources: BlueprintSource[]
): Promise<SourceChoice> => {
  if (previousSources.length === 0) return "new" as const;

  const choices = [
    ...previousSources.map((ps) => ({
      name: `${ps.source} (${ps.type === "github" ? "GitHub" : "Folder"})`,
      value: ps,
    })),
    new inquirer.Separator(),
    { name: "Enter a new source…", value: "new" as const },
  ];

  const { selection } = await inquirer.prompt<{ selection: SourceChoice }>([
    {
      type: "list",
      name: "selection",
      message: "Blueprint source:",
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

const blueprintConfigFilename = "blueprintconfig.json"
const blueprintFolderName = "blueprint"

const readAndValidateBlueprintSource = async (source: BlueprintSource): Promise<BlueprintConfig> => {
  if (source.type === "github") {
    const repoReference = parseGitHubRepoReference(source.source);
    if (!repoReference) {
      throw new Error(`Could not parse GitHub repository from source: ${source.source}`);
    }

    const getAndParseConfigPromise = async () => {
      const githubFile = await getGithubFile(repoReference, blueprintConfigFilename);
      if (!githubFile.download_url) {
        throw new Error(`Download URL not found for GitHub file: ${githubFile.path}`);
      }

      const config = await downloadFile(githubFile.download_url);
      return blueprintConfigSchema.parse(config);
    }

    const folderExistsPromise = async () => {
      const folderExists = await checkGithubFolderExists(repoReference, blueprintFolderName);
      if (!folderExists)
        throw new Error(`Blueprint folder not found at ${repoReference.owner}/${repoReference.repo}/${blueprintFolderName}`);
    }

    const [config] = await Promise.all([getAndParseConfigPromise(), folderExistsPromise()])
    return config;
  }

  throw new Error(`Unsupported blueprint source type: ${source.type}`);
};

type VariableAnswer = { variableName: string; value: string };

const askQuestions = async (blueprintConfig: BlueprintConfig): Promise<VariableAnswer[]> => {
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