// Asymmetric Cashflow-style professions — all tuned to the same payday/expense ratio (~0.62)
// so every start is fair while flavor (and the Freedom threshold) differs.
export const PROFESSIONS = [
  { id: 'janitor',   name: 'Night Janitor',   icon: '🧹', base: 900,  expense: 360,  savings: 600,  line: 'Mops floors, sees everything.' },
  { id: 'barista',   name: 'Barista',         icon: '☕', base: 1100, expense: 440,  savings: 700,  line: 'Knows everyones order and net worth.' },
  { id: 'mechanic',  name: 'Mechanic',        icon: '🔧', base: 1300, expense: 520,  savings: 900,  line: 'Fixes cars. Will fix a portfolio.' },
  { id: 'nurse',     name: 'Nurse',           icon: '💉', base: 1600, expense: 650,  savings: 1100, line: 'Three shifts, zero fear.' },
  { id: 'teacher',   name: 'Teacher',         icon: '🍎', base: 1900, expense: 770,  savings: 1400, line: 'Grades on a curve, invests off one.' },
  { id: 'engineer',  name: 'Engineer',        icon: '📐', base: 2200, expense: 890,  savings: 1600, line: 'Optimizes everything, especially rent.' },
  { id: 'analyst',   name: 'Analyst',         icon: '📊', base: 2500, expense: 1010, savings: 1900, line: 'Reads tickers for breakfast.' },
  { id: 'surgeon',   name: 'Surgeon',         icon: '🩺', base: 2900, expense: 1170, savings: 2300, line: 'Steady hands, expensive taste.' },
];
