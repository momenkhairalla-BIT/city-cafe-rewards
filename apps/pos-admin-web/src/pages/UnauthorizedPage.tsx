import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div className="shell-unauthorized">
      <section className="shell-card" aria-labelledby="unauthorized-title">
        <h2 id="unauthorized-title">Unauthorized</h2>
        <p>You do not have access to this employee product surface.</p>
        <p>
          <Link to="/employee">Return to employee welcome</Link>
        </p>
      </section>
    </div>
  );
}
