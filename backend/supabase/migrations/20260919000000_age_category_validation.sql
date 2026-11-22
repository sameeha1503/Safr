-- NOT VALID preserves existing legacy rows while enforcing new inserts/updates.
-- Review and correct legacy ages before separately validating these constraints.
ALTER TABLE public.safety_tags ADD CONSTRAINT safety_tags_age_category_check CHECK (
  person_age IS NOT NULL AND person_age BETWEEN 0 AND 120 AND (
    (category = 'kid' AND person_age < 18) OR
    (category IN ('adult', 'member') AND person_age >= 18 AND person_age < 60) OR
    (category = 'senior' AND person_age >= 60)
  )
) NOT VALID;

ALTER TABLE public.travellers ADD CONSTRAINT travellers_age_category_check CHECK (
  age IS NOT NULL AND age BETWEEN 0 AND 120 AND (
    (category = 'kid' AND age < 18) OR
    (category = 'adult' AND age >= 18 AND age < 60) OR
    (category = 'senior' AND age >= 60)
  )
) NOT VALID;
