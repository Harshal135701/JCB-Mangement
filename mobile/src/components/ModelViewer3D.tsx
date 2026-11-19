import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BACKHOE_LOADER_BASE64 } from '../assets/backhoe_model_base64';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const JCB_MACHINE_FALLBACK = require('../assets/jcb_backhoe_loader.webp');

interface ModelViewer3DProps {
  height?: number;
  width?: number;
}

export const ModelViewer3D: React.FC<ModelViewer3DProps> = ({
  height = 195,
  width = SCREEN_WIDTH * 0.94,
}) => {
  const [loadError, setLoadError] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);

  // HTML source for rendering Google model-viewer
  const htmlContent = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent !important;
      overflow: hidden;
    }
    model-viewer {
      width: 100%;
      height: 100%;
      background: transparent !important;
      --poster-color: transparent !important;
    }
  </style>
</head>
<body>
  <model-viewer
    id="jcb-viewer"
    src="data:model/gltf-binary;base64,${BACKHOE_LOADER_BASE64}"
    alt="JCB 3DX Backhoe Loader 3D Model"
    auto-rotate
    rotation-per-second="24deg"
    camera-controls
    touch-action="pan-y"
    shadow-intensity="1.5"
    shadow-softness="0.8"
    exposure="1.05"
    camera-orbit="45deg 75deg 105%"
    min-camera-orbit="auto 35deg auto"
    max-camera-orbit="auto 95deg auto"
    field-of-view="32deg"
    interaction-prompt="none"
  ></model-viewer>
</body>
</html>`;
  }, []);

  if (loadError || !is3DMode) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Image
          source={JCB_MACHINE_FALLBACK}
          style={{ width, height: height - 12 }}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={styles.modeToggleBadge}
          onPress={() => setIs3DMode(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="cube-outline" size={13} color="#0F172A" />
          <Text style={styles.modeToggleText}>Switch to 3D</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidHardwareAccelerationDisabled={false}
        transparent={true}
        onError={() => setLoadError(true)}
      />

      {/* 3D Interactive Badge / 360 Rotation Pill */}
      <View style={styles.pillBadge} pointerEvents="none">
        <MaterialCommunityIcons name="rotate-3d-variant" size={13} color="#F9B101" />
        <Text style={styles.pillText}>3D Interactive • Drag to rotate</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webviewContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  pillBadge: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 14,
    gap: 5,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  modeToggleBadge: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9B101',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 14,
    gap: 5,
  },
  modeToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
});
