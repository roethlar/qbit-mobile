import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BottomSheet, Header } from './Layout';

// Mirrors AddTorrent: field state lives above the sheet, and the sheet gets
// a fresh onClose on every render.
function TypingSheet({ onClose }: { onClose: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <BottomSheet isOpen onClose={() => onClose(value)}>
      <label htmlFor="field">Field</label>
      <input id="field" value={value} onChange={(e) => setValue(e.target.value)} />
    </BottomSheet>
  );
}

describe('BottomSheet', () => {
  it('keeps focus in a field while typing re-renders the sheet with a new onClose', async () => {
    render(<TypingSheet onClose={() => undefined} />);
    const user = userEvent.setup();
    const field = screen.getByLabelText('Field') as HTMLInputElement;

    await user.type(field, '/mnt/movies');

    expect(field.value).toBe('/mnt/movies');
    expect(document.activeElement).toBe(field);
  });

  it('Escape calls the latest onClose, not the one captured when the sheet opened', async () => {
    const onClose = vi.fn();
    render(<TypingSheet onClose={onClose} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Field'), 'abc');
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledWith('abc');
  });
});

describe('Header', () => {
  it('renders the title', () => {
    render(<Header title="qBit Mobile" />);
    expect(screen.getByRole('heading', { name: 'qBit Mobile' })).toBeTruthy();
  });

  it('renders the version next to the title, with the build id only as a tooltip', () => {
    render(
      <Header
        title="qBit Mobile"
        titleSuffix={<span title={`Build ${__BUILD_ID__}`}>v{__APP_VERSION__}</span>}
      />,
    );
    // Pinned fixtures from vitest.config.ts.
    const el = screen.getByText('v0.0.0-test');
    expect(el).toBeTruthy();
    expect(el.getAttribute('title')).toBe('Build 0.0.0-test+testbuild.2601010000');
  });

  // The visible version must stay clean. The raw fingerprint carries a commit
  // SHA, a build timestamp, and a `-dirty` marker -- none of which belong in a
  // user-facing header.
  it('does not display the raw build id', () => {
    render(
      <Header
        title="qBit Mobile"
        titleSuffix={<span title={`Build ${__BUILD_ID__}`}>v{__APP_VERSION__}</span>}
      />,
    );
    expect(screen.queryByText(/testbuild|\d{10}|-dirty/)).toBeNull();
  });

  it('omits the suffix when none is passed', () => {
    render(<Header title="qBit Mobile" />);
    expect(screen.queryByText(/^v\d/)).toBeNull();
  });
});
