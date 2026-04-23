import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input, Select } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { invalidateRulesCache } from '@/lib/categorize';
import type { Category, CategoryGroup } from '@/types';

interface Props {
  onBack: () => void;
}

const PALETTE = [
  '#10B981',
  '#60A5FA',
  '#A78BFA',
  '#F472B6',
  '#F59E0B',
  '#FB7185',
  '#34D399',
  '#FBBF24',
  '#818CF8',
  '#F87171',
  '#22D3EE',
  '#C084FC',
  '#EC4899',
  '#84CC16',
  '#8A8A93',
];

export function CategoriesPage({ onBack }: Props) {
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [editingCat, setEditingCat] = useState<Category | 'new' | null>(null);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | 'new' | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<number | 'none', Category[]>();
    for (const c of categories ?? []) {
      const k = c.groupId ?? 'none';
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return map;
  }, [categories]);

  const orderedGroups = useMemo(() => {
    return [...(groups ?? [])].sort((a, b) => a.order - b.order);
  }, [groups]);

  return (
    <>
      <TopBar
        title="Categorías"
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
        trailing={
          <button
            onClick={() => setEditingCat('new')}
            className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
            aria-label="Nueva categoría"
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        <Card padded={false}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Grupos</h3>
            <button
              onClick={() => setEditingGroup('new')}
              className="press text-xs text-muted flex items-center gap-1"
            >
              <Icon name="plus" size={14} /> Nuevo grupo
            </button>
          </div>
          <ul className="divide-y divide-border">
            {orderedGroups.map((g) => (
              <li key={g.id} className="px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => setEditingGroup(g)}
                  className="press flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: g.color }}
                  />
                  <span className="text-sm truncate">{g.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-dim">
                    {g.kind === 'income' ? 'ingreso' : 'gasto'}
                  </span>
                </button>
                <span className="text-xs text-muted">{(grouped.get(g.id ?? -1) ?? []).length}</span>
              </li>
            ))}
          </ul>
        </Card>

        {orderedGroups.map((g) => {
          const cats = grouped.get(g.id ?? -1) ?? [];
          if (cats.length === 0) return null;
          return (
            <div key={g.id}>
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                <h4 className="text-[11px] uppercase tracking-wider text-muted">{g.name}</h4>
              </div>
              <Card padded={false}>
                <ul className="divide-y divide-border">
                  {cats.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setEditingCat(c)}
                        className="press w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <span
                          className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-semibold"
                          style={{ background: c.color + '22', color: c.color }}
                        >
                          {c.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="text-sm flex-1 truncate">{c.name}</span>
                        <Icon name="chevron-right" size={16} className="text-dim" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          );
        })}

        {(grouped.get('none') ?? []).length > 0 && (
          <div>
            <div className="px-1 mb-2">
              <h4 className="text-[11px] uppercase tracking-wider text-muted">Sin grupo</h4>
            </div>
            <Card padded={false}>
              <ul className="divide-y divide-border">
                {(grouped.get('none') ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setEditingCat(c)}
                      className="press w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-semibold"
                        style={{ background: c.color + '22', color: c.color }}
                      >
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-sm flex-1 truncate">{c.name}</span>
                      <Icon name="chevron-right" size={16} className="text-dim" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      <Sheet
        open={!!editingCat}
        onClose={() => setEditingCat(null)}
        title={editingCat === 'new' ? 'Nueva categoría' : 'Editar categoría'}
      >
        {editingCat && (
          <CategoryForm
            cat={editingCat === 'new' ? undefined : editingCat}
            groups={groups ?? []}
            categories={categories ?? []}
            onClose={() => setEditingCat(null)}
          />
        )}
      </Sheet>

      <Sheet
        open={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        title={editingGroup === 'new' ? 'Nuevo grupo' : 'Editar grupo'}
      >
        {editingGroup && (
          <GroupForm
            group={editingGroup === 'new' ? undefined : editingGroup}
            categories={categories ?? []}
            onClose={() => setEditingGroup(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function CategoryForm({
  cat,
  groups,
  categories,
  onClose,
}: {
  cat?: Category;
  groups: CategoryGroup[];
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(cat?.kind ?? 'expense');
  const [groupId, setGroupId] = useState<number>(cat?.groupId ?? 0);
  const [color, setColor] = useState(cat?.color ?? PALETTE[0]);

  async function save() {
    if (!name.trim()) return;
    const base: Omit<Category, 'id' | 'builtin'> = {
      name: name.trim(),
      color,
      icon: cat?.icon ?? 'dots',
      kind,
      groupId: groupId || undefined,
    };
    if (cat?.id) await db.categories.update(cat.id, base);
    else await db.categories.add(base);
    invalidateRulesCache();
    onClose();
  }

  async function remove() {
    if (!cat?.id) return;
    const inUse = await db.transactions.where('categoryId').equals(cat.id).count();
    const msg =
      inUse > 0
        ? `¿Eliminar esta categoría? Las ${inUse} transacciones asociadas quedarán sin categorizar.`
        : '¿Eliminar esta categoría? No se puede deshacer.';
    if (!window.confirm(msg)) return;
    const fallback = categories.find(
      (c) =>
        c.kind === cat.kind &&
        c.builtin === 1 &&
        c.name.toLowerCase().startsWith('otros') &&
        c.id !== cat.id,
    );
    if (inUse > 0 && fallback?.id) {
      // Move to builtin "Otros" fallback so they remain categorized under a safe default
      await db.transactions.where('categoryId').equals(cat.id).modify({ categoryId: fallback.id });
    } else if (inUse > 0) {
      // No fallback available: clear categoryId so they show "Sin categoría"
      await db.transactions.where('categoryId').equals(cat.id).modify({ categoryId: undefined });
    }
    await db.rules.where('categoryId').equals(cat.id).delete();
    await db.categories.delete(cat.id);
    invalidateRulesCache();
    onClose();
  }

  const visibleGroups = groups.filter((g) => g.kind === kind);

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Café, gym, viajes..."
        autoFocus={!cat}
      />
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as 'expense' | 'income')}
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
      />
      <Select label="Grupo" value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
        <option value={0}>Sin grupo</option>
        {visibleGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
      <div>
        <p className="block text-xs text-muted mb-1.5">Color</p>
        <div className="flex gap-2 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full press ${color === c ? 'ring-2 ring-text/70' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
      {cat?.id && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar
        </Button>
      )}
    </div>
  );
}

function GroupForm({
  group,
  categories,
  onClose,
}: {
  group?: CategoryGroup;
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(group?.kind ?? 'expense');
  const [color, setColor] = useState(group?.color ?? PALETTE[0]);

  async function save() {
    if (!name.trim()) return;
    const base: Omit<CategoryGroup, 'id' | 'builtin'> = {
      name: name.trim(),
      color,
      icon: group?.icon ?? 'folder',
      kind,
      order: group?.order ?? 99,
    };
    if (group?.id) await db.categoryGroups.update(group.id, base);
    else await db.categoryGroups.add(base);
    onClose();
  }

  async function remove() {
    if (!group?.id) return;
    if (!window.confirm('¿Eliminar este grupo? Las categorías asociadas quedarán sin grupo.'))
      return;
    await db.categories.where('groupId').equals(group.id).modify({ groupId: undefined });
    await db.categoryGroups.delete(group.id);
    onClose();
  }

  const catsInGroup = categories.filter((c) => c.groupId === group?.id);

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ocio, Comida..."
        autoFocus={!group}
      />
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as 'expense' | 'income')}
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
      />
      <div>
        <p className="block text-xs text-muted mb-1.5">Color</p>
        <div className="flex gap-2 flex-wrap">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full press ${color === c ? 'ring-2 ring-text/70' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {catsInGroup.length > 0 && (
        <div>
          <p className="block text-xs text-muted mb-1.5">Categorías en este grupo</p>
          <div className="flex flex-wrap gap-1.5">
            {catsInGroup.map((c) => (
              <span
                key={c.id}
                className="chip"
                style={{ borderColor: c.color + '55', color: c.color }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
      {group?.id && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar grupo
        </Button>
      )}
    </div>
  );
}
