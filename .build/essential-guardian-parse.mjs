// Guardian's article text states the survey sample explicitly; no chart floor
// or inferred value may substitute for it.
export function guardianMetadataOf(html) {
  const publishedAt = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || null;
  const text = html.match(/\bof\s+([\d,]+)\s+people\s+taken\b/i)?.[1];
  const sample = text ? Number(text.replace(/,/g, "")) : null;
  return { publishedAt, sample: Number.isFinite(sample) && sample > 0 ? sample : null };
}
