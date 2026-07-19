import { useEffect, useState } from 'react';
import type { UiConceptModifierGroup } from '../../preview/fixtures/catalog';
import { formatRmFromSen } from '../../shared/formatting/money';

interface Props {
  open: boolean;
  itemName: string;
  basePriceSen: number;
  groups: UiConceptModifierGroup[];
  onConfirm: (selections: Record<string, string[]>, unitPriceSen: number, summary: string) => void;
  onClose: () => void;
}

export function ModifierSheet({ open, itemName, basePriceSen, groups, onConfirm, onClose }: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string[]> = {};
      for (const g of groups) {
        if (g.required && g.options[0]) {
          initial[g.id] = [g.options[0].id];
        } else {
          initial[g.id] = [];
        }
      }
      setSelections(initial);
    }
  }, [open, groups]);

  if (!open) return null;

  function toggleOption(group: UiConceptModifierGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.max === 1) {
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function computePrice(): number {
    let total = basePriceSen;
    for (const g of groups) {
      const ids = selections[g.id] || [];
      for (const opt of g.options) {
        if (ids.includes(opt.id)) total += opt.priceDeltaSen;
      }
    }
    return total;
  }

  function buildSummary(): string {
    const parts: string[] = [];
    for (const g of groups) {
      const ids = selections[g.id] || [];
      const labels = g.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
      if (labels.length) parts.push(`${g.name}: ${labels.join(', ')}`);
    }
    return parts.join(' · ');
  }

  function handleConfirm() {
    onConfirm(selections, computePrice(), buildSummary());
  }

  const price = computePrice();

  return (
    <div className="modifier-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        className="modifier-sheet"
        role="dialog"
        aria-labelledby="modifier-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modifier-sheet__header">
          <h2 id="modifier-sheet-title">{itemName}</h2>
          <p className="form-hint modifier-sheet__contract">
            UI concept — modifier contract pending
          </p>
        </header>

        <div className="modifier-sheet__body">
          {groups.map((group) => (
            <fieldset key={group.id} className="modifier-group">
              <legend>{group.name}{group.required ? ' *' : ''}</legend>
              <div className="modifier-group__options">
                {group.options.map((opt) => {
                  const checked = (selections[group.id] || []).includes(opt.id);
                  return (
                    <label key={opt.id} className={`modifier-option ${checked ? 'modifier-option--selected' : ''}`}>
                      <input
                        type={group.max === 1 ? 'radio' : 'checkbox'}
                        name={group.id}
                        checked={checked}
                        onChange={() => toggleOption(group, opt.id)}
                      />
                      <span>{opt.label}</span>
                      {opt.priceDeltaSen !== 0 && (
                        <span className="modifier-option__price">
                          {opt.priceDeltaSen > 0 ? '+' : ''}{formatRmFromSen(opt.priceDeltaSen)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <footer className="modifier-sheet__footer">
          <p className="modifier-sheet__total">Total: {formatRmFromSen(price)}</p>
          <div className="modifier-sheet__actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>Add to order</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
