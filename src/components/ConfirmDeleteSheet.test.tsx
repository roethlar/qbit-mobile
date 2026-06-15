import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet';

describe('ConfirmDeleteSheet', () => {
  it('disables the confirm actions and ignores clicks while pending', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteSheet
        isOpen
        onClose={() => {}}
        subject="3 torrents"
        count={3}
        pending
        onConfirm={onConfirm}
      />,
    );
    const filesBtn = screen.getByRole('button', { name: /Deleting|Delete torrents and files/ });
    expect((filesBtn as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(filesBtn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onConfirm when not pending', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteSheet
        isOpen
        onClose={() => {}}
        subject="3 torrents"
        count={3}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete torrents and files' }));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });
});
