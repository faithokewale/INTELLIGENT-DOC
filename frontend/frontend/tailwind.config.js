const c = (n) => `rgb(var(--${n}) / <alpha-value>)`
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'] },
    colors: { bg: c('bg'), surface: c('surface'), soft: c('soft'), accent: c('accent'), 'accent-fg': c('accent-fg'), ink: c('ink'), muted: c('muted'), line: c('line') },
    boxShadow: { card: '0 1px 2px rgb(46 42 51 / .04), 0 8px 24px -12px rgb(46 42 51 / .12)' },
    keyframes: { pop: { from: { opacity: 0, transform: 'translateY(6px) scale(.98)' }, to: { opacity: 1, transform: 'none' } } },
    animation: { pop: 'pop .18s ease-out' },
  } },
}
