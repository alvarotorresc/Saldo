/**
 * CategoriesPage — F10 rewrite (ScrCategories). Terminal style: lista por
 * grupo ordenada por gasto del mes activo, avatar cuadrado 30×30 con inicial
 * + color, sparkline del grupo a la derecha. CRUD completo de grupos y
 * categorías via sheets.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { expensesByGroup, txByMonth } from '@/db/queries';
import { formatMoney } from '@/lib/format';
import { invalidateRulesCache } from '@/lib/categorize';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/primitives';
import { Spark } from '@/ui/charts';
import { Sheet } from '@/ui/Sheet';
import { useApp } from '@/stores/app';
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
  const month = useApp((s) => s.month);
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const monthTxs = useLiveQuery(() => txByMonth(month), [month]);
  const expByGroup = useLiveQuery(() => expensesByGroup(month), [month]);

  const [openGroup, setOpenGroup] = useState<CategoryGroup | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);

  const rows = useMemo(() => {
    const gidByCat = new Map<number, number>();
    (categories ?? []).forEach((c) => c.id && c.groupId && gidByCat.set(c.id, c.groupId));

    const txCountByGroup = new Map<number, number>();
    for (const t of monthTxs ?? []) {
      if (t.kind !== 'expense' || !t.categoryId) continue;
      const gid = gidByCat.get(t.categoryId);
      if (gid) txCountByGroup.set(gid, (txCountByGroup.get(gid) ?? 0) + 1);
    }

    const spend = new Map<number, number>();
    expByGroup?.forEach((amt, key) => {
      if (typeof key === 'number') spend.set(key, amt);
    });
    const totalExp = [...spend.values()].reduce((s, v) => s + v, 0);

    // Sparkline 10 days per group: last 10 days of monthTxs bucketed.
    const daily10 = new Map<number, number[]>();
    for (const t of monthTxs ?? []) {
      if (t.kind !== 'expense' || !t.categoryId) continue;
      const gid = gidByCat.get(t.categoryId);
      if (!gid) continue;
      const day = Number(t.date.slice(8, 10));
      if (!day) continue;
      const arr = daily10.get(gid) ?? new Array<number>(31).fill(0);
      arr[day - 1] += t.personalAmount ?? t.amount;
      daily10.set(gid, arr);
    }

    return (groups ?? [])
      .map((g) => {
        const amount = g.id ? (spend.get(g.id) ?? 0) : 0;
        const txCount = g.id ? (txCountByGroup.get(g.id) ?? 0) : 0;
        const pct = totalExp > 0 ? (amount / totalExp) * 100 : 0;
        const spark = (g.id ? daily10.get(g.id) : undefined) ?? new Array<number>(10).fill(0);
        return { group: g, amount, txCount, pct, spark: spark.slice(-10) };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [groups, categories, monthTxs, expByGroup]);

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub={`CATEGORIES · ${groups?.length ?? 0}`}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => setAddMenu(true)}
            aria-label="Añadir"
            className="press text-accent"
            data-testid="cat-add-btn"
          >
            <Icon name="plus" size={14} />
          </button>
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="categories-page">
        <div className="px-3.5 py-2.5 border-b border-border font-mono text-mono9 text-dim tracking-widest uppercase">
          ORDENADAS POR GASTO · {month}
        </div>
        <ul>
          {rows.map(({ group, amount, txCount, pct, spark }) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => setOpenGroup(group)}
                className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-border press"
                data-testid={`cat-group-${group.id}`}
              >
                <span
                  className="w-[30px] h-[30px] rounded-xs grid place-items-center shrink-0 font-mono text-[13px]"
                  style={{
                    background: `${group.color}22`,
                    border: `1px solid ${group.color}`,
                    color: group.color,
                  }}
                >
                  {group.name[0]?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-mono text-mono12 text-text truncate">{group.name}</div>
                  <div className="font-mono text-mono9 text-dim mt-0.5">
                    {txCount} tx · {pct.toFixed(1)}% del gasto
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-mono12 text-text tabular">
                    {formatMoney(amount)}
                  </div>
                  <div style={{ color: group.color }}>
                    <Spark data={spark} w={50} h={12} color={group.color} />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Add menu sheet */}
      <Sheet open={addMenu} onClose={() => setAddMenu(false)} title="Añadir">
        <div className="space-y-2">
          <Btn
            variant="outline"
            block
            onClick={() => {
              setAddMenu(false);
              setNewGroupOpen(true);
            }}
          >
            + GROUP
          </Btn>
          <Btn
            variant="outline"
            block
            onClick={() => {
              setAddMenu(false);
              setNewCatOpen(true);
            }}
          >
            + CATEGORY
          </Btn>
        </div>
      </Sheet>

      <GroupEditorSheet open={newGroupOpen} onClose={() => setNewGroupOpen(false)} mode="create" />

      <CategoryEditorSheet open={newCatOpen} onClose={() => setNewCatOpen(false)} mode="create" />

      {openGroup && (
        <GroupDetailSheet
          open={!!openGroup}
          group={openGroup}
          onClose={() => setOpenGroup(null)}
          categories={(categories ?? []).filter((c) => c.groupId === openGroup.id)}
        />
      )}
    </>
  );
}

