import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import TaskListScreen from './src/screens/TaskListScreen';
import AddTaskScreen from './src/screens/AddTaskScreen';
import TaskDetailsScreen from './src/screens/TaskDetailsScreen';
import LaunchMeScreen from './src/screens/LaunchMeScreen';
import FocusModeScreen from './src/screens/FocusModeScreen';
import AIPlannerScreen from './src/screens/AIPlannerScreen';
import AboutScreen from './src/screens/AboutScreen';
import { RootStackParamList } from './src/types';
import { requestNotificationPermission } from './src/utils/notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Inner component so it can read from ThemeContext before passing to PaperProvider
function ThemedApp() {
  const { paperTheme, colors } = useTheme();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="TaskList"    component={TaskListScreen}    options={{ title: 'Tasks' }} />
          <Stack.Screen name="AddTask"     component={AddTaskScreen}     options={{ title: 'Add Task' }} />
          <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ title: 'Task Details' }} />
          <Stack.Screen name="LaunchMe"    component={LaunchMeScreen}    options={{ title: 'Launch Me' }} />
          <Stack.Screen name="FocusMode"   component={FocusModeScreen}   options={{ title: 'Focus Mode', headerShown: false }} />
          <Stack.Screen name="AIPlanner"   component={AIPlannerScreen}   options={{ title: 'Plan with AI' }} />
          <Stack.Screen name="About"       component={AboutScreen}       options={{ title: '' }} />
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
