import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { Btn } from './Btn';
import { KV } from './KV';
import { Metric } from './Metric';
import { Row } from './Row';
import { Section } from './Section';

describe('Badge', () => {
  it('renders with default tone muted', () => {
    render(<Badge>LOCAL</Badge>);
    const el = screen.getByText('LOCAL');
    expect(el).toBeInTheDocument();
    expect(el.dataset.tone).toBe('muted');
  });

  it('renders each tone with matching data attribute', () => {
    const tones = ['muted', 'ok', 'warn', 'danger', 'info', 'solid'] as const;
    for (const tone of tones) {
      const { unmount } = render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone).dataset.tone).toBe(tone);
      unmount();
    }
  });

  it('merges custom className', () => {
    render(<Badge className="custom-x">X</Badge>);
    expect(screen.getByText('X').className).toContain('custom-x');
  });
});

describe('Btn', () => {
  it('renders a button of type=button by default', () => {
    render(<Btn>OK</Btn>);
    const btn = screen.getByRole('button', { name: 'OK' });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('propagates onClick', async () => {
    const onClick = vi.fn();
    render(<Btn onClick={onClick}>GO</Btn>);
    await userEvent.click(screen.getByRole('button', { name: 'GO' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders all variants and sizes via data-attributes', () => {
    const variants = ['solid', 'danger', 'outline', 'ghost'] as const;
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const variant of variants) {
      for (const size of sizes) {
        const { unmount } = render(
          <Btn variant={variant} size={size}>
            {`${variant}-${size}`}
          </Btn>,
        );
        const btn = screen.getByRole('button', { name: `${variant}-${size}` });
        expect(btn.dataset.variant).toBe(variant);
        expect(btn.dataset.size).toBe(size);
        unmount();
      }
    }
  });

  it('adds w-full when block is true', () => {
    render(<Btn block>WIDE</Btn>);
    expect(screen.getByRole('button', { name: 'WIDE' }).className).toContain('w-full');
  });

  it('respects disabled prop', async () => {
    const onClick = vi.fn();
    render(
      <Btn disabled onClick={onClick}>
        NO
      </Btn>,
    );
    const btn = screen.getByRole('button', { name: 'NO' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('KV', () => {
  it('renders label and value', () => {
    render(<KV label="TX_ID" value="0x4a2f" />);
    expect(screen.getByText('TX_ID')).toBeInTheDocument();
    expect(screen.getByText('0x4a2f')).toBeInTheDocument();
  });

  it('applies custom valueClassName', () => {
    render(<KV label="NET" value="-42,50 €" valueClassName="text-danger" />);
    expect(screen.getByText('-42,50 €').className).toContain('text-danger');
  });
});

describe('Metric', () => {
  it('renders label, value, unit and delta', () => {
    render(<Metric label="NET 30D" value="1 234,56" unit="€" delta="▲ 4,2%" />);
    expect(screen.getByText('NET 30D')).toBeInTheDocument();
    expect(screen.getByText('1 234,56')).toBeInTheDocument();
    expect(screen.getByText('€')).toBeInTheDocument();
    expect(screen.getByText('▲ 4,2%')).toBeInTheDocument();
  });

  it('omits unit block when unit undefined', () => {
    const { container } = render(<Metric label="X" value="1" />);
    expect(container.textContent).toBe('X1');
  });
});

describe('Row', () => {
  it('renders left, sub, right and meta', () => {
    render(<Row left="Mercadona" sub="12:34 · Super" right="-42,50 €" meta="N26" />);
    expect(screen.getByText('Mercadona')).toBeInTheDocument();
    expect(screen.getByText('12:34 · Super')).toBeInTheDocument();
    expect(screen.getByText('-42,50 €')).toBeInTheDocument();
    expect(screen.getByText('N26')).toBeInTheDocument();
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Row left="A" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Enter keydown', () => {
    const onClick = vi.fn();
    render(<Row left="A" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is not interactive without onClick', () => {
    render(<Row left="A" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Section', () => {
  it('renders title and children', () => {
    render(
      <Section title="CATEGORÍAS">
        <p>child</p>
      </Section>,
    );
    expect(screen.getByText('CATEGORÍAS')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('renders right slot', () => {
    render(<Section title="X" right={<span>see all</span>} />);
    expect(screen.getByText('see all')).toBeInTheDocument();
  });
});
