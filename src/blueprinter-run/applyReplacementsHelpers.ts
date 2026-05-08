import { BlueprintConfig } from "../models/BlueprintConfig";
import { ReplacementValue } from "../models/ReplacementValue";
import { VariableValue } from "../models/VariableValue";
import { escapeRegExp } from "../regexHelpers";
import { allAdjustmentsPattern } from "./adjustmentsHelpers";

export const getReplacementValues = (config: BlueprintConfig, answers: VariableValue[]): ReplacementValue[] => {
  return answers.map((answer) => {
    return {
      variableRegex: createVariableTokenRegex(config.delimiter, answer.variableName),
      value: answer.value,
    };
  });
};

export const createVariableTokenRegex = (
  delimiter: string,
  variableName: string
): RegExp => {
  const escapedDelimiter = escapeRegExp(delimiter);
  const escapedVariableName = escapeRegExp(variableName);

  return new RegExp(
    `${escapedDelimiter}\\s*${escapedVariableName}\\.(${allAdjustmentsPattern})\\s*${escapedDelimiter}`,
    "g"
  );
};

