import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Layout';

describe('Header', () => {
  it('renders the title', () => {
    render(<Header title="qBit Mobile" />);
    expect(screen.getByRole('heading', { name: 'qBit Mobile' })).toBeTruthy();
  });

  it('renders the build id next to the title', () => {
    render(<Header title="qBit Mobile" titleSuffix={<span>v{__BUILD_ID__}</span>} />);
    // The pinned fixture from vitest.config.ts. The real one carries a build
    // timestamp, which is what makes each build distinguishable in the UI.
    expect(screen.getByText('v0.0.0-test+testbuild.2601010000')).toBeTruthy();
  });

  it('omits the suffix when none is passed', () => {
    render(<Header title="qBit Mobile" />);
    expect(screen.queryByText(/^v\d/)).toBeNull();
  });
});
