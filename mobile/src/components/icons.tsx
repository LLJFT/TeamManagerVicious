// Tab-bar and inline icon set. Backed by `lucide-react-native` (ships SVG-only
// icons that match the web client's `lucide-react` glyphs exactly), which uses
// the already-installed `react-native-svg` peer.
//
// Re-exporting under stable local names keeps swap-out easy if we ever want
// custom glyphs without touching every call site.

import {
  Home,
  Users,
  Calendar,
  BarChart3,
  Menu,
} from 'lucide-react-native';

export const HomeIcon = Home;
export const UsersIcon = Users;
export const CalendarIcon = Calendar;
export const BarChartIcon = BarChart3;
export const MenuIcon = Menu;
