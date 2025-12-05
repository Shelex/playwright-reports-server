import PageLayout from "../components/page-layout";
import Results from "../components/results";

export default function ResultsPage() {
	return (
		<PageLayout render={({ onUpdate }) => <Results onChange={onUpdate} />} />
	);
}
