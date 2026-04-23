import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/db/database';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import { formatDateLong, formatMoney } from '@/lib/format';
import type { Goal } from '@/types';

const GOAL_COLORS = ['#10B981', '#60A5FA', '#A78BFA', '#F59E0B', '#F472B6', '#34D399'];

interface Props {
  onBack?: () => void;
}

export function GoalsPage({ onBack }: Props) {
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  return (
    <>
      <TopBar
        title="Metas"
        subtitle="Tus objetivos de ahorro"
        leading={
          onBack && (
            <button onClick={onBack} className="press text-muted" aria-label="Atrás">
              <Icon name="chevron-left" />
            </button>
          )
        }
        trailing={
          <button
            onClick={() => setAddOpen(true)}
            className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
            aria-label="Nueva meta"
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-3">
        {!goals || goals.length === 0 ? (
          <EmptyState
            title="Sin metas aún"
            description="Crea una meta para ir ahorrando con objetivo."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                Nueva meta
              </Button>
            }
          />
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, Math.round((g.saved / Math.max(g.target, 1)) * 100));
            return (
              <Card key={g.id}>
                <button onClick={() => setEditing(g)} className="press w-full text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: g.color }}
                      />
                      <h3 className="text-sm font-semibold truncate">{g.name}</h3>
                    </div>
                    <span className="text-xs text-muted tabular">{pct}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="tabular text-text">
                      {formatMoney(g.saved)}{' '}
                      <span className="text-muted">de {formatMoney(g.target)}</span>
                    </span>
                    {g.deadline && <span className="text-muted">{formatDateLong(g.deadline)}</span>}
                  </div>
                </button>
              </Card>
            );
          })
        )}
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Nueva meta">
        <GoalForm onClose={() => setAddOpen(false)} />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar meta">
        {editing && <GoalForm goal={editing} onClose={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  const [saved, setSaved] = useState(String(goal?.saved ?? 0));
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[0]);

  async function save() {
    const t = Number(target);
    const s = Number(saved);
    if (!name || !Number.isFinite(t) || t <= 0) return;
    if (goal?.id) {
      await db.goals.update(goal.id, {
        name,
        target: t,
        saved: Number.isFinite(s) ? s : 0,
        deadline: deadline || undefined,
        color,
      });
    } else {
      await db.goals.add({
        name,
        target: t,
        saved: Number.isFinite(s) ? s : 0,
        deadline: deadline || undefined,
        color,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  async function remove() {
    if (!goal?.id) return;
    if (!window.confirm('¿Eliminar esta meta? No se puede deshacer.')) return;
    await db.goals.delete(goal.id);
    onClose();
  }

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Fondo emergencia"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Objetivo (€)"
          type="number"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="5000"
        />
        <Input
          label="Ya ahorrado (€)"
          type="number"
          inputMode="decimal"
          value={saved}
          onChange={(e) => setSaved(e.target.value)}
          placeholder="0"
        />
      </div>
      <Input
        label="Fecha límite (opcional)"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />
      <div>
        <p className="block text-xs text-muted mb-1.5">Color</p>
        <div className="flex gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full press ${color === c ? 'ring-2 ring-text/70' : ''}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} full>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save} full>
          Guardar
        </Button>
      </div>
      {goal?.id && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar meta
        </Button>
      )}
    </div>
  );
}
