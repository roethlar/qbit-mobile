import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useLocationPresets = vi.fn();

vi.mock('../hooks/useLocationPresets', () => ({
  useLocationPresets: () => useLocationPresets(),
}));

import { AddTorrent } from './AddTorrent';

const noop = async () => undefined;
const MAGNET = 'magnet:?xt=urn:btih:abc';

function renderSheet(onAddUrl: (url: string, options?: unknown) => Promise<void> = noop) {
  return render(
    <AddTorrent isOpen onClose={() => undefined} onAddUrl={onAddUrl} onAddFile={noop} />,
  );
}

// Text entry uses fireEvent.change rather than user.type: BottomSheet refocuses
// its container whenever the sheet re-renders with a new onClose identity
// (Layout.tsx), which drops every keystroke after the first. Tracked as a
// separate finding; switch back to user.type once it is fixed.
function setValue(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

describe('AddTorrent save path presets', () => {
  beforeEach(() => {
    useLocationPresets.mockReset();
  });

  it('renders the save path field alone when no presets are configured', () => {
    useLocationPresets.mockReturnValue({ data: [], isLoading: false, isError: false });

    renderSheet();

    expect(screen.getByLabelText(/save path/i)).toBeTruthy();
    expect(screen.queryByText(/loading presets/i)).toBeNull();
    expect(screen.queryByText(/couldn't load preset list/i)).toBeNull();
  });

  it('tapping a preset fills the save path and sends it with the add request', async () => {
    useLocationPresets.mockReturnValue({
      data: [
        { name: 'Movies', path: '/mnt/movies' },
        { name: 'TV', path: '/mnt/tv' },
      ],
      isLoading: false,
      isError: false,
    });
    const onAddUrl = vi.fn().mockResolvedValue(undefined);

    renderSheet(onAddUrl);

    const user = userEvent.setup();
    const savepath = screen.getByLabelText(/save path/i) as HTMLInputElement;
    expect(savepath.value).toBe('');

    await user.click(screen.getByRole('button', { name: /movies/i }));
    expect(savepath.value).toBe('/mnt/movies');

    setValue(screen.getByLabelText(/torrent url or magnet link/i), MAGNET);
    await user.click(screen.getByRole('button', { name: /^add torrent$/i }));

    await waitFor(() => {
      expect(onAddUrl).toHaveBeenCalledWith(
        MAGNET,
        expect.objectContaining({ savepath: '/mnt/movies' }),
      );
    });
  });

  it('keeps the save path editable after a preset is picked', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isError: false,
    });
    const onAddUrl = vi.fn().mockResolvedValue(undefined);

    renderSheet(onAddUrl);

    const user = userEvent.setup();
    const savepath = screen.getByLabelText(/save path/i) as HTMLInputElement;

    await user.click(screen.getByRole('button', { name: /movies/i }));
    setValue(savepath, '/mnt/movies/2024');
    expect(savepath.value).toBe('/mnt/movies/2024');

    setValue(screen.getByLabelText(/torrent url or magnet link/i), MAGNET);
    await user.click(screen.getByRole('button', { name: /^add torrent$/i }));

    await waitFor(() => {
      expect(onAddUrl).toHaveBeenCalledWith(
        MAGNET,
        expect.objectContaining({ savepath: '/mnt/movies/2024' }),
      );
    });
  });
});
