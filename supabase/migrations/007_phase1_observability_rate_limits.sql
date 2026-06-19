-- Phase 1 Wave 1: rate limits, pipeline events, cron run log, daily stats

-- Rate limiting
CREATE TABLE IF NOT EXISTS public.api_usage_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_cleanup ON public.api_usage_windows (window_start);

-- Pipeline observability
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid REFERENCES public.tracked_products(id) ON DELETE SET NULL,
  site text NOT NULL,
  step text NOT NULL,
  success boolean NOT NULL,
  duration_ms int,
  error_code text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_time ON public.pipeline_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_site ON public.pipeline_events (site, created_at DESC);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_events_insert_own" ON public.pipeline_events;
CREATE POLICY "pipeline_events_insert_own" ON public.pipeline_events
  FOR INSERT WITH CHECK (
    tracked_product_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tracked_products tp
      WHERE tp.id = pipeline_events.tracked_product_id
        AND tp.user_id = auth.uid()
    )
  );

-- Service role reads all events (cron health checks use admin client)

-- Cron run log for health checks
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  succeeded int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  processed int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_time ON public.cron_runs (job_name, created_at DESC);

-- Daily aggregated stats
CREATE TABLE IF NOT EXISTS public.daily_stats (
  stat_date date PRIMARY KEY,
  new_users int NOT NULL DEFAULT 0,
  new_products int NOT NULL DEFAULT 0,
  alerts_sent int NOT NULL DEFAULT 0,
  fetch_failures_by_site jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Atomic rate limit check + increment
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_user_id uuid,
  p_endpoint text,
  p_window_minutes int,
  p_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count int;
BEGIN
  IF p_limit <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0, 'current_count', 0);
  END IF;

  IF p_window_minutes >= 1440 THEN
    v_window_start := date_trunc('day', now() AT TIME ZONE 'utc');
    v_window_end := v_window_start + interval '1 day';
  ELSE
    v_window_start := date_trunc('hour', now() AT TIME ZONE 'utc');
    v_window_end := v_window_start + make_interval(mins => p_window_minutes);
  END IF;

  INSERT INTO api_usage_windows (user_id, endpoint, window_start, request_count)
  VALUES (p_user_id, p_endpoint, v_window_start, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET request_count = api_usage_windows.request_count + 1
  RETURNING request_count INTO v_count;

  IF v_count > p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_window_end - now()))::int),
      'current_count', v_count
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'retry_after_seconds', 0,
    'current_count', v_count
  );
END;
$$;

-- Cleanup old usage windows (call from aggregate-stats cron)
CREATE OR REPLACE FUNCTION public.cleanup_api_usage_windows(p_days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM api_usage_windows
  WHERE window_start < now() - make_interval(days => p_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
