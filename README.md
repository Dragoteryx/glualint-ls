# glualint-ls

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) wrapper around the [`glualint`](https://github.com/FPtje/GLuaFixer) CLI, providing diagnostics and formatting for GLua code.

## Requirements

`glualint-ls` requires `glualint` but does not bundle it, either download the latest version [here](https://github.com/FPtje/GLuaFixer/releases) or build it from scratch.
The language server expects `glualint` to be available in your `PATH`, and won't be able to provide any diagnostics or formatting otherwise.

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
