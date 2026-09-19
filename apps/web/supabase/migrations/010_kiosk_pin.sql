-- Add 4-digit kiosk PIN to users
ALTER TABLE users
  ADD COLUMN kiosk_pin char(4) DEFAULT NULL;
