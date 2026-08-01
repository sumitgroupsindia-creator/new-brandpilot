import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.brandpilot.mobile',
  appName: 'BrandPilot',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
