-- Add Telegram chat ID to admins for booking notifications
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
