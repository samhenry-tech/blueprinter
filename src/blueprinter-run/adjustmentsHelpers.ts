import { escapeRegExp } from "../regexHelpers";

const getLowercase = (v: string) => normalizeString(v).toLowerCase();

const getUppercase = (v: string) => normalizeString(v).toUpperCase();

const getSentenceCase = (v: string) => {
  const sentence = splitIntoWords(v).join(" ").toLowerCase();

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

const getTitleCase = (v: string) => {
  return splitIntoWords(v).map(capitalize).join(" ");
};

const getPascalCase = (v: string) => {
  return splitIntoWords(normalizeString(v)).map(capitalize).join("");
};

const getCamelCase = (v: string) => {
  const [firstWord, ...remainingWords] = splitIntoWords(normalizeString(v));

  return [
    firstWord?.toLowerCase() ?? "",
    ...remainingWords.map(capitalize),
  ].join("");
};

const splitIntoWords = (value: string): string[] => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s-_]+/)
    .filter(Boolean);
};

const capitalize = (value: string): string => {
  const lowerCaseValue = value.toLowerCase();

  return lowerCaseValue.charAt(0).toUpperCase() + lowerCaseValue.slice(1);
};

const normalizeString = (v: string) => v.replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Adjustments are functions that take a string and return a string.
 * They are used to transform the value of a variable based on the adjustment type.
 */
export const adjustments = {
  lowercase: getLowercase,
  UPPERCASE: getUppercase,
  "Sentence case": getSentenceCase,
  "Title Case": getTitleCase,
  PascalCase: getPascalCase,
  camelCase: getCamelCase,
};

export const allAdjustmentsPattern = Object.keys(adjustments).map(escapeRegExp).join("|");

export type Adjustment = keyof typeof adjustments;

export const applyAdjustment = (value: string, adjustment: Adjustment): string => {
  return adjustments[adjustment](value);
};
