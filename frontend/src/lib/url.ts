export const getApiUrl = (): string => {
	// for API calls during development, we want relative paths so Vite proxy can handle them
	// for prod, this might be different if the frontend and backend are served from different origins
	if (
		typeof globalThis !== "undefined" &&
		(globalThis.location.hostname === "localhost" ||
			globalThis.location.hostname === "127.0.0.1" ||
			globalThis.location.hostname.endsWith(".local") ||
			globalThis.location.port >= "3000")
	) {
		// Catch any local development ports
		return ""; // Return empty string for localhost development - let Vite proxy handle it
	}
	return import.meta.env?.VITE_API_URL || "http://localhost:3001";
};

export const getCurrentPath = (): string => {
	if (typeof globalThis !== "undefined") {
		return globalThis.location.pathname;
	}
	return "/";
};

export const buildUrl = (
	path: string,
	params?: Record<string, string>,
): string => {
	const baseUrl = getApiUrl();

	// for development with empty baseUrl, construct relative URL
	if (!baseUrl) {
		let url = path.startsWith("/") ? path : `/${path}`;

		if (params) {
			const searchParams = new URLSearchParams();
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null && value !== "") {
					searchParams.set(key, value);
				}
			});
			const paramString = searchParams.toString();
			if (paramString) {
				url += url.includes("?") ? `&${paramString}` : `?${paramString}`;
			}
		}

		return url;
	}

	// for prod or when baseUrl is set
	const url = new URL(path, baseUrl);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== "") {
				url.searchParams.set(key, value);
			}
		});
	}
	return url.toString();
};

export const withBase = (path: string): string => {
	if (path.startsWith("http")) {
		return path;
	}

	const baseUrl = getApiUrl();
	// ff baseUrl is empty (development with Vite proxy), just return the path
	if (!baseUrl) {
		return path.startsWith("/") ? path : `/${path}`;
	}

	// clean up trailing slash from baseUrl to avoid double slashes
	const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
	return path.startsWith("/")
		? `${cleanBaseUrl}${path}`
		: `${cleanBaseUrl}/${path}`;
};
