import { spawn } from "node:child_process";

const DEFAULT_VERSION = "1.29.0";
let expected: string;

export function initExpectedVersion(options: unknown) {
	expected = fetchExpectedVersion(options);
}

function fetchExpectedVersion(options: unknown): string {
	if (typeof options !== "object" || options === null) return DEFAULT_VERSION;
	const { version } = options as { version: unknown };
	if (typeof version !== "string") return DEFAULT_VERSION;
	return version;
}

export async function validateInstalledVersion() {
	const installed = await installedVersion();
	if (expected != installed) {
		throw new Error(`glualint version mismatch: expected \`${expected}\`, but found \`${installed}\``);
	}
}

function installedVersion(): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("glualint", ["--version"]);
		child.on("error", reject);

		let output = "";
		child.stdout.on("data", data => output += data.toString());
		child.stdout.on("end", () => {
			const version = output.trim();
			if (!version) reject(new Error("glualint version not found"));
			else resolve(version);
		});
	});
}
