import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sendWindowNotice,
  canPause,
  canResume,
  canStop,
  formatPercent,
  isIcpEmpty,
  normalizeCampaign,
  normalizeCampaignList,
  normalizeIcp,
  normalizeProspect,
  normalizeProspectPage,
  normalizeSettings,
} from './campaigns';

describe('normalizeIcp', () => {
  it('accepts the documented keys', () => {
    expect(
      normalizeIcp({
        industries: ['CNC'],
        company_size: '51-200',
        geographies: ['Germany'],
        titles: ['Plant Manager'],
        value_props: ['Faster quotes'],
      })
    ).toEqual({
      industries: ['CNC'],
      company_size: '51-200',
      geographies: ['Germany'],
      titles: ['Plant Manager'],
      value_props: ['Faster quotes'],
    });
  });

  it('maps naming variants and comma-separated strings', () => {
    const icp = normalizeIcp({
      target_industries: 'CNC, Packaging',
      geography: 'Germany',
      decision_maker_titles: ['COO', ' '],
      value_propositions: ['A'],
    });
    expect(icp.industries).toEqual(['CNC', 'Packaging']);
    expect(icp.geographies).toEqual(['Germany']);
    expect(icp.titles).toEqual(['COO']);
    expect(icp.value_props).toEqual(['A']);
  });

  it('is empty for null', () => {
    expect(isIcpEmpty(null)).toBe(true);
    expect(isIcpEmpty({ titles: ['CEO'] })).toBe(false);
  });
});

describe('normalizeSettings', () => {
  it('fills defaults and clamps the daily limit to 5–100', () => {
    expect(normalizeSettings({})).toMatchObject({ daily_limit: 25, review_before_send: true });
    expect(normalizeSettings({ daily_limit: 500 }).daily_limit).toBe(100);
    expect(normalizeSettings({ daily_send_limit: 2 }).daily_limit).toBe(5);
  });

  it('trims seconds off times so time inputs accept them', () => {
    expect(normalizeSettings({ send_window_start: '08:30:00' }).send_window_start).toBe('08:30');
  });
});

describe('normalizeCampaign', () => {
  it('reads nested metrics and derives the bounce rate when absent', () => {
    const c = normalizeCampaign({
      id: 'c1',
      status: 'active',
      metrics: { total_prospects: 40, emails_sent: 20, replies: 3, bounced: 2 },
    });
    expect(c.metrics).toMatchObject({ total_prospects: 40, emails_sent: 20, replies: 3, bounce_rate: 0.1 });
  });

  it('treats a bounce rate above 1 as a percentage', () => {
    expect(normalizeCampaign({ id: 'c', metrics: { bounce_rate: 4 } }).metrics.bounce_rate).toBe(0.04);
  });

  it('builds documents from bare ids and reads flat settings', () => {
    const c = normalizeCampaign({ id: 'c', document_ids: ['d1'], daily_limit: 40 });
    expect(c.documents).toEqual([{ id: 'd1', filename: null }]);
    expect(c.settings.daily_limit).toBe(40);
    expect(c.name).toBe('Untitled campaign');
  });

  it('normalizes daily activity rows', () => {
    const c = normalizeCampaign({ id: 'c', metrics: { daily: [{ day: '2026-10-01', emails_sent: 5 }] } });
    expect(c.daily).toEqual([{ date: '2026-10-01', sent: 5 }]);
  });

  it('lists from an array or {items}', () => {
    expect(normalizeCampaignList([{ id: 'a' }])).toHaveLength(1);
    expect(normalizeCampaignList({ items: [{ id: 'a' }, { id: 'b' }] })).toHaveLength(2);
    expect(normalizeCampaignList(undefined)).toEqual([]);
  });
});

describe('normalizeProspect', () => {
  it('flattens nested company, contact and email', () => {
    const p = normalizeProspect({
      id: 'p1',
      status: 'draft',
      company: { name: 'Acme', domain: 'acme.com' },
      contact: { first_name: 'Ana', last_name: 'Li', title: 'COO', email: 'ana@acme.com' },
      email: { subject: 'Hi', body: 'Hello' },
    });
    expect(p).toMatchObject({
      company_name: 'Acme',
      company_domain: 'acme.com',
      contact_name: 'Ana Li',
      contact_title: 'COO',
      contact_email: 'ana@acme.com',
      subject: 'Hi',
      body: 'Hello',
    });
  });

  it('defaults status to queued', () => {
    expect(normalizeProspect({ id: 'p' }).status).toBe('queued');
  });

  it('computes pages from a paged response', () => {
    const page = normalizeProspectPage({ items: [{ id: 'p' }], total: 51, page_size: 25 }, 25);
    expect(page.pages).toBe(3);
    expect(normalizeProspectPage([{ id: 'p' }], 25)).toMatchObject({ total: 1, pages: 1 });
  });
});

describe('status helpers', () => {
  it('only allows the transitions that make sense', () => {
    expect(canPause('active')).toBe(true);
    expect(canPause('paused')).toBe(false);
    expect(canResume('paused')).toBe(true);
    expect(canStop('paused')).toBe(true);
    expect(canStop('stopped')).toBe(false);
  });

  it('formats a fraction as a percent', () => {
    expect(formatPercent(0.0345)).toBe('3.5%');
  });
});

describe('sendWindowNotice', () => {
  const base = {
    status: 'active', window_open: false, timezone: 'America/Toronto',
    send_window_opens_at: '2026-10-19T13:00:00Z',
    settings: { send_window_start: '09:00', send_window_end: '18:00', send_on_weekends: false },
    metrics: { queued_to_send: 1 },
  };
  afterEach(() => vi.useRealTimers());

  it('offers weekends only on a weekend', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T17:00:00Z')); // Sunday in Toronto
    expect(sendWindowNotice(base)).toMatchObject({ waiting: 1, canSendWeekends: true });
    vi.setSystemTime(new Date('2026-10-14T23:30:00Z')); // Wednesday evening
    expect(sendWindowNotice(base).canSendWeekends).toBe(false);
  });

  it('is null when nothing waits on the window', () => {
    expect(sendWindowNotice({ ...base, window_open: true })).toBeNull();
    expect(sendWindowNotice({ ...base, status: 'paused' })).toBeNull();
    expect(sendWindowNotice({ ...base, metrics: { queued_to_send: 0 } })).toBeNull();
  });
});
