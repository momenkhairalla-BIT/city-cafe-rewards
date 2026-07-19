import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CounterWorkspace } from './CounterWorkspace';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import { MemberPanel } from './MemberPanel';

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: vi.fn(() => true),
  UI_PREVIEW_LABEL: 'UI PREVIEW — SAMPLE DATA',
}));

const employee: EmployeeIdentity = {
  id: 'e1',
  username: 'nadia',
  role: 'staff',
  fullName: 'Nadia',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['b1'],
};

const location: TerminalLocation = {
  terminalId: 't1',
  terminalCode: 'MC-T01',
  branchId: 'b1',
  branchCode: 'MAIN',
  salesPointId: 'sp1',
  salesPointCode: 'COUNTER',
};

const shift: ShiftSummary = {
  id: 's1',
  status: 'open',
  terminalId: 't1',
  salesPointId: 'sp1',
  branchId: 'b1',
  staffUserId: 'e1',
  openingFloat: 100,
  closingExpectedCash: null,
  closingActualCash: null,
  cashVariance: null,
  openedAt: '2026-07-19T08:00:00+08:00',
};

describe('CounterWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders New Sale rail and menu item', () => {
    render(
      <CounterWorkspace
        employee={employee}
        location={location}
        shift={shift}
        onLock={() => {}}
        onCloseRequest={() => {}}
        onLogout={() => {}}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'POS navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new sale/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salted caramel latte/i })).toBeInTheDocument();
  });

  it('shows product label Aida Counter in context via workspace brand', () => {
    render(
      <CounterWorkspace
        employee={employee}
        location={location}
        shift={shift}
        onLock={() => {}}
        onCloseRequest={() => {}}
        onLogout={() => {}}
      />,
    );
    expect(screen.getByText('Aida')).toBeInTheDocument();
  });
});

describe('MemberPanel', () => {
  it('does not show unrestricted purchase history export', () => {
    render(<MemberPanel member={null} onSelectMember={() => {}} />);
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/no purchase history export/i)).toBeInTheDocument();
  });

  it('shows inactive member error on select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MemberPanel member={null} onSelectMember={onSelect} />);
    await user.type(screen.getByPlaceholderText(/search by name/i), 'Inactive');
    await user.click(screen.getByRole('option', { name: /inactive member/i }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/inactive/i);
  });
});
