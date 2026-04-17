import { z } from "zod";

const githubRepoReferenceSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  ref: z.string().optional(),
});

export type GithubRepoReference = z.infer<typeof githubRepoReferenceSchema>;
