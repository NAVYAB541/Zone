import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TaskListScreen    from './src/screens/TaskListScreen';
import AddTaskScreen     from './src/screens/AddTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import LaunchMeScreen    from './src/screens/LaunchMeScreen';
import FocusModeScreen   from './src/screens/FocusModeScreen';
import AIPlannerScreen   from './src/screens/AIPlannerScreen';
import AboutScreen       from './src/screens/AboutScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import WelcomeScreen     from './src/screens/WelcomeScreen';
import LoginScreen       from './src/screens/LoginScreen';
import SignUpScreen      from './src/screens/SignUpScreen';

import { RootStackParamList, AuthStackParamList } from './src/types';
import { requestNotificationPermission } from './src/utils/notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <NavigationContainer>
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
        <AuthStack.Screen name="Login"   component={LoginScreen} />
        <AuthStack.Screen name="SignUp"  component={SignUpScreen} />
      </AuthStack.Navigator>
    </NavigationContainer>
  );
}

function AppNavigator() {
  const { paperTheme, colors, theme } = useTheme();

  useEffect(() => { requestNotificationPermission(); }, []);

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
        <RootStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <RootStack.Screen name="TaskList"    component={TaskListScreen}    options={{ headerShown: false }} />
          <RootStack.Screen name="AddTask"     component={AddTaskScreen}     options={{ title: 'Add Task' }} />
          <RootStack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ title: 'Task Details' }} />
          <RootStack.Screen name="LaunchMe"    component={LaunchMeScreen}    options={{ title: 'Launch Me' }} />
          <RootStack.Screen name="FocusMode"   component={FocusModeScreen}   options={{ title: 'Focus Mode', headerShown: false }} />
          <RootStack.Screen name="AIPlanner"   component={AIPlannerScreen}   options={{ title: 'Plan with AI' }} />
          <RootStack.Screen name="About"       component={AboutScreen}       options={{ title: '' }} />
          <RootStack.Screen name="Settings"    component={SettingsScreen}    options={{ title: 'Settings' }} />
        </RootStack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

function ThemedApp() {
  const { token, ready } = useAuth();
  const { colors, paperTheme } = useTheme();

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (token) return <AppNavigator />;

  return (
    <PaperProvider theme={paperTheme}>
      <AuthNavigator />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
