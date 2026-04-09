DO $$
DECLARE
  m record;
BEGIN
  -- Reset all ELOs to base 800 for a fresh calculation
  UPDATE public.profiles SET elo_rating = 800;
  UPDATE public.teams SET elo_rating = 800;

  -- Iterate through all completed matches in chronological order
  FOR m IN SELECT id FROM public.matches WHERE status = 'completed' ORDER BY played_at ASC LOOP
    
    -- We temporarily switch the status to 'score_submitted' and back to 'completed'.
    -- This guarantees our 'on_match_completed' trigger fires and calculates the ELO 
    -- in the proper historic sequence.
    UPDATE public.matches SET status = 'score_submitted' WHERE id = m.id;
    UPDATE public.matches SET status = 'completed' WHERE id = m.id;
    
  END LOOP;
END;
$$;
