// Minimal Lucide-style icon set for tab bar and a few inline uses.
// Backed by react-native-svg (already a dependency). When `lucide-react-native`
// is added later, swap these for the real icons — the API matches.

import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

const stroke = (p: IconProps) => ({
  width: p.size ?? 22,
  height: p.size ?? 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: p.color ?? 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...stroke(p)}>
      <Path d="M3 11.5 12 4l9 7.5" />
      <Path d="M5 10v10h14V10" />
      <Path d="M10 20v-6h4v6" />
    </Svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Svg {...stroke(p)}>
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...stroke(p)}>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

export function BarChartIcon(p: IconProps) {
  return (
    <Svg {...stroke(p)}>
      <Line x1="12" y1="20" x2="12" y2="10" />
      <Line x1="18" y1="20" x2="18" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
      <Line x1="3" y1="20" x2="21" y2="20" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...stroke(p)}>
      <Line x1="3" y1="6" x2="21" y2="6" />
      <Line x1="3" y1="12" x2="21" y2="12" />
      <Line x1="3" y1="18" x2="21" y2="18" />
    </Svg>
  );
}
