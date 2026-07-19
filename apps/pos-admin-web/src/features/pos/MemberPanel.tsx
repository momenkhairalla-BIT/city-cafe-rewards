import { useState } from 'react';
import { PREVIEW_MEMBERS, type PreviewMember } from '../../preview/fixtures/catalog';
import { EmptyState } from '../../shared/components/EmptyState';

interface Props {
  member: PreviewMember | null;
  onSelectMember: (member: PreviewMember | null) => void;
}

export function MemberPanel({ member, onSelectMember }: Props) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const results = query.trim()
    ? PREVIEW_MEMBERS.filter((m) =>
        m.displayName.toLowerCase().includes(query.toLowerCase())
        || m.id.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  function handleSelect(m: PreviewMember) {
    if (!m.active) {
      setError('Member account is inactive. Use guest sale or contact support.');
      return;
    }
    setError('');
    onSelectMember(m);
    setQuery('');
  }

  return (
    <section className="member-panel" aria-labelledby="member-panel-title">
      <h3 id="member-panel-title">Member / Rewards</h3>
      <p className="form-hint">Scan or search preview members. No purchase history export.</p>

      <label htmlFor="member-search" className="visually-hidden">Search member</label>
      <input
        id="member-search"
        type="search"
        placeholder="Search by name or ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {query.trim() && results.length > 0 && (
        <ul className="member-search-results" role="listbox">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" role="option" onClick={() => handleSelect(m)}>
                {m.displayName} · {m.kind}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {member ? (
        <div className="member-card">
          <h4>{member.displayName}</h4>
          <p><span className="status-pill status-pill--info">{member.kind}</span></p>
          <dl className="member-stats">
            <div><dt>Points</dt><dd>{member.points}</dd></div>
            <div><dt>Stamps</dt><dd>{member.stamps} / {member.stampGoal}</dd></div>
            {member.eligibleOffer && (
              <div><dt>Offer</dt><dd>{member.eligibleOffer}</dd></div>
            )}
            {member.availableReward && (
              <div>
                <dt>Reward</dt>
                <dd>{member.availableReward}{member.rewardExpiry ? ` (exp ${member.rewardExpiry})` : ''}</dd>
              </div>
            )}
          </dl>
          <button type="button" className="btn-secondary" onClick={() => onSelectMember(null)}>
            Clear member
          </button>
          <p className="form-hint">Staff redeem only — no member directory export.</p>
        </div>
      ) : (
        <EmptyState
          title="Guest sale"
          description="No member attached. Search to link rewards."
        />
      )}

      <button type="button" className="btn-secondary member-guest-btn" onClick={() => onSelectMember(null)}>
        Continue as guest
      </button>
    </section>
  );
}
