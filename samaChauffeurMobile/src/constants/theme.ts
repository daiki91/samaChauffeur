/**
 * Design tokens for samaChauffeur — mirrors frontend/tailwind.config.cjs and frontend/src/index.css
 * so the mobile app matches the web brand exactly. Import from here everywhere; never hardcode hex colors.
 */

export const colors = {
  brand: {
    50: '#fff4ed',
    100: '#ffe6d5',
    200: '#ffcbaa',
    300: '#ffa873',
    400: '#ff7a3d',
    500: '#f2590e',
    600: '#d6440a',
    700: '#b23409',
    800: '#8c280d',
    900: '#71220e',
  },
  secondary: {
    50: '#eefbf3',
    100: '#d5f5e0',
    200: '#abe9c4',
    300: '#75d6a2',
    400: '#3fbb80',
    500: '#1f9d65',
    600: '#157d51',
    700: '#126442',
    800: '#114f37',
    900: '#0f412f',
  },
  accent: {
    300: '#ffe08a',
    400: '#ffce54',
    500: '#f6b93b',
    600: '#de9a1f',
    700: '#b87814',
  },
  background: '#fff8f0',
  surface: '#ffffff',
  text: '#2a1c12',
  muted: '#8a7160',
  border: '#f0e2d3',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  white: '#ffffff',
  black: '#000000',
} as const;

/** hero-gradient: linear-gradient(160deg, #71220e 0%, #f2590e 55%, #f6b93b 100%) */
export const heroGradient = {
  colors: [colors.brand[900], colors.brand[500], colors.accent[500]] as [string, string, string],
  locations: [0, 0.55, 1] as [number, number, number],
  start: { x: 0.15, y: 0 },
  end: { x: 0.85, y: 1 },
};

export const warmGradient = {
  colors: [colors.brand[500], colors.accent[600]] as [string, string],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xl2: 24,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  xxxl: 32,
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const shadows = {
  xs: {
    shadowColor: '#140f0a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sm: {
    shadowColor: '#140f0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // kept as an alias of the original "card" shadow so existing call sites don't break
  card: {
    shadowColor: '#140f0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#140f0a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 6,
  },
  floating: {
    shadowColor: '#140f0a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
} as const;

export const lineHeights = {
  xs: 16,
  sm: 18,
  base: 21,
  md: 22,
  lg: 24,
  xl: 28,
  xxl: 32,
  xxxl: 38,
} as const;

export const letterSpacing = {
  tight: -0.2,
  normal: 0,
  wide: 0.4,
  wider: 1,
} as const;

export const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
  REQUESTED: { bg: colors.accent[300], fg: colors.brand[800], label: 'Demandée' },
  ASSIGNED: { bg: colors.brand[100], fg: colors.brand[700], label: 'Assignée' },
  ACCEPTED: { bg: colors.brand[100], fg: colors.brand[700], label: 'Acceptée' },
  STARTED: { bg: colors.secondary[100], fg: colors.secondary[700], label: 'En cours' },
  COMPLETED: { bg: colors.secondary[100], fg: colors.secondary[800], label: 'Terminée' },
  CANCELLED: { bg: colors.dangerBg, fg: colors.danger, label: 'Annulée' },
  PENDING: { bg: colors.accent[300], fg: colors.brand[800], label: 'En attente' },
  FAILED: { bg: colors.dangerBg, fg: colors.danger, label: 'Échouée' },
};

/**
 * Ordered trip-progress steps for the stepper shown on the trip-tracking screen — mirrors the
 * lifecycle used by Uber/Bolt/Yango/inDrive: request → driver assigned/accepted → en route → done.
 * ACCEPTED collapses into the same visual step as ASSIGNED (both mean "a driver is on it").
 */
export const tripSteps: { key: string; label: string; icon: string; statuses: string[] }[] = [
  { key: 'REQUESTED', label: 'Demandée', icon: 'search-outline', statuses: ['REQUESTED'] },
  { key: 'ASSIGNED', label: 'Chauffeur', icon: 'person-outline', statuses: ['ASSIGNED', 'ACCEPTED'] },
  { key: 'STARTED', label: 'En route', icon: 'navigate-outline', statuses: ['STARTED'] },
  { key: 'COMPLETED', label: 'Arrivée', icon: 'checkmark-done-outline', statuses: ['COMPLETED'] },
];

const theme = {
  colors,
  heroGradient,
  warmGradient,
  spacing,
  radii,
  fontSizes,
  fonts,
  shadows,
  lineHeights,
  letterSpacing,
  statusColors,
  tripSteps,
};
export default theme;
