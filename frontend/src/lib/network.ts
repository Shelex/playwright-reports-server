export const withQueryParams = (
	url: string,
	params: Record<string, string>,
): string => {
	// If URL is already absolute, use it as is
	if (url.startsWith("http")) {
		const urlObj = new URL(url);
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== "") {
				urlObj.searchParams.set(key, value);
			}
		});
		return urlObj.toString();
	}

	// For relative paths in development with Vite proxy, use current origin
	const urlObj = new URL(url, window.location.origin);
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			urlObj.searchParams.set(key, value);
		}
	});
	return urlObj.toString();
};
