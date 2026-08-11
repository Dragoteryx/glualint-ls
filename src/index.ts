import {
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
	DiagnosticTag,
	TextEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { spawn } from "node:child_process";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({
  capabilities: {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		documentFormattingProvider: true,
  },
}));

documents.onDidChangeContent(({ document }) => {
	const child = spawn("glualint", ["--stdin"]);
	child.stdin.write(document.getText());
	child.stdin.end();

	let output = "";
	child.stdout.on("data", data => output += data.toString());
	child.stdout.on("end", () => {
		const diagnostics = parseLinterOutput(output);
		connection.sendDiagnostics({ uri: document.uri, diagnostics });
	});
});

connection.onDocumentFormatting(({ textDocument }) => {
	return new Promise(resolve => {
		const document = documents.get(textDocument.uri);
		if (!document) return;

		const child = spawn("glualint", ["--pretty-print"]);
		child.stdin.write(document.getText());
		child.stdin.end();

		let output = "";
		child.stdout.on("data", data => output += data.toString());
		child.stdout.on("end", () => {
			resolve([TextEdit.replace({
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length),
			}, output)]);
		});
	});
});

function parseLinterOutput(output: string): Diagnostic[] {
	const pattern = /^stdin: \[(Warning|Error)\] line (\d+), column (\d+) - line (\d+), column (\d+): (.*)$/;
	const diagnostics: Diagnostic[] = [];

	for (const line of output.split("\n")) {
		const match = pattern.exec(line.trim());
		if (!match) continue;

		console.log(line);

		const tags: DiagnosticTag[] = [];
		const message = match[6]!;
		const lineStart = Number(match[2]!) - 1;
		const colStart = Number(match[3]!) - 1;
    const lineEnd = Number(match[4]!) - 1;
    let colEnd = Number(match[5]!) - 1;
		const severity = match[1] == "Warning" ?
			DiagnosticSeverity.Warning
			: DiagnosticSeverity.Error;

		const lowerMessage = message.toLowerCase();
		colEnd = adjustColEnd(lowerMessage, colStart, colEnd);
		if (colStart == colEnd) colEnd++;

		if (isDeprecation(lowerMessage))
			tags.push(DiagnosticTag.Deprecated)
		if (isUnnecessary(lowerMessage))
			tags.push(DiagnosticTag.Unnecessary)

		if (severity) {
			diagnostics.push({
				source: "glualint",
				severity,
				message,
				tags,
				range: {
					start: { line: lineStart, character: colStart },
					end: { line: lineEnd, character: colEnd },
				},
			});
		}
	}

  return diagnostics;
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

function adjustColEnd(message: string, colStart: number, colEnd: number): number {
	const match = /^(?:\w|\s)+ "(.+)"/gm.exec(message);
	if (match) {
		return colStart + match[1]!.length;
	} else if (message.includes("trailing whitespace")) {
		return colEnd + 1;
	} else {
		return colEnd;
	}
}

documents.listen(connection);
connection.listen();
