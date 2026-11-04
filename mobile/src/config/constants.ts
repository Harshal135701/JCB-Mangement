/**
 * JCB Smart CMMS Mobile Application Configuration
 * Direct constants without .env native dependencies
 */

// API Configuration
// - Android Emulator default: http://10.0.2.2:5000/api/v1
// - Physical Android device via Wi-Fi: replace with your computer's local IP (e.g. http://192.168.1.100:5000/api/v1)
export const CONFIG = {
  API_BASE_URL: 'http://10.0.2.2:5000/api/v1',
  SOCKET_URL: 'http://10.0.2.2:5000',
  APP_NAME: 'JCB CMMS',
  VERSION: '1.0.0',
};

// Storage Keys for AsyncStorage
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@jcb_cmms_token',
  REFRESH_TOKEN: '@jcb_cmms_refresh_token',
  USER_PROFILE: '@jcb_cmms_user',
  OFFLINE_OUTBOX: '@jcb_cmms_outbox',
};

// JCB Industrial Design Tokens
export const COLORS = {
  primary: '#F5B324',       // JCB Iconic Yellow
  primaryDark: '#D99B1A',
  secondary: '#1E1E1E',     // Industrial Charcoal / Black
  background: '#F8FAFC',    // Soft anti-glare light grey
  card: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  
  // Status Indicator Colors
  statusRunning: '#16A34A',      // 🟢 Operational / Restored
  statusBreakdown: '#DC2626',    // 🔴 Breakdown / Critical Stop
  statusMaintenance: '#EA580C',  // 🟠 Under Maintenance / Repair
  statusAwaiting: '#2563EB',     // 🔵 Awaiting Parts / PR Delivery
  statusIdle: '#94A3B8',         // ⚪ Idle
};

