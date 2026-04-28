export const THEMES = [
  {
    id: 'ocean',
    name: 'Ocean',
    primary: '#0EA5E9',
    dark: '#0369A1',
    bg: '#F0F9FF',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    primary: '#22C55E',
    dark: '#15803D',
    bg: '#F0FDF4',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    primary: '#F97316',
    dark: '#C2410C',
    bg: '#FFF7ED',
    gradient: 'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    primary: '#8B5CF6',
    dark: '#6D28D9',
    bg: '#F5F3FF',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
  },
  {
    id: 'rose',
    name: 'Rose',
    primary: '#F43F5E',
    dark: '#BE123C',
    bg: '#FFF1F2',
    gradient: 'linear-gradient(135deg, #E11D48 0%, #FB7185 100%)',
  },
]

export function getTheme(id) {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
