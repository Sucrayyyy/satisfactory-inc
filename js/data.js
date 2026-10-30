// Catalogue : ambiances, switchs, squishys, grades
export const AMBIANCES = [
  { id: 'bonbon', name: 'Bonbon', price: 0, moods: [
    { bg: '#FFD9E4', ac: '#FF4D8D', fg: '#4A1830' },
    { bg: '#D6F5E6', ac: '#12B57A', fg: '#0E3A29' },
    { bg: '#E3DCFF', ac: '#6B4CF6', fg: '#251A5C' },
    { bg: '#FFF0BF', ac: '#F29E00', fg: '#4A3200' },
    { bg: '#D2ECFF', ac: '#1D86EE', fg: '#0D2E52' },
    { bg: '#FFE0CE', ac: '#FF6A2B', fg: '#4C210F' } ] },
  { id: 'sorbet', name: 'Sorbet', price: 300, moods: [
    { bg: '#FFB8CB', ac: '#D81B60', fg: '#4A0A24' },
    { bg: '#AEEFD0', ac: '#06966A', fg: '#053826' },
    { bg: '#FFDF80', ac: '#E26A00', fg: '#4A2600' },
    { bg: '#B3D4FF', ac: '#2453E0', fg: '#0B1D52' },
    { bg: '#D9B8FF', ac: '#8A2BE2', fg: '#2E0B52' } ] },
  { id: 'matcha', name: 'Matcha', price: 450, moods: [
    { bg: '#E3EED0', ac: '#5B9A2B', fg: '#23361A' },
    { bg: '#F2EADB', ac: '#B07635', fg: '#3A2A18' },
    { bg: '#D7EBD6', ac: '#2E8E58', fg: '#17372A' },
    { bg: '#EFE6D2', ac: '#8C9A2B', fg: '#33361A' } ] },
  { id: 'lagon', name: 'Lagon', price: 600, moods: [
    { bg: '#BDF2EE', ac: '#079D98', fg: '#063A38' },
    { bg: '#C7E5FF', ac: '#156FE0', fg: '#0A2A52' },
    { bg: '#D0FBEA', ac: '#00A36A', fg: '#053A26' },
    { bg: '#CFE0FF', ac: '#4B5BF0', fg: '#141B52' } ] },
  { id: 'golden', name: 'Golden hour', price: 800, moods: [
    { bg: '#FFD2B3', ac: '#F2513F', fg: '#4A1A10' },
    { bg: '#FFC4D2', ac: '#B83CF0', fg: '#3E0F4A' },
    { bg: '#FFE6A6', ac: '#F07200', fg: '#4A2A00' },
    { bg: '#FFCDBF', ac: '#E8336F', fg: '#4A0F24' } ] },
  { id: 'minuit', name: 'Minuit', price: 1000, dark: true, moods: [
    { bg: '#18142C', ac: '#B592FF', fg: '#F1ECFF' },
    { bg: '#0E2128', ac: '#43EBBE', fg: '#E6FFF8' },
    { bg: '#2A1222', ac: '#FF77B4', fg: '#FFE9F3' },
    { bg: '#111A33', ac: '#6CB4FF', fg: '#E8F3FF' } ] },
  { id: 'galerie', name: 'Galerie', price: 1400, moods: [
    { bg: '#EEEEEC', ac: '#1B1B1B', fg: '#121212' },
    { bg: '#F5F2EA', ac: '#FF4F1F', fg: '#1A1A1A' },
    { bg: '#E9EEF2', ac: '#1F5BFF', fg: '#111827' } ] },
];

export const SWITCHES = [
  { id: 'creme', name: 'Crème', desc: 'Thock grave et feutré', price: 0, cap: '#FFF6EC' },
  { id: 'bleu', name: 'Clicky bleu', desc: 'Clic net et nerveux', price: 250, cap: '#BFE0FF' },
  { id: 'marbre', name: 'Marbre', desc: 'Clac cristallin', price: 400, cap: '#F2F2F5' },
  { id: 'bulle', name: 'Bulle', desc: 'Chaque touche fait plop', price: 550, cap: '#FFD1E3' },
  { id: 'typo', name: 'Machine à écrire', desc: 'Frappe + petite cloche', price: 700, cap: '#EDE4D3' },
];

export const SQUISHIES = [
  { id: 'mochi', name: 'Mochi', shape: 'mochi', color: '#FFE2EC', price: 0 },
  { id: 'peche', name: 'Pêche', shape: 'peche', color: '#FFB48E', price: 200 },
  { id: 'chat', name: 'Chat', shape: 'chat', color: '#CDB9FF', price: 350 },
  { id: 'matcha', name: 'Matcha', shape: 'mochi', color: '#C9E6A3', price: 450 },
  { id: 'nuage', name: 'Nuage', shape: 'nuage', color: '#D3ECFF', price: 550 },
  { id: 'fraise', name: 'Fraise', shape: 'fraise', color: '#FF6B81', price: 700 },
  { id: 'lune', name: 'Lune', shape: 'lune', color: '#FFEFA0', price: 900 },
];

export const RANKS = [
  'Stagiaire', 'Assistant·e Bulles', 'Spécialiste Pop', 'Technicien·ne du Film', 'Virtuose du Clavier',
  'Sculpteur·rice de Sable', 'Chef·fe d’Équipe', 'Manager du Calme', 'Directeur·rice Zen',
  'VP Satisfaction', 'PDG du Satisfaisant',
];
export const rankName = (i) => (i < RANKS.length ? RANKS[i] : `Légende du Zen ${i - RANKS.length + 2}`);

export const PRAISE = ['Parfait !', 'Trop satisfaisant', 'Si doux…', 'Magnifique !', 'Pur bonheur',
  'Incroyable !', 'Ahhh…', 'Impeccable', 'Délicieux', 'Quel calme', 'Chef-d’œuvre'];
