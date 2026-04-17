const PLACEHOLDER =
  /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\.(camelCase|UPPERCASE|Capitalize))?\s*\}\}/g;

const toCamelCase = (s: string): string => {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const [first, ...rest] = parts;
  return (
    first.toLowerCase() +
    rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("")
  );
};

const toCapitalizeWords = (s: string): string =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const applyModifier = (raw: string, modifier: string | undefined): string => {
  if (!modifier) return raw;
  if (modifier === "camelCase") return toCamelCase(raw);
  if (modifier === "UPPERCASE") return raw.toUpperCase();
  if (modifier === "Capitalize") return toCapitalizeWords(raw);
  return raw;
};

export const applyTemplateString = (text: string, vars: Record<string, string>): string =>
  text.replace(PLACEHOLDER, (full, name: string, modifier: string | undefined) => {
    const raw = vars[name];
    if (raw === undefined) return full;
    return applyModifier(raw, modifier);
  });

export const sortPathsDeepestFirst = (paths: string[]): string[] =>
  [...paths].sort((a, b) => b.length - a.length);
