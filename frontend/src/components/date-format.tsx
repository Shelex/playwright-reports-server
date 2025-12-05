"use client";
import { useEffect, useState } from "react";

/**
 * Specific method for date formatting on the client
 * as server locale and client locale may not match
 */
export default function FormattedDate({ date }: Readonly<{ date: Date }>) {
	const [formattedDate, setFormattedDate] = useState("");

	useEffect(() => {
		setFormattedDate(new Date(date).toLocaleString());
	}, [date]);

	return <span>{formattedDate}</span>;
}
