import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Preferences } from '../types/qbittorrent';

vi.mock('../services/directApi', () => ({
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
}));

// The presets card pulls its own TanStack Query hooks; stub it out so this
// test stays focused on the page's back-navigation guard. The stub exposes a
// button that fires onDirtyChange(true) so the presets-dirty path is testable.
vi.mock('../components/LocationPresetsCard', () => ({
  LocationPresetsCard: ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => (
    <button type="button" onClick={() => onDirtyChange?.(true)}>
      mock-mark-presets-dirty
    </button>
  ),
}));

import { Settings } from './Settings';
import { getPreferences } from '../services/directApi';

const basePrefs = {
  dl_limit: 0,
  up_limit: 0,
  save_path: '/downloads',
  add_stopped_enabled: false,
} as Preferences;

describe('Settings back navigation', () => {
  beforeEach(() => {
    vi.mocked(getPreferences).mockReset();
  });

  it('opens the discard sheet instead of leaving when changes are unsaved', async () => {
    vi.mocked(getPreferences).mockResolvedValue(basePrefs);
    const onBack = vi.fn();
    render(<Settings onBack={onBack} />);

    const pathInput = await screen.findByPlaceholderText('/path/to/downloads');
    await userEvent.type(pathInput, '/extra');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Discard unsaved settings?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('leaves immediately when there are no unsaved changes', async () => {
    vi.mocked(getPreferences).mockResolvedValue(basePrefs);
    const onBack = vi.fn();
    render(<Settings onBack={onBack} />);

    await screen.findByPlaceholderText('/path/to/downloads');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the discard sheet when only the presets card is dirty', async () => {
    vi.mocked(getPreferences).mockResolvedValue(basePrefs);
    const onBack = vi.fn();
    render(<Settings onBack={onBack} />);

    await screen.findByPlaceholderText('/path/to/downloads');
    // qB prefs untouched; mark the presets card dirty via the stub.
    await userEvent.click(screen.getByRole('button', { name: 'mock-mark-presets-dirty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Discard unsaved settings?')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });
});
