import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useLocationPresets = vi.fn();

vi.mock('../hooks/useLocationPresets', () => ({
  useLocationPresets: () => useLocationPresets(),
}));

import { MoveLocationSheet } from './MoveLocationSheet';

describe('MoveLocationSheet', () => {
  beforeEach(() => {
    useLocationPresets.mockReset();
  });

  it('renders subject and current path', () => {
    useLocationPresets.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(
      <MoveLocationSheet
        isOpen
        onClose={() => undefined}
        subject="big.iso"
        currentPath="/mnt/old"
        onSubmit={async () => undefined}
      />,
    );

    expect(screen.getByText('big.iso')).toBeTruthy();
    expect(screen.getByText('/mnt/old')).toBeTruthy();
  });

  it('renders the error banner (not the "no presets configured" hint) on load failure', () => {
    useLocationPresets.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <MoveLocationSheet
        isOpen
        onClose={() => undefined}
        subject="big.iso"
        currentPath="/mnt/old"
        onSubmit={async () => undefined}
      />,
    );

    expect(screen.getByText(/couldn't load preset list/i)).toBeTruthy();
    expect(screen.queryByText(/no presets configured/i)).toBeNull();
  });

  it('tapping a preset fills the path and enables Submit', async () => {
    useLocationPresets.mockReturnValue({
      data: [
        { name: 'Movies', path: '/mnt/movies' },
        { name: 'TV', path: '/mnt/tv' },
      ],
      isLoading: false,
      isError: false,
    });

    render(
      <MoveLocationSheet
        isOpen
        onClose={() => undefined}
        subject="big.iso"
        currentPath="/mnt/old"
        onSubmit={async () => undefined}
      />,
    );

    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: /^move$/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /movies/i }));

    const submitAfter = screen.getByRole('button', { name: /move to \/mnt\/movies/i }) as HTMLButtonElement;
    expect(submitAfter.disabled).toBe(false);
  });

  it('Submit calls onSubmit with the chosen path and closes on success', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isError: false,
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <MoveLocationSheet
        isOpen
        onClose={onClose}
        subject="big.iso"
        currentPath="/mnt/old"
        onSubmit={onSubmit}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /movies/i }));
    await user.click(screen.getByRole('button', { name: /move to \/mnt\/movies/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('/mnt/movies');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('Submit is disabled while the chosen path equals currentPath', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/old' }],
      isLoading: false,
      isError: false,
    });

    render(
      <MoveLocationSheet
        isOpen
        onClose={() => undefined}
        subject="big.iso"
        currentPath="/mnt/old"
        onSubmit={async () => undefined}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /movies/i }));

    const submit = screen.getByRole('button', { name: /^move$/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
