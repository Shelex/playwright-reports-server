import { z } from 'zod';

export const UUIDSchema = z.uuid();

export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

export const ReportMetadataSchema = z.looseObject({
  project: z.string().optional(),
  title: z.string().optional(),
  playwrightVersion: z.string().optional(),
  testRun: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const ReportHistorySchema = z.looseObject({
  reportID: UUIDSchema,
  project: z.string(),
  title: z.string().optional(),
  createdAt: z.string(),
  reportUrl: z.string(),
  size: z.string().optional(),
  sizeBytes: z.number(),
  stats: z
    .object({
      total: z.number(),
      expected: z.number(),
      unexpected: z.number(),
      flaky: z.number(),
      skipped: z.number(),
      ok: z.boolean(),
    })
    .optional(),
});

export const ResultDetailsSchema = z.looseObject({
  resultID: UUIDSchema,
  project: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string(),
  size: z.string().optional(),
  sizeBytes: z.number(),
  playwrightVersion: z.string().optional(),
  testRun: z.string().optional(),
  shardCurrent: z.number().optional(),
  shardTotal: z.number().optional(),
  triggerReportGeneration: z.coerce.boolean().optional(),
});

export const GenerateReportRequestSchema = z.object({
  resultsIds: z.array(z.string()).min(1),
  project: z.string().optional(),
  playwrightVersion: z.string().optional(),
  title: z.string().optional(),
});

export const GenerateReportResponseSchema = z.object({
  reportId: z.string(),
  reportUrl: z.string(),
  metadata: ReportMetadataSchema,
});

export const ListReportsQuerySchema = z.object({
  project: z.string().default(''),
  search: z.string().default(''),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const ListReportsResponseSchema = z.object({
  reports: z.array(ReportHistorySchema),
  total: z.number(),
});

export const DeleteReportsRequestSchema = z.object({
  reportsIds: z.array(z.string()).min(1),
});

export const DeleteReportsResponseSchema = z.object({
  message: z.string(),
  reportsIds: z.array(z.string()),
});

export const ListResultsQuerySchema = z.object({
  project: z.string().default(''),
  search: z.string().default(''),
  tags: z.string().optional(), // comma-separated
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const ListResultsResponseSchema = z.object({
  results: z.array(ResultDetailsSchema),
  total: z.number(),
});

export const DeleteResultsRequestSchema = z.object({
  resultsIds: z.array(z.string()).min(1),
});

export const DeleteResultsResponseSchema = z.object({
  message: z.string(),
  resultsIds: z.array(z.string()),
});

export const GetReportParamsSchema = z.object({
  id: z.string(),
});

export const GetReportResponseSchema = ReportHistorySchema;

export const UploadResultResponseSchema = z.object({
  message: z.string(),
  data: z.object({
    resultID: UUIDSchema,
    generatedReport: GenerateReportResponseSchema.optional().nullable(),
    testRun: z.string().optional(),
  }),
});

export const ServerInfoSchema = z.object({
  dataFolderSizeinMB: z.string(),
  numOfResults: z.number(),
  resultsFolderSizeinMB: z.string(),
  numOfReports: z.number(),
  reportsFolderSizeinMB: z.string(),
});

export const ConfigSchema = z.looseObject({
  siteName: z.string().optional(),
  logoUrl: z.string().optional(),
  theme: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;
export type GenerateReportResponse = z.infer<typeof GenerateReportResponseSchema>;
export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;
export type ListReportsResponse = z.infer<typeof ListReportsResponseSchema>;
export type DeleteReportsRequest = z.infer<typeof DeleteReportsRequestSchema>;
export type DeleteReportsResponse = z.infer<typeof DeleteReportsResponseSchema>;
export type ListResultsQuery = z.infer<typeof ListResultsQuerySchema>;
export type ListResultsResponse = z.infer<typeof ListResultsResponseSchema>;
export type DeleteResultsRequest = z.infer<typeof DeleteResultsRequestSchema>;
export type DeleteResultsResponse = z.infer<typeof DeleteResultsResponseSchema>;
export type GetReportParams = z.infer<typeof GetReportParamsSchema>;
export type GetReportResponse = z.infer<typeof GetReportResponseSchema>;
export type UploadResultResponse = z.infer<typeof UploadResultResponseSchema>;
export type ServerInfo = z.infer<typeof ServerInfoSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ReportMetadata = z.infer<typeof ReportMetadataSchema>;
export type ReportHistory = z.infer<typeof ReportHistorySchema>;
export type ResultDetails = z.infer<typeof ResultDetailsSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
