import { describe, it, expect } from 'vitest';
import { pageNameFromPath } from './FeedbackWidget';

describe('pageNameFromPath', () => {
  it('title-cases route segments and drops ids', () => {
    expect(pageNameFromPath('/dialtone/send-timing')).toBe('Dialtone / Send Timing');
    expect(pageNameFromPath('/companies/3f2a9c1e-1111-2222-3333-444455556666')).toBe('Companies');
    expect(pageNameFromPath('/investors/42')).toBe('Investors');
  });

  it('falls back to Dashboard at the root', () => {
    expect(pageNameFromPath('/')).toBe('Dashboard');
  });
});
