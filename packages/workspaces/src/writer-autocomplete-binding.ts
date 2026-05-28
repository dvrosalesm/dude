export type WriterAutocompleteRequest = {
  workspaceId: string;
  prefix: string;
  suffix?: string;
  title?: string;
  documentExcerpt?: string;
  signal?: AbortSignal;
};

export type WriterAutocompleteResponse = {
  completion: string;
};

export type WriterAutocompleteFetcher = (
  input: WriterAutocompleteRequest,
) => Promise<WriterAutocompleteResponse>;

export type WriterAutocompleteAvailability = () => boolean;

let fetchWriterAutocompleteImpl: WriterAutocompleteFetcher | null = null;
let canReachWriterAutocompleteImpl: WriterAutocompleteAvailability | null = null;

export function bindWriterAutocomplete(
  fetcher: WriterAutocompleteFetcher,
  availability?: WriterAutocompleteAvailability,
): void {
  fetchWriterAutocompleteImpl = fetcher;
  canReachWriterAutocompleteImpl = availability ?? null;
}

export function canReachWriterAutocomplete(): boolean {
  if (canReachWriterAutocompleteImpl) {
    return canReachWriterAutocompleteImpl();
  }
  return false;
}

export async function fetchWriterAutocomplete(
  input: WriterAutocompleteRequest,
): Promise<WriterAutocompleteResponse> {
  if (!fetchWriterAutocompleteImpl) {
    return { completion: "" };
  }
  return fetchWriterAutocompleteImpl(input);
}
