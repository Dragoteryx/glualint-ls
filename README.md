# glualint-ls

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) wrapper around the [`glualint`](https://github.com/FPtje/GLuaFixer) CLI, providing diagnostics and document formatting for GLua code.

## Requirements

`glualint-ls` does not bundle `glualint` itself — the `glualint` binary must be installed separately and available on your system `PATH`.

## Installation

`glualint-ls` is available on [npm](https://www.npmjs.com/package/glualint-ls) and can be installed globally using the package manager of your choice.

### Using npm

```sh
npm install -g glualint-ls
```

### Using pnpm

```sh
pnpm add -g glualint-ls
```

## Usage

`glualint-ls` communicates over stdio and is meant to be spawned by an editor or IDE, not run interactively:

```sh
glualint-ls --stdio
```
