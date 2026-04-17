import { z } from "zod";

export const githubFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  url: z.string(),
  html_url: z.string(),
  git_url: z.string(),
  download_url: z.string().nullable(),
  type: z.enum(["file", "dir"]),
  _links: z.object({
    self: z.string(),
    git: z.string(),
    html: z.string(),
  }),
});
export type GithubFile = z.infer<typeof githubFileSchema>;

export const githubFilesSchema = z.array(githubFileSchema);

export type GithubFiles = z.infer<typeof githubFilesSchema>;
