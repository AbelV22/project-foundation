-- Distance (m) from a point to the nearest iTaxi zone, used by check-geofence
-- to tell the app how long / how far it can go before sending again.
-- Polygons are in (lat, lng) degrees; 1° ≈ 83 km is the lng scale at
-- Barcelona's latitude, the shorter axis, so the result never overestimates.
CREATE OR REPLACE FUNCTION public.fn_nearest_zone_m(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT round(min(_geojson_to_polygon(z.polygon) <-> point(p_lat, p_lng)) * 83000)::INTEGER
    FROM public.zones z
    WHERE z.polygon IS NOT NULL
      AND z.project = 'itaxi';
$$;

REVOKE EXECUTE ON FUNCTION public.fn_nearest_zone_m(DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_nearest_zone_m(DOUBLE PRECISION, DOUBLE PRECISION) TO service_role;
