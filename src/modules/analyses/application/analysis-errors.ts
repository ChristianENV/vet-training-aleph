export class AnalysisServiceError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 500 | 503,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AnalysisServiceError";
  }
}
