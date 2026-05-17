import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useLocationPresets = vi.fn();
const useUpdateLocationPresets = vi.fn();

vi.mock('../hooks/useLocationPresets', () => ({
  useLocationPresets: () => useLocationPresets(),
  useUpdateLocationPresets: () => useUpdateLocationPresets(),
}));

import { LocationPresetsCard } from './LocationPresetsCard';

interface Mutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
}

function withMutation(opts: Partial<Mutation> = {}): Mutation {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    ...opts,
  };
}

describe('LocationPresetsCard', () => {
  beforeEach(() => {
    useLocationPresets.mockReset();
    useUpdateLocationPresets.mockReset();
  });

  it('renders one input row per server-side preset', () => {
    useLocationPresets.mockReturnValue({
      data: [
        { name: 'Movies', path: '/mnt/movies' },
        { name: 'TV', path: '/mnt/tv' },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    useUpdateLocationPresets.mockReturnValue(withMutation());

    render(<LocationPresetsCard />);

    expect(screen.getAllByLabelText('Preset name')).toHaveLength(2);
    expect(screen.getAllByLabelText('Preset path')).toHaveLength(2);
    expect(screen.getByDisplayValue('Movies')).toBeTruthy();
    expect(screen.getByDisplayValue('/mnt/movies')).toBeTruthy();
  });

  it('Add preset appends a blank row; Remove drops it', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    useUpdateLocationPresets.mockReturnValue(withMutation());

    render(<LocationPresetsCard />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /add preset/i }));
    expect(screen.getAllByLabelText('Preset name')).toHaveLength(2);

    // Remove the first row.
    const removes = screen.getAllByRole('button', { name: /remove preset/i });
    await user.click(removes[0]);
    expect(screen.getAllByLabelText('Preset name')).toHaveLength(1);
  });

  it('Save passes the cleaned list to the update mutation', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    const mutateAsync = vi.fn().mockResolvedValue([
      { name: 'Movies', path: '/mnt/movies' },
      { name: 'TV', path: '/mnt/tv' },
    ]);
    useUpdateLocationPresets.mockReturnValue(withMutation({ mutateAsync }));

    render(<LocationPresetsCard />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /add preset/i }));
    const names = screen.getAllByLabelText('Preset name');
    const paths = screen.getAllByLabelText('Preset path');
    await user.type(names[1], 'TV');
    await user.type(paths[1], '/mnt/tv');

    await user.click(screen.getByRole('button', { name: /save presets/i }));

    expect(mutateAsync).toHaveBeenCalledWith([
      { name: 'Movies', path: '/mnt/movies' },
      { name: 'TV', path: '/mnt/tv' },
    ]);
  });

  it('Save is disabled when the draft matches server data, enabled when dirty', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    useUpdateLocationPresets.mockReturnValue(withMutation());

    render(<LocationPresetsCard />);
    const user = userEvent.setup();

    const save = screen.getByRole('button', { name: /save presets/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const names = screen.getAllByLabelText('Preset name');
    await user.type(names[0], 'X');
    expect(save.disabled).toBe(false);
  });

  it('shows the server-provided error message when mutation rejects', async () => {
    useLocationPresets.mockReturnValue({
      data: [{ name: 'Movies', path: '/mnt/movies' }],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
    // Mimic an axios error shape — handleSave goes through axios.isAxiosError.
    const axiosError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { data: { error: 'Duplicate preset name' } },
    });
    const mutateAsync = vi.fn().mockRejectedValue(axiosError);
    useUpdateLocationPresets.mockReturnValue(withMutation({ mutateAsync }));

    render(<LocationPresetsCard />);
    const user = userEvent.setup();

    // Make the form dirty so Save is enabled.
    await user.type(screen.getAllByLabelText('Preset name')[0], 'X');
    await user.click(screen.getByRole('button', { name: /save presets/i }));

    await waitFor(() => {
      expect(screen.getByText(/duplicate preset name/i)).toBeTruthy();
    });
  });
});
