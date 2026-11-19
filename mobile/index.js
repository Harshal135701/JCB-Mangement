// Polyfill for Hermes / React Native global Request prototype
if (typeof Request !== 'undefined' && (!Request.prototype || typeof Request.prototype !== 'object')) {
  try {
    Request.prototype = {};
  } catch (e) {}
}

import { AppRegistry } from 'react-native';
import * as rns from 'react-native-screens';
import App from './App.tsx';

// Safety polyfills for React Native Screens & Hermes
if (!rns.compatibilityFlags || typeof rns.compatibilityFlags !== 'object') {
  try {
    rns.compatibilityFlags = {
      isNewBackTitleImplementation: true,
      usesHeaderFlexboxImplementation: true,
      usesNewAndroidHeaderHeightImplementation: false,
    };
  } catch (e) {}
}

rns.enableScreens(true);

AppRegistry.registerComponent('JcbCmms', () => App);
