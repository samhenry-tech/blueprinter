# blueprinter

An example npm package that provides a `blueprinter` CLI written in TypeScript (source in `src/`, build output in `dist/`). You must pass a **subcommand** (for example `run` or `add`).

## Commands

- **`blueprinter run`** — interactive blueprint flow (questions, then generated files)
- **`blueprinter add`** — add a small markdown file in the current directory

## Run locally

From this package folder:

```bash
npm run dev -- run
```

Or with defaults (no prompts):

```bash
npm run dev -- run --yes
```

## Build + run compiled output

```bash
npm run build
npm start -- run
```

## Install / use as a CLI

While developing locally, you can link it:

```bash
npm link
blueprinter
```

## What it generates

- **Node CLI app**: creates a minimal Node CLI project (with its own `package.json` and `bin/cli.js`)
- **README-only**: creates a folder with a `README.md`

