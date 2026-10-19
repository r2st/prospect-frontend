import { describe, it, expect } from 'vitest';
import {
  heroNav,
  primaryNav,
  settingsNav,
  platformNav,
  activeTab,
  isGroupActive,
  isActivePath,
} from './navigation';

const groups = [heroNav, ...primaryNav, settingsNav, platformNav];
const owner = (path) => groups.find((g) => isGroupActive(path, g))?.key;

describe('navigation', () => {
  it('keeps the sidebar to the hero plus a handful of areas', () => {
    expect(primaryNav.length).toBeLessThanOrEqual(6);
  });

  it('gives every route exactly one owning area', () => {
    const paths = groups.flatMap((g) => g.tabs.map((t) => t.href));
    for (const path of paths) {
      expect(groups.filter((g) => isGroupActive(path, g)).map((g) => g.key)).toHaveLength(1);
    }
  });

  it('lights the hero on campaign detail and wizard routes', () => {
    expect(owner('/campaigns/abc')).toBe('autopilot');
    expect(owner('/campaigns/new')).toBe('autopilot');
    expect(owner('/dialtone')).toBe('autopilot');
  });

  it('files moved config pages under Settings, and replies under Inbox', () => {
    expect(owner('/dialtone/senders')).toBe('settings');
    expect(owner('/deliverability/domains')).toBe('settings');
    expect(owner('/settings/team')).toBe('settings');
    expect(owner('/dialtone/inbox')).toBe('inbox');
  });

  it('matches by path segment, not by string prefix', () => {
    expect(isActivePath('/clients/1', '/clients')).toBe(true);
    expect(isActivePath('/client-dashboard', '/clients')).toBe(false);
    expect(activeTab('/companies/42', primaryNav.find((g) => g.key === 'prospects')).name).toBe('Companies');
  });

  it('keeps platform organization detail under Platform', () => {
    expect(owner('/platform/organizations/9')).toBe('platform');
  });
});
