import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Box, ActivityIndicator, View, StyleSheet } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Login } from './src/screens/Login';
import { Home } from './src/screens/Home';
import { Viewer } from './src/screens/Viewer';
import { Bookmarks } from './src/screens/Bookmarks';
import { Notifications } from './src/screens/Notifications';

const Stack = createNativeStackNavigator();

// App Navigation Dispatcher
const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          {/* Main App Screens */}
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Bookmarks" component={Bookmarks} />
          <Stack.Screen name="Notifications" component={Notifications} />
          {/* PDF Viewer takes full screen, no headers/footers */}
          <Stack.Screen name="Viewer" component={Viewer} />
        </>
      ) : (
        <Stack.Screen name="Login" component={Login} />
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
