import {
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
	DiagnosticTag,
	TextEdit,
	Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);
let glualintError = false;

connection.onInitialize(() => ({
  capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		documentFormattingProvider: true,
  },
}));

documents.onDidChangeContent(({ document }) => {
	const cwd = dirname(fileURLToPath(document.uri));
	const child = spawn("glualint", ["--stdin"], { cwd });
	child.on("error", sendProcessErrorMessage);
	child.stdin.write(document.getText());
	child.stdin.end();

	let output = "";
	child.stdout.on("data", data => output += data.toString());
	child.stdout.on("end", () => {
		const diagnostics = parseLinterOutput(document, output);
		connection.sendDiagnostics({ uri: document.uri, diagnostics });
	});

	child.on("exit", code => {
		if (code === 0) glualintError = false;
	});
});

connection.onDocumentFormatting(({ textDocument }) => {
	return new Promise(resolve => {
		const document = documents.get(textDocument.uri);
		if (!document) return;

		const cwd = dirname(fileURLToPath(document.uri));
		const child = spawn("glualint", ["--pretty-print"], { cwd });
		child.on("error", sendProcessErrorMessage);
		child.stdin.write(document.getText());
		child.stdin.end();

		let output = "";
		child.stdout.on("data", data => output += data.toString());
		child.stdout.on("end", () => {
			if (!output) return;
			resolve([TextEdit.replace({
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length),
			}, output)]);
		});

		child.on("exit", code => {
			if (code === 0) glualintError = false;
		});
	});
});

function sendProcessErrorMessage(err: Error) {
	if (!glualintError) {
		connection.window.showErrorMessage(`Failed to run glualint: ${err.message}`);
		glualintError = true;
	}
}

function parseLinterOutput(document: TextDocument, output: string): Diagnostic[] {
	const pattern = /^stdin: \[(Warning|Error)\] line (\d+), column (\d+) - line (\d+), column (\d+): (.*)$/;
	const diagnostics: Diagnostic[] = [];
	const text = document.getText();

	for (const line of output.split("\n")) {
		const match = pattern.exec(line.trim());
		if (!match) continue;

		console.log(line);

		const tags: DiagnosticTag[] = [];
		const message = match[6]!;
		const lowerMessage = message.toLowerCase();
		const severity = match[1] == "Warning" ?
			DiagnosticSeverity.Warning
			: DiagnosticSeverity.Error;

		const lineStart = Number(match[2]!) - 1;
		const colStart = Number(match[3]!) - 1;
		const lineEnd = Number(match[4]!) - 1;
		const colEnd = Number(match[5]!) - 1;

		const start: Position = { line: lineStart, character: colStart };
		const end: Position = { line: lineEnd, character: colEnd };

		const startOffset = document.offsetAt(start);
		const matchStart = /\s+(\w*)$/.exec(text.substring(0, startOffset));
		if (matchStart) start.character -= matchStart[1]!.length;

		const endOffset = document.offsetAt(end);
		const matchEnd = /^(\w*)\s+/.exec(text.substring(endOffset));
		if (matchEnd) end.character += matchEnd[1]!.length;

		if (isDeprecation(lowerMessage))
			tags.push(DiagnosticTag.Deprecated)
		if (isUnnecessary(lowerMessage))
			tags.push(DiagnosticTag.Unnecessary)
		if (isTrailingWhitespace(lowerMessage))
			end.character++;

		if (severity) {
			diagnostics.push({
				source: "glualint",
				range: { start, end },
				severity,
				message,
				tags,
			});
		}
	}

  return diagnostics;
}

function isTrailingWhitespace(message: string): boolean {
	return message.includes("trailing whitespace");
}

function isDeprecation(message: string): boolean {
	return message.includes("deprecated");
}

function isUnnecessary(message: string): boolean {
	if (message.includes("unused")) return true;
	if (message.includes("never used")) return true;
	if (message.includes("unreachable")) return true;
	if (message.includes("redundant")) return true;
	if (message.includes("unnecessary")) return true;
	if (message.includes("double negation")) return true;
	return false;
}

documents.listen(connection);
connection.listen();
