CREATE OR REPLACE FUNCTION public.api_admin_competition_list()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_auth uuid;
  v_actor uuid;
  v_school uuid;
BEGIN
  v_auth:=NULLIF(auth.user_id(),'')::uuid;

  SELECT au.id,au.school_id
  INTO v_actor,v_school
  FROM public.app_users au
  WHERE au.auth_user_id=v_auth AND au.is_active=true
  LIMIT 1;

  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=v_actor AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL')
  ) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',ca.id,
      'title_ar',ca.title_ar,
      'body_ar',ca.body_ar,
      'starts_at',ca.starts_at,
      'ends_at',ca.ends_at,
      'is_published',ca.is_published,
      'closed_at',ca.closed_at,
      'announcement_type',ca.announcement_type,
      'participant_count',(SELECT count(*) FROM public.competition_participants cp WHERE cp.competition_id=ca.id),
      'target_classes',COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id',cl.id,
          'grade_name',g.name_ar,
          'class_name',cl.name_ar
        ) ORDER BY g.sort_order,cl.name_ar)
        FROM jsonb_array_elements_text(COALESCE(ca.target_class_ids,'[]'::jsonb)) j(value)
        JOIN public.classes cl ON cl.id=j.value::uuid
        JOIN public.grades g ON g.id=cl.grade_id
      ),'[]'::jsonb)
    ) ORDER BY ca.created_at DESC)
    FROM public.competition_announcements ca
    WHERE ca.school_id=v_school
      AND ca.deleted_at IS NULL
      AND ca.announcement_type='TARGETED_COMPETITION'
  ),'[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_admin_competition_list() TO authenticated;
NOTIFY pgrst, 'reload schema';
