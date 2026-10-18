import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SenderLine from './SenderLine';

describe('SenderLine', () => {
  it('names the mailbox a draft goes out from, with its kind', () => {
    render(<SenderLine sender={{ email: 'me@sender.io', display_name: 'Subhendu Das', kind: 'gmail', ready: true }} />);
    expect(screen.getByTestId('sender-line')).toHaveTextContent(/From\s*Subhendu Das <me@sender.io>\s*Gmail/);
    expect(screen.queryByText(/This mailbox is/)).not.toBeInTheDocument();
  });

  it('warns when the mailbox cannot send right now', () => {
    render(<SenderLine sender={{ email: 'out@mailer.io', kind: 'smtp', ready: false, problem: 'disconnected' }} />);
    expect(screen.getByText('SMTP')).toBeInTheDocument();
    expect(screen.getByText(/This mailbox is disconnected/)).toBeInTheDocument();
  });

  it('shows the address a sent email actually went from, over the current sender', () => {
    render(<SenderLine sender={{ email: 'new@sender.io', kind: 'gmail', ready: true }} sentFrom="old@sender.io" />);
    expect(screen.getByTestId('sender-line')).toHaveTextContent(/Sent from\s*old@sender.io/);
    expect(screen.queryByText(/new@sender.io/)).not.toBeInTheDocument();
  });

  it('says so when the campaign has no sending account', () => {
    render(<SenderLine sender={null} />);
    expect(screen.getByText('No sending account is set for this campaign.')).toBeInTheDocument();
  });
});
