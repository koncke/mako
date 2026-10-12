-- =============================================================================
-- 0261 — retencion_vsl_resumen: la retención del video, resumida en la base
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy del Dashboard v5 (lib/graficos-datos-extra.ts,
-- `leerResumenVsl`). AGREGA una función y no saca nada: la versión desplegada no la llama, así que aplicarla
-- antes no le molesta a nadie. Sin ella el código nuevo NO se rompe: detecta que la función falta
-- (PGRST202/42883) y resume en TS sobre los eventos (`resumirEventos`, la misma cuenta) — o sea que sigue
-- tan LENTO como hoy, que es lo que esta migración viene a arreglar.
--
-- ⚠️ EL NÚMERO: 0257 está en origin/main (setting_audios_voz_mako) y 0258 lo tiene tomado el worktree del
-- editor de landing (wt-gamma, `0258_landing_dominios.sql`, sin commitear el 12/10/2026). Si al integrar
-- alguien ya usó 0261, se RENUMERA antes de pushear y se borra el archivo viejo.
--
-- EL PORQUÉ (contrato docs/relevo/dashboard-v5.md, «la hoja Landing lenta»; relevo v5, área D):
-- la hoja Landing bajaba los eventos del VSL del período ENTEROS —48.305 filas en 30 días en el ws1, ~32 MiB,
-- 51 páginas en serie por tramo— DOS veces (el conjunto `retencion_vsl` y el bloque de la curva) para
-- terminar en 3.245 personas. El tope de /api/graficos es 60 s y un 504 apagaba la hoja entera. El avance de
-- una persona es un MÁXIMO, así que se puede resumir acá: una fila por (video, persona, host) con los máximos
-- que `avanceDe` (lib/vsl-retencion.ts) necesita. La cuenta del avance TERMINA en TS (`avanceDeResumen`), con
-- la duración del video de Panda, que la base no tiene.
--
-- ⚠️ ES UNA SEGUNDA ESCRITURA DE `avanceDe`, Y POR ESO TIENE TEST DE PARIDAD (tests/vsl-retencion-resumen.test.ts):
--   · la regex de lo que es un evento DEL VIDEO es `ES_EVENTO_DE_VIDEO` (lib/vsl-retencion.ts), textual;
--   · la del host de la página es `RE_HOST_DE_URL` (lib/vsl-retencion.ts), textual;
--   · `max_pct` = el % positivo más alto; `max_seg` = los segundos más altos de los eventos SIN un % positivo
--     (un evento con % usa el %, uno sin % usa sus segundos ÷ la duración: el máximo es el mayor de los dos);
--   · lo mismo sólo de los `exit` (el punto exacto de abandono, `histogramaAbandono`);
--   · sin las PRUEBAS (`prueba` no vacío, como `noEsDelNegocio`); la vista previa del constructor la saca el
--     lector por el HOST (`esPreviewDeEditor` vive en TS: por eso se agrupa por host y no por página).
-- El test exige que este archivo traiga las dos regex TEXTUALES: si una cambia en TS, el test cae.
--
-- EL DÍA se corta con la zona de la app (Tijuana, `p_tz`), como `fechaTj`: [desde 00:00, hasta+1 00:00) en
-- esa zona. `p_visitantes` acota a esas personas (los leads de `vsl_leads`, toda su historia).
--
-- DEVUELVE UN `jsonb` (un arreglo) y no un `setof`: PostgREST corta en 1000 filas SIN AVISAR también la
-- respuesta de una función, y el ws1 tiene 3.245 personas en 30 días. Una sola fila no se corta, y paginar
-- una función de agregación la recalcularía entera por página.
--
-- ⚠️ SEGURIDAD: `security invoker` (la app entra con service_role, que ya bypassa RLS; un `definer` sería un
-- privilegio que nadie necesita) y `revoke` a anon y authenticated: los defaults de Supabase les dan EXECUTE a
-- toda función nueva, y con esto cualquiera con la clave pública leería la retención de cualquier negocio
-- pasándole otro `p_ws`. El workspace va EXPLÍCITO (el lector lo resuelve con `getWorkspaceActual`).
-- =============================================================================

begin;

