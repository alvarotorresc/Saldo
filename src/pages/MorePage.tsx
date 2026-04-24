import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon, type IconName } from '@/ui/Icon';

export type MoreSection =
  | 'goals'
  | 'subscriptions'
  | 'loans'
  | 'wealth'
  | 'categories'
  | 'budgets'
  | 'rules'
  | 'export'
  | 'analytics';

interface Props {
  onOpen: (section: MoreSection) => void;
}

interface Entry {
  key: MoreSection;
  label: string;
  sub: string;
  icon: IconName;
  color: string;
}

const ENTRIES: Entry[] = [
  {
    key: 'analytics',
    label: 'ANALYTICS',
    sub: '12M / YoY / merchants',
    icon: 'pie',
    color: '#34D399',
  },
  {
    key: 'wealth',
    label: 'NET_WORTH',
    sub: 'assets − liabilities',
    icon: 'wallet',
    color: '#10B981',
  },
  {
    key: 'budgets',
    label: 'BUDGETS',
    sub: 'límites por categoría',
    icon: 'target',
    color: '#F472B6',
  },
  {
    key: 'categories',
    label: 'CATEGORIES',
    sub: 'grupos + categorías',
    icon: 'folder',
    color: '#A78BFA',
  },
  { key: 'rules', label: 'RULES', sub: 'auto-categorize', icon: 'flow', color: '#60A5FA' },
  {
    key: 'subscriptions',
    label: 'SUBS',
    sub: 'renovaciones y coste',
    icon: 'repeat',
    color: '#818CF8',
  },
  { key: 'loans', label: 'LOANS', sub: 'amortización y cuotas', icon: 'bank', color: '#F59E0B' },
  { key: 'goals', label: 'GOALS', sub: 'objetivos con progreso', icon: 'target', color: '#34D399' },
  {
    key: 'export',
    label: 'EXPORT',
    sub: '.saldo / .csv / .ofx / .pdf',
    icon: 'download',
    color: '#8A8A93',
  },
];

export function MorePage({ onOpen }: Props) {
  return (
    <>
      <TopBarV2 title="saldo@local" sub="MORE" />
      <div className="scroll-area flex-1 pb-6" data-testid="more-page">
        <ul className="divide-y divide-border">
          {ENTRIES.map((e) => (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => onOpen(e.key)}
                className="w-full flex items-center gap-3 px-3.5 py-3 press text-left"
                data-testid={`more-${e.key}`}
              >
                <span
                  className="w-[26px] h-[26px] border border-borderStrong rounded-xs grid place-items-center shrink-0"
                  style={{ color: e.color }}
                >
                  <Icon name={e.icon} size={13} stroke={1.6} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-mono11 text-text tracking-wide">{e.label}</div>
                  <div className="font-mono text-mono9 text-dim tracking-wide mt-0.5 truncate">
                    {e.sub}
                  </div>
                </div>
                <Icon name="chev-r" size={12} className="text-dim shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
