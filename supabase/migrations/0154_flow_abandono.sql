-- =============================================================================
-- La cola de Flow, con quien la mire cuando el navegador ya no está
-- =============================================================================
-- Todo lo que vigilaba `flow_trabajos` colgaba del propio puente: el rescate de
-- colgados vive DENTRO de `flow_tomar_trabajos`, que sólo corre cuando la
-- extensión pide trabajo. O sea que el vigilante y el vigilado son el mismo, y
-- cuando el navegador se muere no queda nadie.
--
-- Medido en producción el 01/09/2026: el trabajo 550 quedó en `pendiente` con
-- `intentos = 0` y `tomado_at = null` durante HORAS, porque la extensión de la
-- clienta dejó de latir. El rescate no lo alcanza —sólo mira los `tomado`— y
-- tampoco había cómo alcanzarlo: nada del lado del servidor toca esta tabla.
--
-- Hay un tope de 4 minutos escrito en `estadoTomaAction`, y sirve mientras la
-- persona tenga la pantalla abierta sondeando. Si cierra la pestaña, el trabajo
-- queda igual. Esto es la otra mitad: la que corre aunque no haya nadie mirando.
--
-- ── Y UN AGUJERO QUE SE VE AL LADO ────────────────────────────────────────
-- El rescate devuelve un `tomado` a `pendiente` y NO toca `intentos`. Un trabajo
-- que el navegador toma y nunca reporta —se cerró Chrome en el medio, el service
-- worker murió— rebota `tomado` → (10 min) → `pendiente` → `tomado` para siempre,
-- con `intentos` clavado en 0. `fallar()` es el único que cuenta, y sólo cuenta
-- lo que se REPORTA: una desaparición silenciosa no reporta nada.
--
-- Las dos cosas se cuentan en la misma columna y significan lo mismo: un intento
-- que no produjo resultado.

-- ── 1. El rescate ahora CUENTA, y se rinde ─────────────────────────────────
create or replace function flow_tomar_trabajos(p_ws bigint, p_cuantos int)
returns setof flow_trabajos
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La sesión marcada frena TODO, y el guard vive acá y no en el llamador a
  -- propósito: afuera era un `if` que alguien podía olvidarse de copiar en el
  -- segundo call-site.
  if exists (
    select 1 from flow_puentes
    where workspace_id = p_ws and estado = 'marcada'
  ) then
    return;
  end if;

  -- Rescate de colgados: un trabajo `tomado` hace más de 10 minutos es de un
  -- navegador que se cerró en el medio.
  --
  -- ⚠️ SUMA UN INTENTO. Sin esto, un trabajo que se toma y nunca se reporta
  -- rebota entre los dos estados para siempre con `intentos` en 0 — y ocupa un
  -- lugar del lote de cinco en cada ciclo, así que además frena a los que sí
  -- podrían salir.
  update flow_trabajos
  set estado = case when intentos + 1 >= 5 then 'fallido' else 'pendiente' end,
      tomado_at = null,
      intentos = intentos + 1,
      motivo = case when intentos + 1 >= 5 then 'interno' else motivo end,
      error = case
        when intentos + 1 >= 5
        then 'El navegador lo tomó cinco veces y nunca devolvió un resultado.'
        else error
      end,
      listo_at = case when intentos + 1 >= 5 then now() else listo_at end
  where workspace_id = p_ws
    and estado = 'tomado'
    and tomado_at < now() - interval '10 minutes';

  return query
  update flow_trabajos t
  set estado = 'tomado', tomado_at = now()
  where t.id in (
    select id from flow_trabajos
    where workspace_id = p_ws and estado = 'pendiente'
    order by created_at
    limit greatest(1, least(p_cuantos, 5))
    for update skip locked
  )
  returning t.*;
end;
$$;

-- ── 2. Cerrar lo que nadie tomó nunca ──────────────────────────────────────
-- Devuelve las filas que cerró para que quien la llame pueda contarlas y avisar.
-- Si devolviera sólo un número, «cerré 3» y «cerré 3 del mismo cliente» serían
-- indistinguibles, y el aviso tiene que nombrar al workspace.
create or replace function flow_cerrar_abandonados(p_minutos int)
returns setof flow_trabajos
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update flow_trabajos t
  set estado = 'fallido',
      motivo = 'puente_ausente',
      error = 'Nadie tomó el trabajo: el navegador dejó de responder.',
      listo_at = now()
  where t.id in (
    select id from flow_trabajos
    where estado = 'pendiente'
      -- ⚠️ `tomado_at is null` ES LA CONDICIÓN, no una prolijidad. Un trabajo que
      -- YA fue tomado alguna vez y volvió a `pendiente` por el rescate no está
      -- abandonado: está reintentándose, y su reloj de `created_at` puede ser de
      -- hace horas sin que eso signifique nada. Cerrar por edad a secas mataría
      -- justo a los que el sistema está reintentando bien.
      and tomado_at is null
      and created_at < now() - make_interval(mins => greatest(1, p_minutos))
    -- Sin `for update skip locked`: si otra transacción tiene la fila, es porque
    -- alguien la está tomando en este preciso momento — o sea que NO está
    -- abandonada. Saltearla es exactamente lo correcto.
    for update skip locked
  )
  returning t.*;
end;
$$;

-- ⚠️ SIN GRANT A `anon` NI A `authenticated`. Las dos las llama el servidor con
-- la service key: `flow_tomar_trabajos` desde la puerta del puente y
-- `flow_cerrar_abandonados` desde el cron. Un `security definer` alcanzable por
-- el cliente es una escritura sin dueño sobre la tabla de todos.
revoke all on function flow_cerrar_abandonados(int) from public;
revoke all on function flow_tomar_trabajos(bigint, int) from public;
