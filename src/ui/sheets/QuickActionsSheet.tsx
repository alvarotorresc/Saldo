import { Sheet } from '@/ui/Sheet';
import { Icon, type IconName } from '@/ui/Icon';

interface ActionKey {
  key: string;
  label: string;
  icon: IconName;
  onClick: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onNewExpense: () => void;
  onNewIncome: () => void;
  onNewTransfer: () => void;
  onImport: () => void;
  onExport: () => void;
  onNewGoal: () => void;
  onNewSubscription: () => void;
  onNewLoan: () => void;
  onNewRule: () => void;
}

export function QuickActionsSheet({
  open,
  onClose,
  onNewExpense,
  onNewIncome,
  onNewTransfer,
  onImport,
  onExport,
  onNewGoal,
  onNewSubscription,
  onNewLoan,
  onNewRule,
}: Props) {
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const actions: ActionKey[] = [
    { key: 'exp', label: 'NEW_EXPENSE', icon: 'minus', onClick: run(onNewExpense) },
    { key: 'inc', label: 'NEW_INCOME', icon: 'plus', onClick: run(onNewIncome) },
    { key: 'trf', label: 'NEW_TRANSFER', icon: 'swap', onClick: run(onNewTransfer) },
    { key: 'imp', label: 'IMPORT_CSV', icon: 'import', onClick: run(onImport) },
    { key: 'exp2', label: 'EXPORT', icon: 'download', onClick: run(onExport) },
    { key: 'goa', label: 'NEW_GOAL', icon: 'target', onClick: run(onNewGoal) },
    { key: 'sub', label: 'NEW_SUB', icon: 'repeat', onClick: run(onNewSubscription) },
    { key: 'loa', label: 'NEW_LOAN', icon: 'bank', onClick: run(onNewLoan) },
    { key: 'rul', label: 'NEW_RULE', icon: 'flow', onClick: run(onNewRule) },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Acciones rápidas">
      <div className="grid grid-cols-3 gap-2" data-testid="quick-actions">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            className="flex flex-col items-center justify-center gap-1.5 border border-border rounded-xs py-4 press"
          >
            <Icon name={a.icon} size={18} className="text-muted" />
            <span className="font-mono text-mono9 text-dim tracking-widest">{a.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
