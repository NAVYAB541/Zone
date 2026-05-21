import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export type ThemeType = 'light' | 'dark';

const THEME_KEY = 'app_theme';

const BASE_PRIMARY = '#4f46e5';
const BASE_SECONDARY = '#10b981';
const BASE_DANGER = '#ef4444';

export const lightColors = {
  background:           '#f7f8fc',
  surface:              '#ffffff',
  surfaceVariant:       '#f0f0f0',
  text:                 '#1a1a1a',
  textSecondary:        '#555555',
  textMuted:            '#888888',
  textDisabled:         '#bbbbbb',
  border:               '#dddddd',
  borderLight:          '#eeeeee',
  primary:              BASE_PRIMARY,
  secondary:            BASE_SECONDARY,
  danger:               BASE_DANGER,
  overdueBackground:    '#fff5f5',
  categoryChipBg:       '#ede9ff',
  categoryChipText:     '#6C63FF',
  toggleTrack:          '#e0e0e0',
  toggleThumb:          '#ffffff',
};

export const darkColors = {
  background:           '#0f0f0f',
  surface:              '#1a1a1a',
  surfaceVariant:       '#252525',
  text:                 '#f0f0f0',
  textSecondary:        '#aaaaaa',
  textMuted:            '#777777',
  textDisabled:         '#444444',
  border:               '#333333',
  borderLight:          '#2a2a2a',
  primary:              '#6366f1',
  secondary:            '#34d399',
  danger:               '#f87171',
  overdueBackground:    '#2a1515',
  categoryChipBg:       '#2a2840',
  categoryChipText:     '#a5b4fc',
  toggleTrack:          '#3a3a5c',
  toggleThumb:          '#6366f1',
};

export type AppColors = typeof lightColors;

const lightPaperTheme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: BASE_PRIMARY, secondary: BASE_SECONDARY, error: BASE_DANGER },
};

const darkPaperTheme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, primary: '#6366f1', secondary: '#34d399', error: '#f87171' },
};

interface ThemeContextType {
  theme: ThemeType;
  colors: AppColors;
  paperTheme: typeof lightPaperTheme;
  toggleTheme: () => void;
  setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved === 'dark' || saved === 'light') setTheme(saved);
    });
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  const applyTheme = (t: ThemeType) => {
    setTheme(t);
    AsyncStorage.setItem(THEME_KEY, t);
  };

  const colors      = theme === 'light' ? lightColors : darkColors;
  const paperTheme  = theme === 'light' ? lightPaperTheme : darkPaperTheme;

  return (
    <ThemeContext.Provider value={{ theme, colors, paperTheme, toggleTheme, setTheme: applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
