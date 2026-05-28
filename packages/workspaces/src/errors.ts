export class LocalWorkspaceApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LocalWorkspaceApiError";
    this.status = status;
  }
}
