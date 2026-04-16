import { z } from "zod";

export const blueprintSourceSchema = z.object({
  source: z.string().min(1),
  type: z.enum(["github", "folder"]),
});

export type BlueprintSource = z.infer<typeof blueprintSourceSchema>;

export const blueprintSourceListSchema = z.array(blueprintSourceSchema);

