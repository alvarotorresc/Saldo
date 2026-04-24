/**
 * GoalsPage — F10 rewrite (ScrGoals). Hero total ahorrado + lista de goals
 * con Ring 46px, nombre/deadline/progreso y €/mes necesarios
 * (goalProgress). CRUD vía sheet.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { formatMoney } from '@/lib/format';
import { goalProgress } from '@/lib/goals';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/primitives';
import { Ring } from '@/ui/charts';
import { Sheet } from '@/ui/Sheet';
import type { Goal } from '@/types';

interface Props {
  onBack: () => void;
  autoOpenNew?: boolean;
}

const PALETTE = ['#10B981', '#60A5FA', '#A78BFA', '#F472B6', '#F59E0B', '#FB7185', '#34D399'];

export function GoalsPage({ onBack, autoOpenNew = false }: Props) {
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const [addOpen, setAddOpen] = useState(autoOpenNew);
  const [editing, setEditing] = useState<Goal | null>(null);

  useEffect(() => {
    if (autoOpenNew) setAddOpen(true);
  }, [autoOpenNew]);

  const { totalSaved, totalTarget } = useMemo(() => {
    let s = 0;
    let t = 0;
    for (const g of goals ?? []) {
      s += Math.max(0, g.saved);
      t += Math.max(0, g.target);
    }
    return { totalSaved: s, totalTarget: t };
  }, [goals]);

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub={`GOALS · ${goals?.length ?? 0}`}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Nuevo goal"
            className="press text-accent"
            data-testid="goal-add-btn"
          >
            <Icon name="plus" size={14} />
          </button>
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="goals-page">
        <section className="px-3.5 py-3.5 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">TOTAL_SAVED</div>
          <div className="font-mono text-[26px] tabular text-accent mt-1">
            {formatMoney(totalSaved)}
            {totalTarget > 0 && (
              <span className="text-dim text-[14px] ml-2">/ {formatMoney(totalTarget)}</span>
            )}
          </div>
        </section>

        {(goals ?? []).map((g) => {
          const p = goalProgress(g);
          return (
            <section
              key={g.id}
              className="px-3.5 py-3.5 border-b border-border"
              data-testid={`goal-${g.id}`}
            >
              <div className="flex items-center gap-3">
                <Ring
                  size={46}
                  stroke={4}
                  value={p.pct * 100}
                  max={100}
                  color={g.color}
                  track="var(--color-surface)"
                >
                  <span className="font-mono text-[10px]" style={{ color: g.color }}>
                    {Math.round(p.pct * 100)}
                  </span>
                </Ring>
                <button
                  type="button"
                  onClick={() => setEditing(g)}
                  className="flex-1 min-w-0 text-left press"
                >
                  <div className="font-mono text-mono12 text-text truncate">{g.name}</div>
                  <div className="font-mono text-mono9 text-dim mt-0.5">
                    {g.deadline ? `target ${g.deadline} · ` : ''}
                    <span className="text-text">{formatMoney(g.saved)}</span> /{' '}
                    {formatMoney(g.target)}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  {p.monthlyNeeded > 0 && (
                    <>
                      <div className="font-mono text-mono11 text-accent">
                        +{formatMoney(p.monthlyNeeded)}/mo
                      </div>
                      <div className="font-mono text-mono9 text-dim mt-0.5">para llegar</div>
                    </>
                  )}
                  {p.monthlyNeeded === 0 && p.remaining === 0 && (
                    <span className="font-mono text-mono9 text-accent">completado</span>
                  )}
                </div>
              </div>
              <div className="mt-2.5 h-[2px] bg-surface overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${Math.min(100, p.pct * 100)}%`, background: g.color }}
                />
              </div>
            </section>
          );
        })}

        {(goals ?? []).length === 0 && (
          <div className="px-3.5 py-6 font-mono text-mono10 text-dim text-center">
            Sin metas todavía. Crea la primera con +.
          </div>
        )}
      </div>

      <GoalEditor open={addOpen} onClose={() => setAddOpen(false)} mode="create" />
      {editing && (
        <GoalEditor open={!!editing} onClose={() => setEditing(null)} mode="edit" goal={editing} />
      )}
    </>
  );
}

function GoalEditor({
  open,
  onClose,
  mode,
  goal,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  goal?: Goal;
}) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  const [saved, setSaved] = useState(String(goal?.saved ?? '0'));
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [color, setColor] = useState(goal?.color ?? PALETTE[0]);

  useEffect(() => {
    setName(goal?.name ?? '');
    setTarget(String(goal?.target ?? ''));
    setSaved(String(goal?.saved ?? '0'));
    setDeadline(goal?.deadline ?? '');
    setColor(goal?.color ?? PALETTE[0]);
  }, [goal?.id]);

  async function commit() {
    const n = name.trim();
    const t = Number(target);
    const s = Number(saved);
    if (!n || !Number.isFinite(t) || t <= 0 || !Number.isFinite(s) || s < 0) return;
    if (mode === 'create') {
      await db.goals.add({
        name: n,
        target: t,
        saved: s,
        deadline: deadline || undefined,
        color,
        createdAt: Date.now(),
      });
    } else if (goal?.id) {
      await db.goals.update(goal.id, {
        name: n,
        target: t,
        saved: s,
        deadline: deadline || undefined,
        color,
      });
    }
    onClose();
  }

  async function remove() {
    if (!goal?.id) return;
    if (!window.confirm(`¿Borrar goal "${goal.name}"?`)) return;
    await db.goals.delete(goal.id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'create' ? 'Nueva meta' : 'Editar meta'}>
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="goal-name-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">TARGET · €</span>
            <input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">SAVED · €</span>
            <input
              type="number"
              inputMode="decimal"
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">DEADLINE</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">COLOR</span>
          <div className="mt-1 flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={[
                  'w-7 h-7 rounded-xs border',
                  color === c ? 'border-accent' : 'border-border',
                ].join(' ')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="solid" block onClick={commit} disabled={!name.trim() || !target}>
            {mode === 'create' ? 'CREATE' : 'SAVE'}
          </Btn>
          {mode === 'edit' && (
            <Btn variant="danger" onClick={remove}>
              DELETE
            </Btn>
          )}
        </div>
      </div>
    </Sheet>
  );
}
