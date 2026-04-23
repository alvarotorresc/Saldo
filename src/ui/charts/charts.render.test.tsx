import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AreaChart } from './AreaChart';
import { Bars } from './Bars';
import { Donut } from './Donut';
import { HeatmapCal } from './HeatmapCal';
import { Ring } from './Ring';
import { Spark } from './Spark';
import { StackBar } from './StackBar';
import { StackedBars } from './StackedBars';

describe('Ring render', () => {
  it('renders svg with two circles and respects size', () => {
    render(<Ring value={25} size={50} stroke={4} />);
    const ring = screen.getByTestId('ring');
    const svg = ring.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('50');
    expect(svg.querySelectorAll('circle').length).toBe(2);
  });

  it('progress strokeDashoffset reflects value', () => {
    render(<Ring value={100} max={100} />);
    const progress = screen.getByTestId('ring-progress');
    expect(Number(progress.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });
});

describe('Donut render', () => {
  it('renders one arc per segment', () => {
    render(
      <Donut
        data={[
          { value: 1, color: 'red' },
          { value: 2, color: 'blue' },
          { value: 3, color: 'green' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('donut-arc')).toHaveLength(3);
  });
});

describe('AreaChart render', () => {
  it('renders a terminal dot on the last point when showDots', () => {
    render(<AreaChart data={[1, 2, 3]} />);
    expect(screen.getByTestId('area-dot')).toBeInTheDocument();
  });

  it('hides dot when showDots=false', () => {
    render(<AreaChart data={[1, 2, 3]} showDots={false} />);
    expect(screen.queryByTestId('area-dot')).toBeNull();
  });
});

describe('StackedBars render', () => {
  it('renders one IN and one OUT bar per datapoint', () => {
    render(
      <StackedBars
        data={[
          { in: 1, out: 2 },
          { in: 3, out: 4 },
        ]}
      />,
    );
    const chart = screen.getByTestId('stacked-bars');
    expect(within(chart).getAllByTestId('in-bar')).toHaveLength(2);
    expect(within(chart).getAllByTestId('out-bar')).toHaveLength(2);
  });
});

describe('Bars render', () => {
  it('renders one bar per value', () => {
    render(<Bars data={[1, 2, 3, 4]} />);
    expect(screen.getAllByTestId('bar')).toHaveLength(4);
  });
});

describe('HeatmapCal render', () => {
  it('renders n cells and respects empty style', () => {
    render(<HeatmapCal data={[0, 1, 2]} cols={3} />);
    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(3);
  });
});

describe('Spark render', () => {
  it('renders single path when fill=none', () => {
    const { container } = render(<Spark data={[1, 2, 3]} />);
    expect(container.querySelectorAll('path').length).toBe(1);
  });

  it('renders two paths when a fill is provided', () => {
    const { container } = render(<Spark data={[1, 2, 3]} fill="rgba(0,0,0,.1)" />);
    expect(container.querySelectorAll('path').length).toBe(2);
  });
});

describe('StackBar render', () => {
  it('renders one segment per data item', () => {
    render(
      <StackBar
        data={[
          { value: 1, color: 'red' },
          { value: 2, color: 'blue' },
          { value: 3, color: 'green' },
        ]}
      />,
    );
    expect(screen.getAllByTestId('stack-bar-seg')).toHaveLength(3);
  });
});
