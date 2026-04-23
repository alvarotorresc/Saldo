import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DesignKit from './pages/_DesignKit';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  StatusBar.setBackgroundColor({ color: '#08090a' }).catch(() => undefined);
}

const isDesignKit = typeof window !== 'undefined' && window.location.hash === '#design-kit';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isDesignKit ? <DesignKit /> : <App />}</React.StrictMode>,
);
