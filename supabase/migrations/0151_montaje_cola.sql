-- =============================================================================
-- 0151 — La cola del montaje: pegar las tomas y devolver el anuncio
-- =============================================================================
-- El pipeline de edición (docs/edicion-video-automatica.md) encadena ~15
-- invocaciones de ffmpeg y ~8 de API, y un render de 70 s son ~25 s de CPU. Eso
-- no entra en una función serverless, y Vercel además no trae ffmpeg. Decidido
-- por Martín el 01/09/2026: corre en un contenedor propio.
--
-- ⚠️ ESTA COLA NO ES `flow_trabajos`, Y LA DIFERENCIA IMPORTA.
--
-- En Flow, el que ejecuta es el NAVEGADOR DEL CLIENTE: cada workspace tiene su
-- puente y su cuenta de Google, así que `flow_tomar_trabajos` scopea por
-- workspace y un cliente nunca ve trabajo de otro.
--
-- Acá el que ejecuta es NUESTRO worker, uno solo para todos. O sea que quien
-- toma trabajo NO es un inquilino: es la plataforma. De ahí salen las tres
-- decisiones de abajo.
begin;

create table if not exists montaje_trabajos (
  id            bigserial primary key,

  -- De quién es el anuncio. No lo usa el `tomar` —el worker sirve a todos— pero
  -- sí todo lo demás: la pantalla que muestra el resultado, el borrado de un
  -- workspace, y cualquier consulta que pase por `getTenantDb`.
  workspace_id  bigint not null,

  -- El anuncio del historial (`video-generator.historial`). Es lo que ata el
  -- resultado a la pantalla donde la persona lo está esperando.
  plan_id       text not null,

  -- Qué hay que montar: las urls de las tomas, el guion contra el que se
  -- verifica, y los parámetros del formato (cuántas tomas, cuánto dura cada
  -- una). Va entero en el pedido y no se re-lee del historial al ejecutar: el
  -- historial puede cambiar mientras el trabajo espera, y montar contra un plan
  -- distinto del que se encoló es la clase de error que nadie puede reconstruir
  -- después.
  pedido        jsonb not null default '{}'::jsonb,

  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'tomado', 'listo', 'fallido')),

  -- Lo que se lleva la persona: la url del anuncio montado, y los DOS números
  -- que le dan confianza —cuánto se recortó y que no se perdió ni una palabra—.
  -- Los produce `verificar-corte-anuncio.mjs`; acá se guardan para que la
  -- pantalla no tenga que volver a calcularlos.
  resultado     jsonb,

  -- ⚠️ CLASIFICADO, no texto libre: es lo que decide si se reintenta.
  --   'transitorio'  la API de transcripción falló, el storage no contestó
  --   'material'     un clip vino mudo o corrupto — reintentar no lo arregla
  --   'verificacion' el montaje salió pero perdió texto: NO se entrega
  --   'interno'      un bug nuestro
  -- Sin esto, «falló» y «falló y va a fallar siempre» se ven iguales, y la cola
  -- reintenta para siempre algo que no puede salir bien.
  motivo        text not null default '',
  error         text not null default '',

  intentos      int not null default 0,

  -- Para el orden y para rescatar los colgados. Un `tomado` que nadie devuelve
  -- —el contenedor se reinició a mitad de un render— bloquearía ese anuncio para
  -- siempre.
  tomado_at     timestamptz,
  created_at    timestamptz not null default now(),
  listo_at      timestamptz
);

-- La consulta del worker: los pendientes, más viejo primero, de todos.
create index if not exists montaje_trabajos_cola
  on montaje_trabajos (estado, created_at) where estado = 'pendiente';

-- La de la pantalla: ¿cómo va el montaje de ESTE anuncio?
create index if not exists montaje_trabajos_plan
  on montaje_trabajos (workspace_id, plan_id, id desc);

