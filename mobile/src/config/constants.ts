/**
 * JCB Smart CMMS Mobile Application Configuration
 * Official JCB Brand Palette:
 * - JCB Yellow: #F9B101 (Pantone 7549 C / RAL 1007)
 * - JCB Black: #000000 (Pantone Black 6 C)
 */

export const CONFIG = {
  API_BASE_URL: 'http://10.0.2.2:5000/api/v1',
  SOCKET_URL: 'http://10.0.2.2:5000',
  APP_NAME: 'JCB CMMS',
  VERSION: '1.0.0',
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@jcb_cmms_token',
  REFRESH_TOKEN: '@jcb_cmms_refresh_token',
  USER_PROFILE: '@jcb_cmms_user',
  OFFLINE_OUTBOX: '@jcb_cmms_outbox',
};

// Official JCB Industrial Design Tokens
export const COLORS = {
  primary: '#F9B101',       // Official Classic JCB Yellow
  primaryDark: '#E09E00',
  secondary: '#000000',     // Official JCB Black (Chassis & Counterweights)
  charcoal: '#1A1A1A',
  background: '#F8FAFC',    // Anti-glare clean light grey
  card: '#FFFFFF',
  text: '#000000',
  textMuted: '#64748B',
  border: '#E2E8F0',
  
  // High-Visibility Status Colors
  statusRunning: '#16A34A',      // 🟢 Operational / Restored
  statusBreakdown: '#DC2626',    // 🔴 Breakdown / Immediate Stoppage
  statusMaintenance: '#EA580C',  // 🟠 Under Maintenance / Active Wrench
  statusAwaiting: '#2563EB',     // 🔵 Waiting for Spare Parts / PR
  statusIdle: '#94A3B8',         // ⚪ Idle
};
