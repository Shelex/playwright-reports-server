const defaultProjectName = "default";

export const withQueryParams = (
	url: string,
	params: Record<string, string>,
): string => {
	if (params?.project === defaultProjectName) {
		delete params.project;
	}

	const searchParams = new URLSearchParams(params);
	const stringified = searchParams.toString();

	return `${url}?${stringified}`;
};
