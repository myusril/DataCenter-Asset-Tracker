import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '../../store/auth';

export default function AuthLayout() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
