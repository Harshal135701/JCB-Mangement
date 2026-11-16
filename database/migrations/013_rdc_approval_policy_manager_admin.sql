-- Migration 013: Update RDC High-Value Approval Policy
-- Business Decision: Both Manager and Admin can approve RDC Gate Passes, including challans with material values exceeding ₹50,000.
-- Strict Separation of Duties (SoD) remains enforced at the application level.
-- Emergency priority policy strictly remains restricted to Administrator sign-off.

UPDATE rdc_approval_configs
SET required_role = 'manager',
    approval_level = 1,
    updated_at = NOW()
WHERE priority = 'ALL'
  AND min_value >= 50000
  AND required_role = 'admin';
