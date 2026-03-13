export type StepKey =
  | 'ingest'
  | 'translate'
  | 'create'
  | 'curate'
  | 'format'
  | 'download'
  | 'done'
  | 'error'

export type StepState = {
  key: StepKey
  label: string
  status: 'pending' | 'in-progress' | 'success' | 'error'
  message?: string
}

export const stepsMap: Record<StepKey, string> = {
  ingest: 'Ingest document',
  translate: 'Translate',
  create: 'Generate QA pairs',
  curate: 'Curate QA pairs',
  format: 'Format dataset',
  download: 'Download ready',
  done: 'Done',
  error: 'Error',
}
