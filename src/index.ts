#!/usr/bin/env node

import { createConnection, LSPErrorCodes, ResponseError, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { initExpectedVersion, validateInstalledVersion } from "./version.js";
import { fetchDiagnostics } from "./diagnostics.js";
import { formatDocument } from "./formatting.js";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);
let glualintOk = true;

connection.onInitialize(params => {
	initExpectedVersion(params.initializationOptions);
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			documentFormattingProvider: true,
		}
	};
});

documents.onDidChangeContent(async ({ document }) => {
	try {
		await validateInstalledVersion();
		const diagnostics = await fetchDiagnostics(document);
		glualintOk = true;
		connection.sendDiagnostics({ uri: document.uri, diagnostics });
	} catch (err) {
		handleError("Failed to run glualint", err);
	}
});

connection.onDocumentFormatting(async ({ textDocument }) => {
	const document = documents.get(textDocument.uri);
	if (!document) return null;

	try {
		await validateInstalledVersion();
		const edits = await formatDocument(document);
		glualintOk = true;
		return edits;
	} catch (err) {
		handleError("Failed to format document", err);
		throw new ResponseError(LSPErrorCodes.RequestFailed, causeMessage(err));
	}
});

function causeMessage(cause: unknown) {
	return cause instanceof Error ? cause.message : String(cause);
}

function handleError(message: string, cause: unknown) {
	if (glualintOk) {
		connection.window.showErrorMessage(`${message}: ${causeMessage(cause)}`);
		glualintOk = false;
	}
}

documents.listen(connection);
connection.listen();
