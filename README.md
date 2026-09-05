# glualint-ls

A [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) wrapper around the [`glualint`](https://github.com/FPtje/GLuaFixer) CLI, providing diagnostics and document formatting for GLua / Garry's Mod Lua code.

## Requirements

`glualint-ls` does not bundle `glualint` itself — the `glualint` binary must be installed separately and available on your system `PATH`.

## Installation

```sh
npm install -g glualint-ls
```

This package is primarily intended to be installed and run automatically by the [glualint-zed](https://github.com/Dragoteryx/glualint-zed) Zed extension, but it can also be run standalone as a language server by any LSP-compatible editor.

## Usage

`glualint-ls` communicates over stdio and is meant to be spawned by an editor or IDE, not run interactively:

```sh
glualint-ls --stdio
```

## License

MIT — see [LICENSE](./LICENSE).
