import { createConnection, TextDocuments, TextDocumentSyncKind, TextEdit, Position } from "vscode-languageserver/node";
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { basename, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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
	const unexpectedPattern = /^unexpected "(.*)"/;
	const diagnostics: Diagnostic[] = [];

	for (const line of output.split("\n")) {
		const match = pattern.exec(line.trim());
		if (!match) continue;

		const message = match[6]!;
		const lowerMessage = message.toLowerCase();
		const lineStart = Number(match[2]!) - 1;
		const colStart = Number(match[3]!) - 1;
		const lineEnd = Number(match[4]!) - 1;
		const colEnd = Number(match[5]!) - 1;
		const severity = match[1] == "Warning" ?
			DiagnosticSeverity.Warning
			: DiagnosticSeverity.Error;

		const start: Position = { line: lineStart, character: colStart };
		const end: Position = { line: lineEnd, character: colEnd };

		if (identicalPositions(start, end)) {
			const unexpectedMatch = unexpectedPattern.exec(message);
			if (unexpectedMatch) end.character += unexpectedMatch[1]!.length;
		}

		const tags: DiagnosticTag[] = [];
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

	const fileName = basename(fileURLToPath(document.uri));
	const errors = diagnostics.filter(d => d.severity == DiagnosticSeverity.Error);
	const warnings = diagnostics.filter(d => d.severity == DiagnosticSeverity.Warning);

	logFileHeader(fileName, errors, warnings);
	logDiagnostics(errors);
	logDiagnostics(warnings);

  return diagnostics;
}

function identicalPositions(start: Position, end: Position): boolean {
	return start.line == end.line && start.character == end.character;
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

function logFileHeader(fileName: string, errors: Diagnostic[], warnings: Diagnostic[]) {
	const errorsLabel = errors.length == 1 ? "error" : "errors";
	const warningsLabel = warnings.length == 1 ? "warning" : "warnings";
	connection.console.log(`- ${fileName}: (${errors.length} ${errorsLabel}, ${warnings.length} ${warningsLabel})`);
}

function logDiagnostics(diagnostics: Diagnostic[]) {
	for (const diagnostic of diagnostics) {
		const { message, range: { start, end } } = diagnostic;
		const severity = diagnostic.severity == DiagnosticSeverity.Error ? "error" : "warning";
		connection.console.log(`[${severity}] ${message} (${start.line}:${start.character}, ${end.line}:${end.character})`);
	}
}

documents.listen(connection);
connection.listen();
