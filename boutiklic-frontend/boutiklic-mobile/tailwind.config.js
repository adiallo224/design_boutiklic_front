/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Palette BOUTIKLIC
        indigo: '#0E2038',
        terracotta: '#D84E2A',
        emeraude: '#0E7A52',
        or: '#E69D3B',
        violet: '#7B5EA7',
        encre: '#111418',
        papier: '#FFFDFA',
        'fond-boutique': '#FBF8F2',
        'fond-planche': '#F4EDE0',

        // Bordures (forte -> capillaire)
        'border-strong': '#EADBCA',
        border: '#E9DFD2',
        'border-hairline': '#F2EAE0',

        // Texte
        'text-secondary': '#676E7E',
        'text-placeholder': '#A2A9B8',

        // États
        danger: '#C6362F',
        'alerte-bg': '#FEF4E6',
        'alerte-text': '#8A6712',
        'info-bg': '#EAF0F7',
        'info-border': '#D3DFEC',
        'info-text': '#0E2038',
        'succes-bg': '#E6F1EC',
        'succes-text': '#1F5C43',

        // Alias sémantiques utilisés dans les composants
        primary: '#0E2038',
        'primary-dark': '#081321',
        'primary-light': '#234570',
        bg: '#FBF8F2',
        'bg-card': '#FFFDFA',
        'bg-elevated': '#F4EDE0',
        'border-default': '#EADBCA',
        text: '#111418',
        'text-muted': '#676E7E',
        'text-dim': '#A2A9B8',
        success: '#0E7A52',
        warning: '#E69D3B',
        info: '#0E2038',
        cash: '#0E7A52',
        'mobile-money': '#0E2038',
        debt: '#D84E2A',
        gnf: '#E69D3B',
        fcfa: '#0E2038',

        // Accents de groupe (A-F)
        'group-a': '#0E2038',
        'group-b': '#D84E2A',
        'group-c': '#E69D3B',
        'group-d': '#0E7A52',
        'group-e': '#7B5EA7',
        'group-f': '#111418',
      },
      fontFamily: {
        display: ['BricolageGrotesque'],
        body: ['Archivo'],
      },
    },
  },
  plugins: [],
};
