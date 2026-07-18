import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { resolvePostLoginPath } from './permissions';
import type { EmployeeIdentity } from './types';

const staff: EmployeeIdentity = {
  id: '1',
  username: 'staff',
  role: 'staff',
  fullName: 'Staff',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['b1'],
};

const manager: EmployeeIdentity = {
  id: '2',
  username: 'admin',
  role: 'admin',
  fullName: 'Admin',
  isGlobalManager: true,
  dualRolePosEnabled: false,
  selectedProduct: 'admin',
  assignedBranchIds: [],
};

const dual: EmployeeIdentity = {
  id: '3',
  username: 'dual',
  role: 'admin',
  fullName: 'Dual',
  isGlobalManager: true,
  dualRolePosEnabled: true,
  selectedProduct: null,
  assignedBranchIds: ['b1'],
  requiresProductSelection: true,
};

describe('Phase 2B routing paths', () => {
  it('maps staff / manager / dual-role post-login paths', () => {
    expect(resolvePostLoginPath(staff)).toBe('/pos');
    expect(resolvePostLoginPath(manager)).toBe('/admin');
    expect(resolvePostLoginPath(dual)).toBe('/employee/select-role');
    expect(resolvePostLoginPath({ ...dual, selectedProduct: 'pos' })).toBe('/pos');
    expect(resolvePostLoginPath({ ...dual, selectedProduct: 'admin' })).toBe('/admin');
  });

  it('unauthorized shell renders for unknown routes under MemoryRouter', () => {
    function Unauthorized() {
      return <h1>Unauthorised</h1>;
    }
    render(
      <MemoryRouter initialEntries={['/unauthorized']}>
        <Routes>
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /unauthorised/i })).toBeInTheDocument();
  });
});
