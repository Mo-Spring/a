import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.valuation.app',
  appName: '估值助手',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#fafbfe',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#ffffff',
      style: 'LIGHT',
    },
  },
};

export default config;
