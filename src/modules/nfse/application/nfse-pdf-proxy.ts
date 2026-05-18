export type NfsePdfFetchResult = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
};

export async function fetchNfsePdfStream(pdfUrl: string): Promise<NfsePdfFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(pdfUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`nfse_pdf_fetch_failed_${response.status}`);
    }
    return {
      body: response.body,
      contentType: response.headers.get("content-type") ?? "application/pdf"
    };
  } finally {
    clearTimeout(timeout);
  }
}
