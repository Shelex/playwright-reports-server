import { title } from './primitives';
import ReportsTable from './reports-table';

interface ReportsProps {
  onChange: () => void;
}

export default function Reports({ onChange }: Readonly<ReportsProps>) {
  return (
    <>
      <div className="flex flex-row justify-between">
        <h1 className={title()}>Reports</h1>
      </div>
      <br />
      <ReportsTable onChange={onChange} />
    </>
  );
}
