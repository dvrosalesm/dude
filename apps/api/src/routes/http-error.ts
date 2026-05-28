export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function httpError(message: string, status: number): never {
  throw new HttpError(message, status);
}
