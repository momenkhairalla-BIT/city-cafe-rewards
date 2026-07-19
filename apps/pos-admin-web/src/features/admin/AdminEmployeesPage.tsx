import { PREVIEW_EMPLOYEES } from '../../preview/fixtures/catalog';
import './admin.css';

export function AdminEmployeesPage() {
  return (
    <section className="admin-page" aria-labelledby="employees-title">
      <header className="admin-page__header">
        <h2 id="employees-title">Employees</h2>
        <p className="form-hint">Roles and branch access — credentials never shown.</p>
      </header>

      <table className="data-table admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Branches</th>
            <th>Global manager</th>
          </tr>
        </thead>
        <tbody>
          {PREVIEW_EMPLOYEES.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{emp.username}</td>
              <td>{emp.role}</td>
              <td>{emp.branches.join(', ')}</td>
              <td>{emp.isGlobalManager ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
