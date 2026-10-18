import { describe, it, expect } from 'vitest';
import { normalizeCampaign, sizeFromApi, sizeToApi, toCampaignPatch } from './campaigns';
import { addResultMessage } from '../hooks/useCampaigns';

describe('campaign edits use the API field names', () => {
  // PATCH /campaigns ignores unknown keys, so the wizard's { settings } and
  // { icp } were dropped on the floor — review-before-send included.
  it('flattens settings into the fields the API accepts', () => {
    expect(toCampaignPatch({
      settings: {
        daily_limit: 40, send_window_start: '08:00', send_window_end: '16:00',
        send_on_weekends: false, review_before_send: true, sender_account_id: 's1',
      },
    })).toEqual({
      daily_send_limit: 40, send_window_start: '08:00', send_window_end: '16:00',
      send_on_weekends: false, review_before_send: true, sender_account_id: 's1',
    });
  });

  it('writes the ICP as icp_json and keeps fields the wizard does not edit', () => {
    const out = toCampaignPatch({
      icp: { industries: ['SaaS'], company_size: '500+', geographies: ['EU'], titles: ['CTO'], value_props: ['x'] },
      baseIcp: { summary: 's', search_query: 'q', keywords: ['k'], target_industries: ['old'] },
    });
    expect(out).toEqual({
      icp_json: {
        summary: 's', search_query: 'q', keywords: ['k'],
        target_industries: ['SaaS'], target_locations: ['EU'], buyer_titles: ['CTO'],
        value_props: ['x'], company_size: { min: 500, max: null },
      },
    });
  });

  it('passes other fields (status, name) through untouched', () => {
    expect(toCampaignPatch({ status: 'paused', name: 'N' })).toEqual({ status: 'paused', name: 'N' });
  });

  it.each([
    ['51-200', { min: 51, max: 200 }],
    ['1,000 - 5,000', { min: 1000, max: 5000 }],
    ['500+', { min: 500, max: null }],
    ['200', { min: null, max: 200 }],
    ['', { min: null, max: null }],
  ])('reads company size %j', (text, size) => {
    expect(sizeToApi(text)).toEqual(size);
  });

  it.each([
    [{ min: 51, max: 200 }, '51-200'],
    [{ min: 500, max: null }, '500+'],
    [{ min: null, max: 50 }, '1-50'],
    [{ min: null, max: null }, ''],
    ['11-50', '11-50'],
  ])('shows company size %j', (size, text) => {
    expect(sizeFromApi(size)).toBe(text);
  });

  it('reads icp_json, the shape the server returns', () => {
    const c = normalizeCampaign({
      id: 'c1', icp_json: { target_industries: ['A'], target_locations: ['B'], buyer_titles: ['C'], company_size: { min: 1, max: 9 } },
      gmail_account_id: null, smtp_account_id: 's9',
    });
    expect(c.icp).toMatchObject({ industries: ['A'], geographies: ['B'], titles: ['C'], company_size: '1-9' });
    expect(c.settings.sender_account_id).toBe('s9');
  });
});

describe('adding contacts says what happened', () => {
  it('counts what was added and why the rest were skipped', () => {
    expect(addResultMessage({
      queued: 2,
      skipped: [
        { label: 'Already a prospect in a campaign' },
        { label: 'Already a prospect in a campaign' },
        { label: 'No email address' },
      ],
    })).toBe('2 added · 3 skipped (Already a prospect in a campaign; No email address) — verifying with Hunter before anything is sent');
  });

  it('a no-op add is not dressed up as progress', () => {
    expect(addResultMessage({ queued: 0, skipped: [{ label: 'No email address' }] }))
      .toBe('0 added · 1 skipped (No email address)');
  });
});
