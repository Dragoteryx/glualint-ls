import { spawn } from "node:child_process";
import { Octokit } from "octokit";

const octokit = new Octokit();
const defaultVersion = "1.29.0";
const pattern = /^\d+\.\d+\.\d+$/;
let expected: string;

export async function initExpectedVersion(options: unknown) {
	const version = await fetchExpectedVersion(options);
	if (!pattern.test(version)) {
		throw new Error(`invalid glualint version \`${version}\`, expected format is \`x.y.z\``);
	} else {
		expected = version;
	}
}

export function logExpectedVersion() {
	console.log(`[info] expected glualint version is \`${expected}\``);
}

async function fetchExpectedVersion(options: unknown): Promise<string> {
	const version = readExpectedVersion(options);
	return (version == "latest" ? await fetchLatestVersion() : version)
		|| defaultVersion;
}

function readExpectedVersion(options: unknown): string | undefined {
	if (typeof options !== "object" || options === null) return;
	const { version } = options as { version: unknown };
	if (typeof version !== "string") return;
	return version;
}

async function fetchLatestVersion(): Promise<string> {
	try {
		const params = { owner: "FPtje", repo: "GLuaFixer" };
		console.log("[info] expected version set to `latest`, fetching from github");
		const { data } = await octokit.rest.repos.getLatestRelease(params);
		console.log(`[info] latest glualint version is \`${data.tag_name}\``);
		return data.tag_name;
	} catch {
		throw new Error("failed to fetch latest glualint version from GitHub");
	}
}

export async function validateInstalledVersion() {
	const installed = await fetchInstalledVersion();
	if (expected != installed) {
		throw new Error(`glualint version mismatch: expected \`${expected}\`, but found \`${installed}\``);
	}
}

function fetchInstalledVersion(): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("glualint", ["--version"]);
		child.on("error", reject);

		let output = "";
		child.stdout.on("data", data => output += data.toString());
		child.stdout.on("end", () => {
			const version = output.trim();
			if (version) resolve(version);
			else reject(new Error("glualint version not found"));
		});
	});
}
