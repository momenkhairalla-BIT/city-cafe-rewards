import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UiPreviewBanner } from './UiPreviewBanner';

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: vi.fn(),
  UI_PREVIEW_LABEL: 'UI PREVIEW — SAMPLE DATA',
}));

import { isUiPreviewMode } from '../../preview/uiPreviewMode';

describe('UiPreviewBanner', () => {
  it('shows banner when preview mode is on', () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(true);
    render(<UiPreviewBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('UI PREVIEW — SAMPLE DATA');
  });

  it('renders nothing when preview mode is off', () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(false);
    const { container } = render(<UiPreviewBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
