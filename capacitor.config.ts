import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.saldo',
  appName: 'Saldo',
  webDir: 'dist',
  backgroundColor: '#0A0A0B',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0B',
    },
  },
  android: {
    backgroundColor: '#0A0A0B',
  },
};

export default config;
