/**
 * RulesPage — F6 rules engine UI. Lists rules as code-like `WHEN … THEN …`
 * statements, exposes hit counter, toggle, inline edit and "Test rule" preview.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { previewMatches } from '@/lib/rules';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Btn, Section } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { invalidateRulesCache } from '@/lib/categorize';
import type { Rule } from '@/types';

interface Props {
  onBack: () => void;
  autoOpenNew?: boolean;
}

export function RulesPage({ onBack, autoOpenNew = false }: Props) {
  const rules = useLiveQuery(() =>
    db.rules
      .toArray()
      .then((arr) => arr.sort((a, b) => b.priority - a.priority || (b.hits ?? 0) - (a.hits ?? 0))),
  );
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const txs = useLiveQuery(() => db.transactions.toArray(), []);
  const catById = useMemo(() => {
    const m = new Map<number, string>();
    (categories ?? []).forEach((c) => c.id && m.set(c.id, c.name));
    return m;
  }, [categories]);

  const [addOpen, setAddOpen] = useState(autoOpenNew);
  const [editing, setEditing] = useState<Rule | null>(null);

  useEffect(() => {
    if (autoOpenNew) setAddOpen(true);
  }, [autoOpenNew]);

  const totalHitsThisMonth = useMemo(() => {
    if (!rules) return 0;
    const now = Date.now();
    const month = new Date(now).toISOString().slice(0, 7);
    return rules.filter((r) => {
      if (!r.lastHitAt) return false;
      return new Date(r.lastHitAt).toISOString().slice(0, 7) === month;
    }).length;
  }, [rules]);

  async function toggle(rule: Rule) {
    if (rule.id == null) return;
    const next: 0 | 1 = rule.enabled === 0 ? 1 : 0;
    await db.rules.update(rule.id, { enabled: next });
    invalidateRulesCache();
  }

  async function remove(rule: Rule) {
    if (rule.id == null) return;
    if (!window.confirm(`¿Borrar regla "${rule.pattern}"?`)) return;
    await db.rules.delete(rule.id);
    invalidateRulesCache();
  }

  return (
    <>
      <TopBarV2 title="rules" onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="rules-page">
        <section className="px-3.5 py-4 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
            RULES · {rules?.length ?? 0}
          </div>
          <div className="mt-1 font-mono text-mono10 text-muted">
            {totalHitsThisMonth} reglas activas este mes
          </div>
        </section>

        <Section title="ENGINE">
          <ul className="space-y-2">
            {(rules ?? []).map((r) => {
              const catName = catById.get(r.categoryId) ?? '—';
              const preview = previewMatches(r, txs ?? []);
              const disabled = r.enabled === 0;
              return (
                <li
                  key={r.id}
                  className="border border-border rounded-xs p-2"
                  data-testid={`rule-${r.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <code
                      className={`font-mono text-[11px] leading-snug ${disabled ? 'text-dim' : 'text-text'}`}
                    >
                      <span className="text-dim">WHEN</span> merchant ~{' '}
                      <span className={disabled ? 'text-muted' : 'text-accent'}>
                        /{r.pattern}/i
                      </span>{' '}
                      <span className="text-dim">THEN</span> category ={' '}
                      <span className={disabled ? 'text-muted' : 'text-accent'}>"{catName}"</span>
                    </code>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!disabled}
                      onClick={() => void toggle(r)}
                      data-testid={`rule-toggle-${r.id}`}
                      className={[
                        'w-8 h-4 rounded-full border shrink-0',
                        disabled ? 'bg-transparent border-border' : 'bg-accent border-accent',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'block w-3 h-3 rounded-full bg-bg border border-border transition-transform',
                          disabled ? 'translate-x-[2px]' : 'translate-x-[16px]',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-mono9 text-dim">
                    <span>
                      priority=<span className="text-muted">{r.priority}</span> · hits=
                      <span className="text-muted">{r.hits ?? 0}</span>
                    </span>
                    <span>
                      preview=<span className="text-muted">{preview}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="font-mono text-mono9 text-muted press"
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(r)}
                      className="font-mono text-mono9 text-danger press"
                    >
                      DELETE
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <div className="px-3.5 py-3">
          <Btn variant="solid" block onClick={() => setAddOpen(true)}>
            + NEW_RULE
          </Btn>
        </div>
      </div>

      <RuleSheet open={addOpen} onClose={() => setAddOpen(false)} mode="add" />
      <RuleSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        mode="edit"
        rule={editing ?? undefined}
      />
    </>
  );
}

function RuleSheet({
  open,
  onClose,
  mode,
  rule,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  rule?: Rule;
}) {
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [pattern, setPattern] = useState(rule?.pattern ?? '');
  const [priority, setPriority] = useState(String(rule?.priority ?? 5));
  const [categoryId, setCategoryId] = useState<number | undefined>(rule?.categoryId);

  // Resync when the target rule changes.
  useEffect(() => {
    setPattern(rule?.pattern ?? '');
    setPriority(String(rule?.priority ?? 5));
    setCategoryId(rule?.categoryId);
  }, [rule?.id]);

  async function commit() {
    const p = pattern.trim().toLowerCase();
    const pr = Number(priority);
    if (!p || !categoryId || !Number.isFinite(pr)) return;
    if (mode === 'add') {
      await db.rules.add({ pattern: p, categoryId, priority: pr, enabled: 1, hits: 0 });
    } else if (rule?.id != null) {
      await db.rules.update(rule.id, { pattern: p, categoryId, priority: pr });
    }
    invalidateRulesCache();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'add' ? 'Nueva regla' : 'Editar regla'}>
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">PATTERN</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="mercadona"
            data-testid="rule-pattern-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">PRIORITY</span>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">CATEGORY</span>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(Number(e.target.value) || undefined)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text"
            data-testid="rule-category-select"
          >
            <option value="">—</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Btn variant="solid" block onClick={commit}>
          {mode === 'add' ? 'CREATE' : 'SAVE'}
        </Btn>
      </div>
    </Sheet>
  );
}
