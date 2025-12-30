import { title } from './primitives';
import ReportsTable from './reports-table';
import UploadReportButton from './upload-report-button';

interface ReportsProps {
  onChange: () => void;
}

export default function Reports({ onChange }: Readonly<ReportsProps>) {
  return (
    <>
      <div className="flex w-full">
        <div className="w-1/3">
          <h1 className={title()}>Reports</h1>
        </div>
        <div className="flex gap-2 w-2/3 flex-wrap justify-end items-center ml-2">
          <UploadReportButton onUploadedReport={onChange} />
        </div>
      </div>
      <br />
      <ReportsTable onChange={onChange} />
    </>
  );
}
