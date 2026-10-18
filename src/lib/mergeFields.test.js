import { describe, it, expect } from 'vitest';
import { highlightMergeFields, mergeFieldsIn, splitMergeFields } from './mergeFields';

describe('merge fields', () => {
  it('lists each field once, in order, across subject and body', () => {
    expect(mergeFieldsIn('{{first_name}} at {{company}}', '<p>Hi {{ first_name }}, {{contact_title}}</p>'))
      .toEqual(['first_name', 'company', 'contact_title']);
    expect(mergeFieldsIn('No fields', null)).toEqual([]);
  });

  it('wraps fields in HTML without touching the rest', () => {
    const out = highlightMergeFields('<p>Hi {{first_name}}, from <b>us</b></p>');
    expect(out).toMatch(/^<p>Hi <span class="merge-field [^"]+">\{\{first_name\}\}<\/span>, from <b>us<\/b><\/p>$/);
  });

  it('splits a subject into text and fields', () => {
    expect(splitMergeFields('{{company}} and SRE')).toEqual([{ field: 'company', raw: '{{company}}' }, ' and SRE']);
    expect(splitMergeFields('plain')).toEqual(['plain']);
  });
});