-- Para rescatar los que quedaron tomados.
create index if not exists montaje_trabajos_colgados
  on montaje_trabajos (estado, tomado_at) where estado = 'tomado';

-- RLS prendida y CERO policies, igual que `flow_trabajos` (0145) y `plan_tareas`
-- (0093): nadie entra con la key anónima. Se lee y se escribe por `getTenantDb`,
-- que scopea por workspace, o por el worker con service_role. Una tabla nueva
-- sin esto es exactamente cómo este repo dejó 15 tablas abiertas a `anon`.
alter table montaje_trabajos enable row level security;

comment on table montaje_trabajos is
  'Cola del montaje de anuncios. La ejecuta NUESTRO worker en contenedor (ffmpeg), no el navegador del cliente: por eso `montaje_tomar` no scopea por workspace (mig 0151).';
comment on column montaje_trabajos.motivo is
  'Clasificación de la falla, no texto libre: decide si se reintenta. transitorio|material|verificacion|interno.';
comment on column montaje_trabajos.resultado is
  'La url del anuncio y los dos numeros que ve la persona: cuanto se recorto y que no se perdio ninguna palabra.';

-- ── Tomar trabajo, atómico ───────────────────────────────────────────────────
-- Misma forma que `flow_tomar_trabajos` (0147) y por la misma razón: entre un
-- SELECT de pendientes y el UPDATE que los marca hay una ventana, y dos réplicas
-- del worker preguntando a la vez se llevan el mismo trabajo. Acá no cuesta
-- créditos del cliente —el render lo pagamos nosotros— pero sí duplica ~25 s de
-- CPU y, peor, deja dos escrituras compitiendo por el mismo `resultado`.
--
-- ⚠️ SIN `p_ws`, y es la diferencia con la de Flow: el worker es de la
-- plataforma y sirve a todos los workspaces.
create or replace function montaje_tomar(p_cuantos int)
returns setof montaje_trabajos
language plpgsql
-- `security invoker`: el worker entra con service_role, que ya bypassa RLS. Un
-- `definer` acá sería un privilegio que nadie necesita.
security invoker
set search_path = public
as $$
begin
  -- Rescate de colgados. VEINTE minutos y no diez como en Flow: allá el trabajo
  -- es una llamada HTTP y acá es un pipeline entero —transcribir, cortar,
  -- mezclar, renderizar— que en un anuncio largo pasa los cinco minutos con
  -- facilidad. Un rescate demasiado corto no desatasca: duplica el render que
  -- todavía está corriendo.
  update montaje_trabajos
  set estado = 'pendiente', tomado_at = null
  where estado = 'tomado'
    and tomado_at < now() - interval '20 minutes';

  -- ⚠️ Y LOS QUE YA GASTARON SUS INTENTOS NO VUELVEN A LA COLA.
  --
  -- Sin esto, el rescate y el reintento se pelean: un trabajo que falla siempre
  -- —un clip corrupto— vuelve a pendiente cada 20 minutos, para siempre, y el
  -- worker no hace otra cosa. Se marca fallido y se dice por qué.
  update montaje_trabajos
  set estado = 'fallido',
      motivo = case when motivo = '' then 'interno' else motivo end,
      error = case when error = '' then 'Se agotaron los intentos.' else error end,
      listo_at = now()
  where estado = 'pendiente' and intentos >= 3;

  return query
  update montaje_trabajos t
  set estado = 'tomado', tomado_at = now(), intentos = t.intentos + 1
  where t.id in (
    select id from montaje_trabajos
    where estado = 'pendiente'
    order by created_at
    -- Uno por vez por defecto: un render satura un core, así que pedir de a
    -- muchos no acelera nada y sí alarga el rescate de los colgados. La
    -- concurrencia se sube agregando RÉPLICAS del worker, no subiendo esto.
    limit greatest(1, least(p_cuantos, 3))
    for update skip locked
  )
  returning t.*;
end;
$$;

commit;
