-- =============================================================================
-- 0147 — tomar trabajos de la cola de Flow, atómico
-- =============================================================================
-- `tomarTrabajos` hacía un SELECT de los pendientes y DESPUÉS un UPDATE que los
-- marcaba `tomado`. El comentario decía «en el mismo tick» y esa era la
-- intención, pero entre las dos hay una ventana: dos consumidores que preguntan a
-- la vez leen el mismo trabajo en `pendiente` antes de que ninguno lo marque.
--
-- Deja de ser teórico HOY: la extensión se aprobó en la Chrome Web Store, así que
-- el escenario normal pasa a ser tener la de la tienda y la desempaquetada
-- conviviendo — y dos pestañas de MaKo abiertas ya era normal antes.
--
-- Lo que cuesta la carrera no es una fila duplicada: es **generar el mismo clip
-- dos veces con los créditos del cliente**.
--
-- `FOR UPDATE SKIP LOCKED` es la forma estándar: el segundo consumidor no espera
-- ni falla — saltea las filas que el primero ya tomó y se lleva las siguientes.

create or replace function flow_tomar_trabajos(p_ws bigint, p_cuantos int)
returns setof flow_trabajos
language plpgsql
-- `security invoker`: la app entra con service_role, que ya bypassa RLS. Un
-- `definer` acá sería un privilegio que nadie necesita y que después hay que
-- recordar que existe.
security invoker
set search_path = public
as $$
begin
  -- Un puente MARCADO no recibe trabajo. Va adentro de la función y no en el
  -- llamador a propósito: afuera era un `if` que alguien podía olvidarse de
  -- copiar en el segundo call-site.
  if exists (
    select 1 from flow_puentes
    where workspace_id = p_ws and estado = 'marcada'
  ) then
    return;
  end if;

  -- Rescate de colgados: un trabajo `tomado` hace más de 10 minutos es de un
  -- navegador que se cerró en el medio. Vuelve a la cola.
  update flow_trabajos
  set estado = 'pendiente', tomado_at = null
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
