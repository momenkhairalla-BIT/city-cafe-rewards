import { adminPageTitle } from './adminNav';

interface Props {
  module?: string;
}

export function PreviewPlaceholderPage({ module }: Props) {
  const title = module ?? 'Module';

  return (
    <section className="admin-page" aria-labelledby="placeholder-title">
      <header className="admin-page__header">
        <h2 id="placeholder-title">{title}</h2>
        <p className="form-hint">High-fidelity shell — API integration pending.</p>
      </header>
      <div className="admin-placeholder">
        <p>This destination is reserved for a future release. Sample navigation only.</p>
      </div>
    </section>
  );
}

export function previewTitleFromPath(pathname: string): string {
  return adminPageTitle(pathname);
}
