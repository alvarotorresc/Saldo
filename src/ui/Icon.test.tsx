import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, ICON_NAMES, type IconName } from './Icon';

describe('Icon', () => {
  it('renders an svg for each registered name', () => {
    for (const name of ICON_NAMES) {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, `missing svg for ${name}`).not.toBeNull();
    }
  });

  it('honors size prop', () => {
    const { container } = render(<Icon name="home" size={32} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
  });

  it('uses viewBox 0 0 20 20 for handoff icons', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 20 20');
  });

  it('uses viewBox 0 0 24 24 for legacy icons', () => {
    const { container } = render(<Icon name="import" />);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('renders chev-l (handoff) and chevron-left (legacy) as distinct icons', () => {
    const newIcon = render(<Icon name="chev-l" />).container.querySelector('svg');
    const legacyIcon = render(<Icon name="chevron-left" />).container.querySelector('svg');
    expect(newIcon!.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(legacyIcon!.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('honors custom stroke prop', () => {
    const { container } = render(<Icon name="home" stroke={2.5} />);
    expect(container.querySelector('svg')!.getAttribute('stroke-width')).toBe('2.5');
  });

  it('default stroke for handoff icons is 1.5', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')!.getAttribute('stroke-width')).toBe('1.5');
  });

  it('default stroke for legacy icons is 1.8', () => {
    const { container } = render(<Icon name="import" />);
    expect(container.querySelector('svg')!.getAttribute('stroke-width')).toBe('1.8');
  });

  it('sets aria-hidden by default', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('exports all expected handoff icons', () => {
    const expected: IconName[] = [
      'home',
      'list',
      'chart',
      'grid',
      'settings',
      'plus',
      'minus',
      'search',
      'filter',
      'lock',
      'unlock',
      'shield',
      'chev-l',
      'chev-r',
      'target',
      'finger',
      'face-id',
      'cpu',
      'zap',
    ];
    for (const name of expected) {
      expect(ICON_NAMES).toContain(name);
    }
  });
});
