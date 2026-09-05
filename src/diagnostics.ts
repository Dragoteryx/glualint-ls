import { Diagnostic, DiagnosticSeverity, DiagnosticTag, Position } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { spawn } from "node:child_process";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function fetchDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
	return new Promise((resolve, reject) => {
		const cwd = dirname(fileURLToPath(document.uri));
		const child = spawn("glualint", ["--stdin"], { cwd });
		child.on("error", reject);

		let output = "";
		let diagnostics: Diagnostic[] = [];
		child.stdout.on("end", () => diagnostics = parseLinterOutput(document, output));
		child.stdout.on("data", data => output += data.toString());
		child.stdin.write(document.getText());
		child.stdin.end();

		child.on("exit", code => {
			if (code === 0 || code === 1) resolve(diagnostics);
			else reject(new Error(`glualint exited with code ${code}`));
		});
	});
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
	console.log(`- ${fileName}: (${errors.length} ${errorsLabel}, ${warnings.length} ${warningsLabel})`);
}

function logDiagnostics(diagnostics: Diagnostic[]) {
	for (const diagnostic of diagnostics) {
		const { message, range: { start, end } } = diagnostic;
		const severity = diagnostic.severity == DiagnosticSeverity.Error ? "error" : "warning";
		console.log(`[${severity}] ${message} (${start.line}:${start.character}, ${end.line}:${end.character})`);
	}
}
