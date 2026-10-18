// Merge fields in a template — {{first_name}}, {{ company }} — found and made
// visible. A rendered preview fills them in, so without this they never show.
const FIELD = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

/** Distinct field names used across the given strings, in order of appearance. */
export function mergeFieldsIn(...texts) {
  const seen = new Set();
  for (const text of texts) {
    for (const m of String(text || '').matchAll(FIELD)) seen.add(m[1]);
  }
  return [...seen];
}

export const MERGE_FIELD_CLASS =
  'rounded bg-amber-100 px-1 font-mono text-[0.85em] text-amber-800 ring-1 ring-inset ring-amber-200';

/** Template HTML with each merge field wrapped in a highlighted span. */
export function highlightMergeFields(html) {
  return String(html || '').replace(
    FIELD,
    (match) => `<span class="merge-field ${MERGE_FIELD_CLASS}">${match}</span>`,
  );
}

/** Plain text (a subject line) split into strings and `{ field }` parts. */
export function splitMergeFields(text) {
  const out = [];
  let last = 0;
  for (const m of String(text || '').matchAll(FIELD)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ field: m[1], raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < String(text || '').length) out.push(String(text).slice(last));
  return out;
}
