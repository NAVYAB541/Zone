import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import TaskListScreen from './src/screens/TaskListScreen';
import AddTaskScreen from './src/screens/AddTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import LaunchMeScreen from './src/screens/LaunchMeScreen';
import FocusModeScreen from './src/screens/FocusModeScreen';
import AIPlannerScreen from './src/screens/AIPlannerScreen';
import AboutScreen from './src/screens/AboutScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { RootStackParamList } from './src/types';
import { requestNotificationPermission } from './src/utils/notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Inner component so it can read from ThemeContext before passing to PaperProvider
function ThemedApp() {
  const { paperTheme, colors, theme } = useTheme();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Pass our custom colors to NavigationContainer so transitions never flash white
  const navTheme = useMemo(() => ({
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card:       colors.surface,
      text:       colors.text,
      border:     colors.border,
    },
  }), [theme, colors]);

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="TaskList"    component={TaskListScreen}    options={{ title: 'Tasks' }} />
          <Stack.Screen name="AddTask"     component={AddTaskScreen}     options={{ title: 'Add Task' }} />
          <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ title: 'Task Details' }} />
          <Stack.Screen name="LaunchMe"    component={LaunchMeScreen}    options={{ title: 'Launch Me' }} />
          <Stack.Screen name="FocusMode"   component={FocusModeScreen}   options={{ title: 'Focus Mode', headerShown: false }} />
          <Stack.Screen name="AIPlanner"   component={AIPlannerScreen}   options={{ title: 'Plan with AI' }} />
          <Stack.Screen name="About"       component={AboutScreen}       options={{ title: '' }} />
          <Stack.Screen name="Settings"    component={SettingsScreen}    options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
