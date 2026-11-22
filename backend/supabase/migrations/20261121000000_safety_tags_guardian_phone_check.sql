ALTER TABLE public.safety_tags
  ADD CONSTRAINT safety_tags_guardian_phone_format_check
  CHECK (guardian_phone ~ '^[0-9]{7,15}$') NOT VALID;
