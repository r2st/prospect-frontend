import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';
import { THEME_KEY, applyTheme, getThemePreference, resolveTheme } from '../lib/theme';

function mockOsDark(dark) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: q.includes('dark') ? dark : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockOsDark(false);
});

describe('theme preference', () => {
  it('defaults to system, which follows the OS', () => {
    expect(getThemePreference()).toBe('system');
    mockOsDark(true);
    expect(resolveTheme()).toBe('dark');
    mockOsDark(false);
    expect(resolveTheme()).toBe('light');
  });

  it('ignores junk in storage', () => {
    localStorage.setItem(THEME_KEY, 'neon');
    expect(getThemePreference()).toBe('system');
  });

  it('applies a stored dark preference as the dark class', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(applyTheme()).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});

describe('ThemeToggle', () => {
  it('offers System, Light and Dark with System selected by default', () => {
    render(<ThemeToggle />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['System theme', 'Light theme', 'Dark theme']);
    expect(screen.getByRole('radio', { name: 'System theme' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to dark, persists it, and back to system clears it', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');

    await userEvent.click(screen.getByRole('radio', { name: 'System theme' }));
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('keeps two toggles on the page in step', async () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle variant="onDark" />
      </>
    );
    await userEvent.click(screen.getAllByRole('radio', { name: 'Dark theme' })[0]);
    for (const r of screen.getAllByRole('radio', { name: 'Dark theme' })) {
      expect(r).toHaveAttribute('aria-checked', 'true');
    }
  });
});
