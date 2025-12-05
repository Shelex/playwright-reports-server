"use client";

import { HeroUIProvider } from "@heroui/system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";
import { type FC, useState } from "react";

export const Providers: FC<ThemeProviderProps> = ({
	children,
	...themeProps
}) => {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 5 * 60 * 1000, // 5 minutes
					},
				},
			}),
	);

	return (
		<HeroUIProvider>
			<NextThemesProvider
				{...themeProps}
				attribute="class"
				// additional mapping to handle theme names from playwright trace view
				value={{
					"light-mode": "light",
					"dark-mode": "dark",
				}}
			>
				<QueryClientProvider client={queryClient}>
					{children}
					<ReactQueryDevtools initialIsOpen={false} />
				</QueryClientProvider>
			</NextThemesProvider>
		</HeroUIProvider>
	);
};
