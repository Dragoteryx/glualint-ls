#!/usr/bin/env node

import { createConnection, LSPErrorCodes, ResponseError, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { initExpectedVersion, validateInstalledVersion } from "./version.js";
import { fetchDiagnostics } from "./diagnostics.js";
import { formatDocument } from "./formatting.js";
import { initConfigPath } from "./config.js";

const connection = createConnection();
const documents = new TextDocuments(TextDocument);
let glualintOk = true;

connection.onInitialize(params => {
	initExpectedVersion(params.initializationOptions);
	initConfigPath(params.initializationOptions);
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
		handleError(err);
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
		handleError(err);
		const message = errorMessage(err);
		throw new ResponseError(LSPErrorCodes.RequestFailed, message);
	}
});

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function handleError(error: unknown) {
	if (glualintOk) {
		const message = errorMessage(error);
		connection.window.showErrorMessage(message);
		connection.console.error(`[error] ${message}`);
		glualintOk = false;
	}
}

documents.listen(connection);
connection.listen();
