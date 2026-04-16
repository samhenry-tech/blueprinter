import path from "node:path";
import { readFileSync } from "node:fs";
import inquirer from "inquirer";
import { blueprintSourceListSchema, type BlueprintSource } from "./models/BlueprintSource";
import { parseSupportedSource } from "./run-helper";

const previousSourcesFileLocation = path.join(process.cwd(), ".blueprinter-sources.json");

export const commandRun = async () => {
  // 1. Print intro
  printRunIntro();

  // 2. Fetch previous sources
  const previousSources = readPreviousSources();

  // 3. Pick source or new source
  const blueprintSource = await pickBlueprintSource(previousSources);

  if (blueprintSource === "new") {
    await promptNewSource();
  }

  console.log("Reading blueprint source...");

  // read the blueprint source
  // find the blueprintconfig.json file - error if not found at root of blueprint source
  // message if found
  // read the blueprintconfig.json file - error if not correct format from blueprintConfigSchema
  // message if correct format

  // ask the list of questions from the blueprintconfig.json file mention "put a space between each word" as you ask each question
  // store the as an array of variables and values

  // message, "Thats all the questions, blueprinting the project..."
  // copy all the files from the blueprint source at folder /blueprint to the current working directory
  // loop through the array of variables and values and replace the variables in the filenames and files using the pattern {{variableName}}
  //Support whitespace in the variable capture {{ variableName }}
  //Support camelCase value with {{ variableName.camelCase }}
  //Support uppercase value with {{ variableName.UPPERCASE }}
  //Support capitalize value with {{ variableName.Capitalize }} - this will put spaces between the words and capitalize the first letter of each word
  // message, "Project blueprint complete!"

};

const printRunIntro = () => {
  console.log("Welcome to Blueprinter!");
  console.log("This is a tool that helps you create a project from a blueprint source.");
  console.log("It asks a few questions, then generates the project based on your answers.");
  console.log("--------------------------------");
  console.log("");
  console.log("Let's get started!");
  console.log("");
};

const readPreviousSources = (): BlueprintSource[] => {
  try {
    const data: unknown = JSON.parse(readFileSync(previousSourcesFileLocation, "utf8"));
    return blueprintSourceListSchema.parse(data);
  } catch {
    return [];
  }
};

type SourceChoice = BlueprintSource | "new";

const pickBlueprintSource = async (
  previousSources: BlueprintSource[]
): Promise<SourceChoice> => {
  if (previousSources.length === 0)
    return 'new' as const;

  const choices = [
    ...previousSources.map((ps) => ({
      name: `${ps.source} (${ps.type === "github" ? "GitHub" : "Folder"})`,
      value: ps,
    })),
    new inquirer.Separator(),
    { name: "Enter a new source…", value: "new" as const },
  ]


  const { selection } = await inquirer.prompt<{ selection: SourceChoice }>([
    {
      type: "list",
      name: "selection",
      message: "Blueprint source:",
      choices: choices,
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
    console.log("That source is not supported. Only local folder paths and GitHub repositories are supported.");
  }
};