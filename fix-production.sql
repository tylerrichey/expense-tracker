-- Fix production database: Remove premature period 3 and reset period 2 to active
-- This fixes the issue where period 3 was created on Saturday instead of Monday

-- Delete the incorrect period 3 (created prematurely on Aug 2)
DELETE FROM budget_periods WHERE id = 3;

-- Set period 2 back to active status (it should still be active until Aug 3 11:59 PM PST)
UPDATE budget_periods SET status = 'active' WHERE id = 2;

-- Verify the fix
SELECT 'After fix - Current periods:' as message;
SELECT id, budget_id, start_date, end_date, status, created_at 
FROM budget_periods 
ORDER BY id;