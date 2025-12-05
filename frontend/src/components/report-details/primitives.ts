export const title = () => "text-2xl font-bold text-gray-900";

export const text = (variant: "sm" | "base" | "lg" = "base") => {
	const baseClasses = "text-gray-600";
	switch (variant) {
		case "sm":
			return `${baseClasses} text-sm`;
		case "lg":
			return `${baseClasses} text-lg`;
		default:
			return baseClasses;
	}
};

export const badge = (
	variant: "success" | "error" | "warning" | "default" = "default",
) => {
	const baseClasses = "px-2 py-1 rounded text-xs font-medium";
	switch (variant) {
		case "success":
			return `${baseClasses} bg-green-100 text-green-800`;
		case "error":
			return `${baseClasses} bg-red-100 text-red-800`;
		case "warning":
			return `${baseClasses} bg-yellow-100 text-yellow-800`;
		default:
			return `${baseClasses} bg-gray-100 text-gray-800`;
	}
};

export const subtitle = () => "text-sm text-gray-500 font-medium";
