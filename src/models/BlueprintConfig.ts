import { z } from "zod";

export const blueprintConfigItemSchema = z.object({
  variableName: z.string().min(1),
  question: z.string().min(1),
});

export type BlueprintConfigItem = z.infer<typeof blueprintConfigItemSchema>;

export const blueprintConfigSchema = z.object({
  items: z.array(blueprintConfigItemSchema),
});

export type BlueprintConfig = z.infer<typeof blueprintConfigSchema>;