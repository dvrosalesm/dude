const CRLF = Buffer.from("\r\n");
const HEADER_SEPARATOR = Buffer.from("\r\n\r\n");

export type MultipartFilePart = {
  fieldName: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  size: number;
};

export type MultipartFileDiagnostics = {
  contentType: string;
  contentLength: string | null;
  expectedFieldName: string | null;
  boundary: string | null;
  bodyContainsBoundary: boolean | null;
  bodyContainsExpectedFieldName: boolean | null;
  bodyPrefixPreview: string | null;
  formDataFileCount: number;
  formDataError: string | null;
  fallbackBodySize: number | null;
  fallbackAllFileCount: number;
  fallbackAllFieldNames: string[];
  fallbackAllFileNames: string[];
  fallbackFileCount: number;
  fallbackFieldNames: string[];
  fallbackFileNames: string[];
};

export type MultipartFileLookup = {
  file: MultipartFilePart | null;
  diagnostics: MultipartFileDiagnostics;
};

function splitBuffer(buffer: Buffer, delimiter: Buffer) {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function trimLeadingCrlf(buffer: Buffer) {
  return buffer.subarray(
    buffer.subarray(0, CRLF.length).equals(CRLF) ? CRLF.length : 0,
  );
}

function trimTrailingCrlf(buffer: Buffer) {
  return buffer.subarray(
    0,
    buffer.subarray(-CRLF.length).equals(CRLF) ? -CRLF.length : buffer.length,
  );
}

function getBoundary(contentType: string) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || "").trim();
}

function getSafeBodyPreview(body: Buffer, maxLength = 200) {
  return body
    .subarray(0, maxLength)
    .toString("utf8")
    .replace(/[^\x20-\x7E\r\n\t]/g, "?");
}

function decodeDispositionValue(value: string) {
  const normalized = value.trim().replace(/^"(.*)"$/, "$1");

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function getDispositionValue(disposition: string, key: "name" | "filename") {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, "i"));
  if (match?.[1] != null) {
    return decodeDispositionValue(match[1]);
  }

  if (key === "filename") {
    const extendedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (extendedMatch?.[1]) {
      return decodeDispositionValue(extendedMatch[1]);
    }
  }

  return null;
}

function parseMultipartFilesFromBody(
  body: Buffer,
  contentType: string,
  fieldName?: string,
) {
  const boundary = getBoundary(contentType);
  if (!boundary) {
    return [];
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, delimiter);
  const files: MultipartFilePart[] = [];

  for (const rawPart of rawParts.slice(1)) {
    let part = trimLeadingCrlf(rawPart);
    if (!part.length || part.subarray(0, 2).equals(Buffer.from("--"))) {
      continue;
    }

    const headerEnd = part.indexOf(HEADER_SEPARATOR);
    if (headerEnd === -1) {
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const headers = new Map<string, string>();

    for (const line of headerText.split("\r\n")) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }

      const name = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      headers.set(name, value);
    }

    const disposition = headers.get("content-disposition") || "";
    const currentFieldName = getDispositionValue(disposition, "name");
    const fileName = getDispositionValue(disposition, "filename");

    if (!currentFieldName || !fileName) {
      continue;
    }

    if (fieldName && currentFieldName !== fieldName) {
      continue;
    }

    part = trimTrailingCrlf(part.subarray(headerEnd + HEADER_SEPARATOR.length));
    files.push({
      fieldName: currentFieldName,
      fileName,
      contentType: headers.get("content-type") || "application/octet-stream",
      buffer: part,
      size: part.length,
    });
  }

  return files;
}

async function getFilesFromFormData(
  request: Request,
  fieldName?: string,
): Promise<{ files: MultipartFilePart[]; error: string | null }> {
  try {
    const formData = await request.formData();
    const entries = fieldName
      ? formData.getAll(fieldName).map((value) => [fieldName, value] as const)
      : Array.from(formData.entries());
    const files = await Promise.all(
      entries
        .filter((entry): entry is readonly [string, File] => entry[1] instanceof File)
        .map(async ([currentFieldName, file]) => ({
          fieldName: currentFieldName,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          buffer: Buffer.from(await file.arrayBuffer()),
          size: file.size,
        })),
    );

    return {
      files: files.filter((file) => file.fileName || file.size > 0),
      error: null,
    };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error.message : "unknown_formdata_error",
    };
  }
}

export async function getMultipartFileWithDiagnostics(
  request: Request,
  fieldName = "file",
): Promise<MultipartFileLookup> {
  const contentType = request.headers.get("content-type") || "";
  const diagnostics: MultipartFileDiagnostics = {
    contentType,
    contentLength: request.headers.get("content-length"),
    expectedFieldName: fieldName,
    boundary: getBoundary(contentType) || null,
    bodyContainsBoundary: null,
    bodyContainsExpectedFieldName: null,
    bodyPrefixPreview: null,
    formDataFileCount: 0,
    formDataError: null,
    fallbackBodySize: null,
    fallbackAllFileCount: 0,
    fallbackAllFieldNames: [],
    fallbackAllFileNames: [],
    fallbackFileCount: 0,
    fallbackFieldNames: [],
    fallbackFileNames: [],
  };

  if (!contentType.includes("multipart/form-data")) {
    return { file: null, diagnostics };
  }

  const fallbackRequest = request.clone();
  const { files: formDataFiles, error: formDataError } = await getFilesFromFormData(
    request,
    fieldName,
  );
  diagnostics.formDataFileCount = formDataFiles.length;
  diagnostics.formDataError = formDataError;

  if (formDataFiles.length > 0) {
    return { file: formDataFiles[0] ?? null, diagnostics };
  }

  const body = Buffer.from(await fallbackRequest.arrayBuffer());
  diagnostics.fallbackBodySize = body.length;
  diagnostics.bodyPrefixPreview = getSafeBodyPreview(body);
  diagnostics.bodyContainsBoundary = diagnostics.boundary
    ? body.includes(Buffer.from(`--${diagnostics.boundary}`))
    : null;
  diagnostics.bodyContainsExpectedFieldName = body.includes(
    Buffer.from(`name="${fieldName}"`),
  );

  const fallbackAllFiles = parseMultipartFilesFromBody(body, contentType);
  diagnostics.fallbackAllFileCount = fallbackAllFiles.length;
  diagnostics.fallbackAllFieldNames = Array.from(
    new Set(fallbackAllFiles.map((file) => file.fieldName)),
  );
  diagnostics.fallbackAllFileNames = fallbackAllFiles.map((file) => file.fileName);

  const fallbackFiles = fallbackAllFiles.filter((file) => file.fieldName === fieldName);
  diagnostics.fallbackFileCount = fallbackFiles.length;
  diagnostics.fallbackFieldNames = Array.from(
    new Set(fallbackFiles.map((file) => file.fieldName)),
  );
  diagnostics.fallbackFileNames = fallbackFiles.map((file) => file.fileName);

  return { file: fallbackFiles[0] ?? null, diagnostics };
}

export async function getMultipartFiles(request: Request, fieldName?: string) {
  const lookup = await getMultipartFileWithDiagnostics(
    request,
    fieldName || "file",
  );
  return lookup.file ? [lookup.file] : [];
}

export async function getMultipartFile(request: Request, fieldName = "file") {
  const { file } = await getMultipartFileWithDiagnostics(request, fieldName);
  return file;
}
