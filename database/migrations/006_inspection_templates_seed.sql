-- =====================================================================
-- JCB Smart Machine Maintenance Management System (CMMS)
-- Migration 006: Seed Default Pre-Shift Inspection Templates
-- =====================================================================

-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. HMC Inspection Template (Mazak Horizontal Machining Center)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  'HMC',
  'HMC Daily Pre-Shift Machinery Inspection Checklist',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-1",
        "label": "Hydraulic System Pressure within 45 - 55 Bar",
        "type": "number",
        "unit": "Bar",
        "min": 45,
        "max": 55,
        "critical_min": 35,
        "critical_max": 70,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-2",
        "label": "Chiller Unit Operating Temperature (18C - 24C)",
        "type": "number",
        "unit": "C",
        "min": 18,
        "max": 24,
        "critical_min": 15,
        "critical_max": 35,
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-3",
        "label": "Visual Check: No hydraulic fluid pooling or line leaks",
        "type": "boolean",
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-4",
        "label": "Emergency Stop & Safety Enclosure Interlock Operational",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-5",
        "label": "Way Lube Automatic Lubrication Reservoir Full",
        "type": "boolean",
        "required": true,
        "is_critical": false
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 45,
        "max": 55,
        "critical_min": 35,
        "critical_max": 70,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 18,
        "max": 24,
        "critical_min": 15,
        "critical_max": 35,
        "unit": "C",
        "required": true
      },
      "vibration": {
        "max": 2.5,
        "critical_max": 4.5,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Robotic Welder Template (Fanuc 6-Axis Welding Station)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000002',
  'Robotic Welder',
  'Robotic Welder Pre-Shift Safety & Sensor Inspection',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-rob-1",
        "label": "Safety Light Curtain & Area Interlock Active",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-rob-2",
        "label": "Weld Shielding Gas Line Pressure (5 - 7 Bar)",
        "type": "number",
        "unit": "Bar",
        "min": 5,
        "max": 7,
        "critical_min": 4,
        "critical_max": 8,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-rob-3",
        "label": "Torch Tip & Wire Feed Visual Inspection",
        "type": "boolean",
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-rob-4",
        "label": "Coolant Flow Rate & Radiator Temp Nominal",
        "type": "boolean",
        "required": true,
        "is_critical": false
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 5,
        "max": 7,
        "critical_min": 4,
        "critical_max": 8,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 15,
        "max": 35,
        "critical_min": 10,
        "critical_max": 45,
        "unit": "C",
        "required": false
      },
      "vibration": {
        "max": 1.8,
        "critical_max": 3.0,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Press Template (Schuler 1000T Hydraulic Forming Press)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000003',
  'Press',
  'Hydraulic Forming Press Daily Pre-Shift Inspection',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-prs-1",
        "label": "Hydraulic Ram Main Pressure (150 - 220 Bar)",
        "type": "number",
        "unit": "Bar",
        "min": 150,
        "max": 220,
        "critical_min": 120,
        "critical_max": 260,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-prs-2",
        "label": "Die Clamping Mechanism Locked & Interlocked",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-prs-3",
        "label": "Hydraulic Sump Oil Temperature (25C - 45C)",
        "type": "number",
        "unit": "C",
        "min": 25,
        "max": 45,
        "critical_min": 20,
        "critical_max": 60,
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-prs-4",
        "label": "Emergency Stop Buttons Tested Across 4 Corners",
        "type": "boolean",
        "required": true,
        "is_critical": true
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 150,
        "max": 220,
        "critical_min": 120,
        "critical_max": 260,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 25,
        "max": 45,
        "critical_min": 20,
        "critical_max": 60,
        "unit": "C",
        "required": true
      },
      "vibration": {
        "max": 3.5,
        "critical_max": 5.5,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
