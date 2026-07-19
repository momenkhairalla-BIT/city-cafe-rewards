import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PosLayout } from '../../layouts/PosLayout';
import { AdminLayout } from '../../layouts/AdminLayout';
import { canAccessProduct } from '../../auth/permissions';
import type { EmployeeIdentity } from '../../auth/types';

const staff: EmployeeIdentity = {
  id: '1',
  username: 'staff',
  role: 'staff',
  fullName: 'Staff User',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['b1'],
};

const manager: EmployeeIdentity = {
  id: '2',
  username: 'admin',
  role: 'admin',
  fullName: 'Manager',
  isGlobalManager: true,
  dualRolePosEnabled: false,
  selectedProduct: 'admin',
  assignedBranchIds: [],
};

describe('product separation', () => {
  it('staff cannot access admin product', () => {
    expect(canAccessProduct(staff, 'admin')).toBe(false);
    expect(canAccessProduct(staff, 'pos')).toBe(true);
  });

  it('manager without dual-role cannot access pos', () => {
    expect(canAccessProduct(manager, 'pos')).toBe(false);
    expect(canAccessProduct({ ...manager, selectedProduct: 'pos' }, 'pos')).toBe(false);
  });

  it('PosLayout does not render admin sidebar chrome', () => {
    render(
      <MemoryRouter initialEntries={['/pos']}>
        <Routes>
          <Route element={<PosLayout />}>
            <Route path="/pos" element={<p>POS content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('POS content')).toBeInTheDocument();
    expect(screen.queryByText('Aida Office')).not.toBeInTheDocument();
    expect(document.querySelector('[data-product="pos"]')).toBeInTheDocument();
  });

  it('AdminLayout does not render POS checkout rail', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<p>Admin content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
    expect(screen.getByText('Aida Office')).toBeInTheDocument();
    expect(screen.queryByText('New Sale')).not.toBeInTheDocument();
    expect(document.querySelector('[data-product="admin"]')).toBeInTheDocument();
  });
});
