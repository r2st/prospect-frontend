import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Logo, { BRAND_ACCENT } from './Logo';
import { DoAideBadge, DoAideFooter } from './DoAideBrand';

describe('DoAide branding', () => {
  it('draws the shared robot mark in Pulse teal, with the DoAide | Prospect wordmark', () => {
    const { container } = render(<Logo />);
    expect(screen.getByRole('img', { name: 'DoAide Prospect' })).toBeInTheDocument();
    expect(container.querySelector('rect[width="22"]')).toHaveAttribute('fill', BRAND_ACCENT);
    expect(container).toHaveTextContent('DoAide | Prospect');
    expect(screen.getByText('Prospect').tagName).toBe('EM');
  });

  it('draws the eyes light so they show against the teal face', () => {
    const { container } = render(<Logo />);
    const eyes = container.querySelectorAll('[data-part="eye"]');
    expect(eyes).toHaveLength(2);
    for (const eye of eyes) expect(eye).toHaveAttribute('fill', '#FFFFFF');
  });

  it('links the "A DoAide Product" badge to doaide.com', () => {
    render(<DoAideBadge />);
    const badge = screen.getByRole('link', { name: 'A DoAide Product' });
    expect(badge).toHaveAttribute('href', 'https://doaide.com');
    expect(badge).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lists the sibling products, marks Prospect as current, and carries the badge and copyright', () => {
    render(<DoAideFooter />);
    const nav = within(screen.getByRole('navigation', { name: 'DoAide products' }));
    expect(nav.getByRole('link', { name: 'Pulse' })).toHaveAttribute('href', 'https://pulse.doaide.com');
    expect(nav.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', 'https://job.doaide.com');
    expect(nav.queryByRole('link', { name: 'Prospect' })).not.toBeInTheDocument();
    expect(nav.getByText('Prospect')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'A DoAide Product' })).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} DoAide`)).toBeInTheDocument();
  });
});
