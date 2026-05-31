-- Subscription tracking for locations.
-- subscription_due_date NULL means no subscription enforced (location always available).
-- A location is subscription-expired when: today > subscription_due_date + subscription_grace_days.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS subscription_due_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_grace_days INT NOT NULL DEFAULT 7;
