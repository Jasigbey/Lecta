-- ==========================================================
-- LECTA APP: Permanent Account Deletion Function
-- ==========================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
--
-- What this does:
-- 1. Creates a SECURITY DEFINER function `delete_user()`
-- 2. Wipes all user data across all tables in a single transaction
-- 3. Permanently deletes the user from `auth.users`
-- 4. Grants permission for authenticated users to execute it
-- ==========================================================

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Grab the current authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated. Only logged-in users can delete their account.';
  END IF;

  -- 1. Delete dependent user records
  -- (Wrapped in case some tables don't exist yet)
  BEGIN
    DELETE FROM public.notifications WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.announcement_reads WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.focus_sessions WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.calendar_events WHERE created_by = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.chat_messages WHERE sender_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.chat_participants WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.feedback WHERE user_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.course_materials WHERE uploaded_by = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.announcements WHERE author_id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.profiles WHERE id = v_user_id;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 2. Permanently remove the user from Supabase Auth
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
