import { Tabs, router, usePathname } from 'expo-router';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LayoutDashboard, CalendarDays, Clock, MessageSquare, Settings, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export default function TabsLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const isSettingsPage = pathname.endsWith('/settings') || pathname === '/settings';

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="dashboard"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          headerShown: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }],
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && [styles.activeCircle, { backgroundColor: colors.primary }]]}>
                <LayoutDashboard size={20} color={focused ? '#ffffff' : colors.textSecondary} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && [styles.activeCircle, { backgroundColor: colors.primary }]]}>
                <CalendarDays size={20} color={focused ? '#ffffff' : colors.textSecondary} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="timetable"
          options={{
            title: 'Timetable',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && [styles.activeCircle, { backgroundColor: colors.primary }]]}>
                <Clock size={20} color={focused ? '#ffffff' : colors.textSecondary} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && [styles.activeCircle, { backgroundColor: colors.primary }]]}>
                <MessageSquare size={20} color={focused ? '#ffffff' : colors.textSecondary} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused }) => (
              <View style={[styles.iconWrapper, focused && [styles.activeCircle, { backgroundColor: colors.primary }]]}>
                <Settings size={20} color={focused ? '#ffffff' : colors.textSecondary} />
              </View>
            ),
          }}
        />
      </Tabs>

      {/* Floating AI Button accessible on tab pages except Settings */}
      {!isSettingsPage && (
        <TouchableOpacity
          style={[styles.floatingAiBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push('/ai-helper')}
        >
          <View style={styles.floatingAiInner}>
            <Sparkles size={22} color={'#ffffff'} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderRadius: 20,
    height: 80,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  iconWrapper: {
    width: 50,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    backgroundColor: '#2563eb',
  },
  /* Floating AI Button */
  floatingAiBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  floatingAiInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
