let configPath: string | null = null;

export function getConfigPath(): string | null {
	return configPath;
}

export function initConfigPath(options: unknown) {
	configPath = fetchConfigPath(options);
}

function fetchConfigPath(options: unknown): string | null {
	if (typeof options !== "object" || options === null) return null;
	const { config } = options as { config: unknown };
	if (typeof config !== "string") return null;
	return config;
}