create or replace function public.retencion_vsl_resumen(
  p_ws bigint,
  p_desde date,
  p_hasta date,
  p_tz text default 'America/Tijuana',
  p_visitantes text[] default null
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with ev as (
    select
      coalesce(btrim(e.video_id), '') as video_id,
      nullif(btrim(e.visitor_id), '') as visitor_id,
      lower((regexp_match(btrim(coalesce(e.landing_url, '')), '^(?:[a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?([^/?#:@]+)'))[1]) as host,
      e.tipo_evento,
      e.porcentaje,
      e.segundos,
      e.created_at,
      e.id,
      e.landing_url,
      nullif(btrim(e.vsl_titulo), '') as titulo
    from vsl_events e
    where e.workspace_id = p_ws
      and e.created_at >= (p_desde::timestamp at time zone p_tz)
      and e.created_at < ((p_hasta + 1)::timestamp at time zone p_tz)
      and coalesce(e.prueba, '') = ''
      and btrim(coalesce(e.tipo_evento, '')) ~ '^(play|pausa|retoma|fin|exit|p\d+|s\d+)$'
      and (p_visitantes is null or e.visitor_id = any (p_visitantes))
  ),
  -- ⚠️ EN DOS NIVELES Y SIN JOIN. La primera versión agrupaba por persona y, aparte, los títulos, y los
  -- juntaba: con la estimación de un CTE (8 filas) el plan caía en un merge sólo por video que comparaba 9
  -- millones de pares (2,5 s de 3,1 medidos el 12/10/2026 sobre el ws1). Acá cada nivel es UNA agregación:
  -- primero por persona, host Y título (con el instante y el id de su primera URL, para poder elegir la
  -- primera de todas en el segundo nivel), después por persona y host.
  sub as (
    select
      video_id, visitor_id, host, titulo,
      count(*) as n,
      max(porcentaje) filter (where porcentaje > 0) as max_pct,
      max(segundos) filter (where not coalesce(porcentaje > 0, false) and segundos > 0) as max_seg,
      max(porcentaje) filter (where tipo_evento = 'exit' and porcentaje > 0) as max_pct_exit,
      max(segundos) filter (where tipo_evento = 'exit' and not coalesce(porcentaje > 0, false) and segundos > 0) as max_seg_exit,
      min(created_at) as primera,
      (array_agg(landing_url order by created_at, id) filter (where btrim(coalesce(landing_url, '')) <> ''))[1] as url,
      (array_agg(created_at order by created_at, id) filter (where btrim(coalesce(landing_url, '')) <> ''))[1] as t_url,
      (array_agg(id order by created_at, id) filter (where btrim(coalesce(landing_url, '')) <> ''))[1] as id_url
    from ev
    group by video_id, visitor_id, host, titulo
  ),
  grupos as (
    select
      video_id, visitor_id, host,
      max(max_pct) as max_pct,
      max(max_seg) as max_seg,
      max(max_pct_exit) as max_pct_exit,
      max(max_seg_exit) as max_seg_exit,
      min(primera) as primera,
      (array_agg(url order by t_url, id_url) filter (where url is not null))[1] as url,
      jsonb_object_agg(titulo, n) filter (where titulo is not null) as titulos
    from sub
    group by video_id, visitor_id, host
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'video_id', g.video_id,
    'visitor_id', g.visitor_id,
    'host', g.host,
    'max_pct', g.max_pct,
    'max_seg', g.max_seg,
    'max_pct_exit', g.max_pct_exit,
    'max_seg_exit', g.max_seg_exit,
    'primera', g.primera,
    'url', g.url,
    'titulos', g.titulos
  ) order by g.video_id, g.visitor_id, g.host), '[]'::jsonb)
  from grupos g;
$$;

comment on function public.retencion_vsl_resumen(bigint, date, date, text, text[]) is
  'Dashboard v5: la retención del VSL por (video, persona, host) — los máximos que avanceDe (lib/vsl-retencion.ts) necesita. Lo lee lib/graficos-datos-extra.ts (leerResumenVsl); la paridad la fija tests/vsl-retencion-resumen.test.ts.';

revoke all on function public.retencion_vsl_resumen(bigint, date, date, text, text[]) from public, anon, authenticated;
grant execute on function public.retencion_vsl_resumen(bigint, date, date, text, text[]) to service_role;

commit;

-- PostgREST cachea el esquema: sin esto, la función recién creada contesta PGRST202 hasta el próximo reload.
notify pgrst, 'reload schema';
