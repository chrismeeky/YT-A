/** Read an SSE stream from a fetch response.
 *  Each `data:` line is JSON with either { message } for progress or { done, result } / { error }.
 *  Calls onProgress for each progress message, resolves with the final result. */
export async function readSSE<T>(
  res: Response,
  onProgress: (message: string) => void,
): Promise<T> {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = JSON.parse(line.slice(6)) as
        | { message: string }
        | { error: string }
        | { done: true; result: T };
      if ('error' in payload) throw new Error(payload.error);
      if ('message' in payload) onProgress(payload.message);
      if ('done' in payload) return payload.result;
    }
  }
  throw new Error('Stream ended without a result');
}

/** Encode and enqueue one SSE data line into a ReadableStream controller. */
export function sseEmit(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  payload: object,
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}