function GroupDetailSheet({
  open,
  onClose,
  group,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  group: CategoryGroup;
  categories: Category[];
}) {
  const [editingGroup, setEditingGroup] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);

  async function removeGroup() {
    if (!group.id) return;
    if (!window.confirm(`¿Borrar grupo "${group.name}"? Las categorías quedarán sin grupo.`)) {
      return;
    }
    const cats = await db.categories.where('groupId').equals(group.id).toArray();
    await db.transaction('rw', db.categories, db.categoryGroups, async () => {
      for (const c of cats) {
        if (c.id) await db.categories.update(c.id, { groupId: undefined });
      }
      if (group.id) await db.categoryGroups.delete(group.id);
    });
    onClose();
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={group.name}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="w-[30px] h-[30px] rounded-xs grid place-items-center font-mono text-[13px]"
              style={{
                background: `${group.color}22`,
                border: `1px solid ${group.color}`,
                color: group.color,
              }}
            >
              {group.name[0]?.toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-mono11 text-text">{group.name}</div>
              <div className="font-mono text-mono9 text-dim">{categories.length} categorías</div>
            </div>
            <Btn size="sm" variant="outline" onClick={() => setEditingGroup(true)}>
              EDIT
            </Btn>
          </div>

          <div className="font-mono text-mono9 text-dim tracking-widest uppercase mt-3">
            CATEGORIES
          </div>
          <ul className="divide-y divide-border border border-border rounded-xs">
            {categories.length === 0 && (
              <li className="p-3 font-mono text-mono10 text-dim">Sin categorías.</li>
            )}
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-2.5 py-2.5"
                data-testid={`cat-row-${c.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  <span className="font-mono text-mono11 text-text truncate">{c.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCat(c)}
                    className="font-mono text-mono9 text-muted press"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (c.id && window.confirm(`¿Borrar "${c.name}"?`)) {
                        await db.categories.delete(c.id);
                        invalidateRulesCache();
                      }
                    }}
                    className="font-mono text-mono9 text-danger press"
                  >
                    DEL
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex gap-2 pt-1">
            <Btn variant="outline" block onClick={() => setAddCatOpen(true)}>
              + CATEGORY
            </Btn>
            <Btn variant="danger" onClick={removeGroup}>
              DELETE
            </Btn>
          </div>
        </div>
      </Sheet>

      <GroupEditorSheet
        open={editingGroup}
        onClose={() => setEditingGroup(false)}
        mode="edit"
        group={group}
      />
      {editingCat && (
        <CategoryEditorSheet
          open={!!editingCat}
          onClose={() => setEditingCat(null)}
          mode="edit"
          category={editingCat}
        />
      )}
      <CategoryEditorSheet
        open={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        mode="create"
        defaultGroupId={group.id}
      />
    </>
  );
}

function GroupEditorSheet({
  open,
  onClose,
  mode,
  group,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  group?: CategoryGroup;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState(group?.color ?? PALETTE[0]);
  const [kind, setKind] = useState<'expense' | 'income'>(group?.kind ?? 'expense');

  useEffect(() => {
    setName(group?.name ?? '');
    setColor(group?.color ?? PALETTE[0]);
    setKind(group?.kind ?? 'expense');
  }, [group?.id]);

  async function commit() {
    const n = name.trim();
    if (!n) return;
    if (mode === 'create') {
      await db.categoryGroups.add({
        name: n,
        color,
        icon: 'folder',
        kind,
        order: Date.now(),
      });
    } else if (group?.id) {
      await db.categoryGroups.update(group.id, { name: n, color, kind });
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'create' ? 'Nuevo grupo' : 'Editar grupo'}>
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="group-name-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">KIND</span>
          <div className="mt-1 flex gap-1">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={[
                  'flex-1 py-1.5 border rounded-xs text-mono10 tracking-widest',
                  kind === k ? 'text-accent bg-surface border-accent' : 'text-muted border-border',
                ].join(' ')}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">COLOR</span>
          <div className="mt-1 grid grid-cols-8 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`color ${c}`}
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
        <Btn variant="solid" block onClick={commit} disabled={!name.trim()}>
          {mode === 'create' ? 'CREATE' : 'SAVE'}
        </Btn>
      </div>
    </Sheet>
  );
}

function CategoryEditorSheet({
  open,
  onClose,
  mode,
  category,
  defaultGroupId,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  category?: Category;
  defaultGroupId?: number;
}) {
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [kind, setKind] = useState<'expense' | 'income'>(category?.kind ?? 'expense');
  const [groupId, setGroupId] = useState<number | undefined>(category?.groupId ?? defaultGroupId);

  useEffect(() => {
    setName(category?.name ?? '');
    setColor(category?.color ?? PALETTE[0]);
    setKind(category?.kind ?? 'expense');
    setGroupId(category?.groupId ?? defaultGroupId);
  }, [category?.id, defaultGroupId]);

  async function commit() {
    const n = name.trim();
    if (!n) return;
    if (mode === 'create') {
      await db.categories.add({ name: n, color, icon: 'dot', kind, groupId });
    } else if (category?.id) {
      await db.categories.update(category.id, { name: n, color, kind, groupId });
    }
    invalidateRulesCache();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
    >
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="category-name-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">GROUP</span>
          <select
            value={groupId ?? ''}
            onChange={(e) => setGroupId(Number(e.target.value) || undefined)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text"
          >
            <option value="">— sin grupo —</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">KIND</span>
          <div className="mt-1 flex gap-1">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={[
                  'flex-1 py-1.5 border rounded-xs text-mono10 tracking-widest',
                  kind === k ? 'text-accent bg-surface border-accent' : 'text-muted border-border',
                ].join(' ')}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">COLOR</span>
          <div className="mt-1 grid grid-cols-8 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                aria-label={`color ${c}`}
                className={[
                  'w-7 h-7 rounded-xs border',
                  color === c ? 'border-accent' : 'border-border',
                ].join(' ')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <Btn variant="solid" block onClick={commit} disabled={!name.trim()}>
          {mode === 'create' ? 'CREATE' : 'SAVE'}
        </Btn>
      </div>
    </Sheet>
  );
}
