export const Colors = {
  primary: '#D62828',
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  secondaryText: '#A0A0A0',
  border: '#2A2A2A',
  error: '#FF4D4D',
  success: '#4CAF50',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export type ColorKeys = keyof typeof Colors;
