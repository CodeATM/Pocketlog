import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Database,
  Download,
  FileJson,
  Flame,
  Gauge,
  HeartPulse,
  House,
  Info,
  Lightbulb,
  Lock,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Shapes,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * One icon set, one stroke weight.
 *
 * Every glyph in the app — including the category glyphs referenced from
 * `theme/tokens.ts` — resolves through this registry, so nothing can drift into a
 * second family or a second optical weight. 1.75pt stroke throughout; 22–24pt in
 * navigation and controls, 14–16pt inside dense list rows.
 */
const ICONS = {
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  bell: Bell,
  'book-open': BookOpen,
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  chart: ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  clock: Clock,
  copy: Copy,
  database: Database,
  download: Download,
  edit: Pencil,
  export: Share2,
  file: FileJson,
  gauge: Gauge,
  'heart-pulse': HeartPulse,
  home: House,
  import: Upload,
  info: Info,
  insights: ChartColumn,
  lightbulb: Lightbulb,
  lock: Lock,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  more: MoreHorizontal,
  palette: Palette,
  plus: Plus,
  reset: RotateCcw,
  search: Search,
  settings: Settings2,
  shapes: Shapes,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  streak: Flame,
  sun: Sun,
  target: Target,
  trash: Trash2,
  undo: Undo2,
  upload: Upload,
  user: User,
  users: Users,
  warning: TriangleAlert,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type Props = {
  /**
   * Accepts any string so a database-backed value (a category glyph) can be passed
   * straight through, while autocomplete still offers the known names. An unknown
   * name renders the neutral fallback glyph rather than throwing.
   */
  name: IconName | (string & {});
  size?: number;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.75 }: Props) {
  const Component = (ICONS as Record<string, LucideIcon>)[name];
  // A missing name is a programming error, not a runtime condition worth
  // handling: fall back to a neutral glyph and keep the tree rendering.
  const Glyph = Component ?? Shapes;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}

export function hasIcon(name: string): name is IconName {
  return name in ICONS;
}

/**
 * Narrows a database-backed glyph for components that want autocomplete.
 *
 * Optional on purpose: category glyphs are user-visible data that could name an
 * icon that does not exist, and a missing glyph should degrade to no glyph rather
 * than throw mid-render.
 */
export function toIconName(name: string): IconName | undefined {
  return hasIcon(name) ? name : undefined;
}

export const iconNames = Object.keys(ICONS) as IconName[];