import { Icon, ICON_NAMES } from '@/ui/Icon';
import { Badge, Btn, KV, Metric, Row, Section } from '@/ui/primitives';
import {
  AreaChart,
  Bars,
  Donut,
  HeatmapCal,
  Ring,
  Spark,
  StackBar,
  StackedBars,
} from '@/ui/charts';

// Internal verification surface for the Terminal/Technical design system.
// Not wired into navigation. Access via #design-kit on the URL hash.

export default function DesignKit() {
  return (
    <div className="h-full overflow-y-auto bg-bg text-text font-mono">
      <header className="px-4 py-4 border-b border-border">
        <p className="text-mono10 text-muted tracking-wider">
          <span className="text-accent">▌</span> saldo@local / DESIGN-KIT
        </p>
        <h1 className="text-d24 text-text mt-1 tracking-tight">Terminal / Technical</h1>
        <p className="text-mono10 text-dim mt-1">tokens · iconos · primitivos · charts</p>
      </header>

      <Section title="BADGES">
        <div className="flex flex-wrap gap-2">
          <Badge tone="muted">LOCAL</Badge>
          <Badge tone="ok">OFFLINE</Badge>
          <Badge tone="warn">WARN</Badge>
          <Badge tone="danger">EXPENSE</Badge>
          <Badge tone="info">SHARED</Badge>
          <Badge tone="solid">ENCRYPTED</Badge>
        </div>
      </Section>

      <Section title="BUTTONS">
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="solid">COMMIT</Btn>
          <Btn variant="danger">DELETE</Btn>
          <Btn variant="outline">CANCEL</Btn>
          <Btn variant="ghost">SKIP</Btn>
          <Btn variant="solid" size="sm">
            SM
          </Btn>
          <Btn variant="solid" size="lg" block>
            LG BLOCK
          </Btn>
        </div>
      </Section>

      <Section title="ICONS">
        <div className="grid grid-cols-8 gap-3 text-muted">
          {ICON_NAMES.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-1 border border-border rounded-xs px-1 py-2"
              title={name}
            >
              <Icon name={name} size={16} />
              <span className="text-[8px] truncate max-w-full">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="METRICS">
        <div className="grid grid-cols-3 border border-border rounded-sm">
          <Metric label="NET" value="1 234" unit="€" delta="▲ 4,2%" deltaClassName="text-accent" />
          <Metric
            label="EXPENSE"
            value="−583"
            unit="€"
            delta="▼ 12%"
            deltaClassName="text-danger"
          />
          <Metric
            label="SAVINGS"
            value="23"
            unit="%"
            chart={<Spark data={[5, 7, 4, 9, 12, 8, 14]} w={80} h={20} />}
          />
        </div>
      </Section>

      <Section title="KV LIST">
        <div className="px-3 border border-border rounded-sm">
          <KV label="TX_ID" value="0x4a2f9b" />
          <KV label="ACCOUNT" value="saldo@n26" />
          <KV label="SOURCE" value="CSV · n26-2026-03.csv" />
          <KV label="HASH" value="sha256:7b…ce" valueClassName="text-dim" />
        </div>
      </Section>

      <Section title="ROWS">
        <div className="border border-border rounded-sm">
          <Row icon="cart" left="Mercadona" sub="12:34 · Super" right="−42,50 €" meta="N26" />
          <Row
            icon="bus"
            left="Renfe · Cercanías"
            sub="08:12 · Transporte"
            right="−2,45 €"
            meta="BBVA"
          />
          <Row
            icon="briefcase"
            left="Nómina marzo"
            sub="01 · Ingreso"
            right="+2 400,00 €"
            meta="BBVA"
          />
          <Row icon="settings" left="Preferencias" chevron onClick={() => void 0} />
        </div>
      </Section>

      <Section title="RING + DONUT">
        <div className="flex items-center gap-5">
          <Ring value={72} size={80} stroke={5}>
            <div className="text-d24 text-accent">72</div>
            <div className="text-mono9 text-muted tracking-widest">SAVINGS</div>
          </Ring>
          <Donut
            size={120}
            stroke={16}
            data={[
              { value: 420, color: '#8fc088' },
              { value: 180, color: '#c9a86a' },
              { value: 110, color: '#7ea6c9' },
              { value: 60, color: '#c97c7c' },
            ]}
          />
        </div>
      </Section>

      <Section title="AREA CHART 30D">
        <AreaChart
          data={[4, 6, 5, 8, 10, 9, 12, 14, 11, 13, 15, 18, 16, 20, 22, 19, 24, 26, 23, 25]}
          w={320}
          h={100}
        />
      </Section>

      <Section title="STACKED BARS IN/OUT 12M">
        <StackedBars
          data={Array.from({ length: 12 }, (_, i) => ({
            in: 200 + i * 17,
            out: 150 + ((i * 23) % 100),
          }))}
          w={320}
          h={100}
        />
      </Section>

      <Section title="BARS + HEATMAP + SPARK">
        <div className="flex flex-col gap-3">
          <Bars data={[1, 3, 5, 7, 6, 4, 8, 10, 7, 5, 3, 9]} w={320} h={60} />
          <HeatmapCal
            data={Array.from({ length: 30 }, (_, i) => (i % 7 === 0 ? 0 : (i * 3) % 10))}
            w={320}
            h={60}
            cols={10}
          />
          <div className="flex gap-4 items-center">
            <Spark data={[3, 5, 2, 8, 12, 7, 9]} />
            <Spark data={[10, 7, 6, 4, 3, 2, 1]} fill="rgba(201,124,124,.2)" color="#c97c7c" />
          </div>
        </div>
      </Section>

      <Section title="STACK BAR">
        <StackBar
          data={[
            { value: 40, color: '#8fc088' },
            { value: 30, color: '#c9a86a' },
            { value: 20, color: '#7ea6c9' },
            { value: 10, color: '#c97c7c' },
          ]}
          h={8}
        />
      </Section>

      <Section title="TYPOGRAPHY SCALE">
        <div className="flex flex-col gap-1 text-text">
          <span className="text-mono9 text-dim">mono9 · labels</span>
          <span className="text-mono10">mono10 · meta</span>
          <span className="text-mono11">mono11 · ui</span>
          <span className="text-mono12">mono12 · body</span>
          <span className="text-sans13 font-sans">sans13 · prose</span>
          <span className="text-d24 tracking-tight">d24 · hero small</span>
          <span className="text-d40 tracking-tight text-accent">d40 · NET</span>
        </div>
      </Section>

      <div className="px-4 py-4 text-mono9 text-dim border-t border-border">
        $ wc -l design-kit.tsx → ready for F1.
      </div>
    </div>
  );
}
