import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Layout';

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
