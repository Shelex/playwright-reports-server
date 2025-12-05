import PageLayout from '../components/page-layout';
import Reports from '../components/reports';

export default function ReportsPage() {
  return <PageLayout render={({ onUpdate }) => <Reports onChange={onUpdate} />} />;
}
