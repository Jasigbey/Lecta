import React, { createContext, useContext, useState } from 'react';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  tabBar: string;
  tabBarBorder: string;
  sectionTitle: string;
  divider: string;
  chatItem: string;
  chatItemBorder: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  statusBar: 'dark-content' | 'light-content';
}

export const lightColors: ThemeColors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  accent: '#3b82f6',
  background: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  inputBg: '#f8faff',
  inputBorder: '#dde5f0',
  headerBg: '#f8fafc',
  tabBar: '#ffffff',
  tabBarBorder: '#f1f5f9',
  sectionTitle: '#0f172a',
  divider: '#e2e8f0',
  chatItem: '#ffffff',
  chatItemBorder: '#f1f5f9',
  badgeBg: '#eff6ff',
  badgeBorder: '#bfdbfe',
  badgeText: '#1e40af',
  statusBar: 'dark-content',
};

export const darkColors: ThemeColors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#1e3a8a',
  accent: '#60a5fa',
  background: '#0f172a',
  card: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  inputBg: '#1e293b',
  inputBorder: '#334155',
  headerBg: '#0f172a',
  tabBar: '#1e293b',
  tabBarBorder: '#334155',
  sectionTitle: '#f1f5f9',
  divider: '#334155',
  chatItem: '#1e293b',
  chatItemBorder: '#334155',
  badgeBg: '#1e3a8a',
  badgeBorder: '#2563eb',
  badgeText: '#93c5fd',
  statusBar: 'light-content',
};

type ThemeContextType = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
  colors: lightColors,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        colors: isDarkMode ? darkColors : lightColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);


