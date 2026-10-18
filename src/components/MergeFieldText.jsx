import { MERGE_FIELD_CLASS, mergeFieldsIn, splitMergeFields } from '../lib/mergeFields';

// A subject line (plain text) with its merge fields highlighted.
export function MergeFieldText({ text, className }) {
  return (
    <span className={className}>
      {splitMergeFields(text).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={i} className={MERGE_FIELD_CLASS} data-merge-field>
            {part.raw}
          </span>
        ),
      )}
    </span>
  );
}

// "Merge fields: first_name company" — every variable the template fills in.
export function MergeFieldList({ subject, body, className = '' }) {
  const fields = mergeFieldsIn(subject, body);
  if (!fields.length) {
    return (
      <p className={`text-xs text-gray-500 ${className}`} data-testid="merge-fields">
        No merge fields — every recipient gets the same wording.
      </p>
    );
  }
  return (
    <p className={`flex flex-wrap items-center gap-1 text-xs text-gray-500 ${className}`} data-testid="merge-fields">
      <span>Merge fields:</span>
      {fields.map((f) => (
        <span key={f} className={MERGE_FIELD_CLASS}>{`{{${f}}}`}</span>
      ))}
    </p>
  );
}
