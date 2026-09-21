/** MySQL TEXT is 65,535 bytes. Stay under that so a large bridge payload cannot 500 the request. */
export const MYSQL_TEXT_SAFE_BYTES = 60_000;

export function utf8ByteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export function clipUtf8(value: string, maxBytes: number) {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(value) <= maxBytes) return value;

  let end = Math.min(value.length, maxBytes);
  let slice = value.slice(0, end);
  while (utf8ByteLength(slice) > maxBytes && end > 0) {
    end = Math.max(0, end - 64);
    slice = value.slice(0, end);
  }
  return slice;
}

export function fitMysqlJson(value: unknown, maxBytes = MYSQL_TEXT_SAFE_BYTES): string {
  let json: string;
  try {
    json = JSON.stringify(value ?? null) ?? "null";
  } catch {
    json = JSON.stringify({ clipped: true, reason: "unserializable" });
  }

  if (utf8ByteLength(json) <= maxBytes) return json;

  const envelope = (preview: string) =>
    JSON.stringify({
      clipped: true,
      originalBytes: utf8ByteLength(json),
      preview,
    });

  let preview = clipUtf8(json, Math.max(0, maxBytes - utf8ByteLength(envelope(""))));
  let packed = envelope(preview);
  while (utf8ByteLength(packed) > maxBytes && preview.length > 0) {
    preview = preview.slice(0, Math.max(0, preview.length - 128));
    packed = envelope(preview);
  }

  if (utf8ByteLength(packed) <= maxBytes) return packed;
  return JSON.stringify({ clipped: true, originalBytes: utf8ByteLength(json) });
}

export function fitMysqlTextColumn(value: string, maxBytes = MYSQL_TEXT_SAFE_BYTES) {
  if (utf8ByteLength(value) <= maxBytes) return value;
  return fitMysqlJson({ clipped: true, preview: value }, maxBytes);
}
