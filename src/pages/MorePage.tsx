import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Icon, type IconName } from '@/ui/Icon';

export type MoreSection =
  | 'goals'
  | 'subscriptions'
  | 'loans'
  | 'charts'
  | 'wealth'
  | 'categories'
  | 'forecast'
  | 'budgets'
  | 'rules';

interface Props {
  onOpen: (section: MoreSection) => void;
}

interface Entry {
  key: MoreSection;
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
}

const ENTRIES: Entry[] = [
  {
    key: 'charts',
    title: 'Gráficas',
    subtitle: 'Ahorro, ingresos y gastos',
    icon: 'chart',
    color: '#60A5FA',
  },
  {
    key: 'subscriptions',
    title: 'Suscripciones',
    subtitle: 'Renovaciones y coste total',
    icon: 'repeat',
    color: '#818CF8',
  },
  {
    key: 'loans',
    title: 'Préstamos',
    subtitle: 'Amortización y cuotas',
    icon: 'bank',
    color: '#F59E0B',
  },
  {
    key: 'goals',
    title: 'Metas de ahorro',
    subtitle: 'Objetivos con progreso',
    icon: 'target',
    color: '#10B981',
  },
  {
    key: 'wealth',
    title: 'Patrimonio',
    subtitle: 'Saldos y evolución',
    icon: 'wallet',
    color: '#34D399',
  },
  {
    key: 'forecast',
    title: 'Previsión 30 días',
    subtitle: 'Cash flow estimado',
    icon: 'trending-up',
    color: '#FB7185',
  },
  {
    key: 'categories',
    title: 'Categorías',
    subtitle: 'Editar grupos y categorías',
    icon: 'folder',
    color: '#A78BFA',
  },
  {
    key: 'budgets',
    title: 'Presupuestos',
    subtitle: 'Límites por categoría',
    icon: 'target',
    color: '#F472B6',
  },
  {
    key: 'rules',
    title: 'Reglas',
    subtitle: 'Auto-categorización',
    icon: 'flow',
    color: '#60A5FA',
  },
];

export function MorePage({ onOpen }: Props) {
  return (
    <>
      <TopBar title="Más" subtitle="Herramientas y vistas" />
      <div className="scroll-area flex-1 px-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {ENTRIES.map((e) => (
            <button key={e.key} onClick={() => onOpen(e.key)} className="press text-left">
              <Card className="h-32 flex flex-col justify-between">
                <div
                  className="w-9 h-9 rounded-full grid place-items-center"
                  style={{ background: e.color + '22', color: e.color }}
                >
                  <Icon name={e.icon} size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{e.title}</p>
                  <p className="text-[11px] text-muted mt-0.5 leading-snug">{e.subtitle}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
