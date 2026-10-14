-- =============================================================================
-- 0282 — El rastro de los rechazos del «Botón de pago» de una landing
-- =============================================================================
-- ⚠️ SIN APLICAR. ORDEN DE DESPLIEGUE: cuando sea, antes o después del código. El código
-- (lib/editor-landing/pago-landing-server.ts: `anotarRechazoDePago` y `rechazosDePago`) tolera que la
-- función o la tabla falten (PGRST202/PGRST205/42P01/42883): el rechazo queda sólo en el log, como
-- antes. Agrega y no saca nada.
--
-- (El número: el 14/10/2026 main llegaba a la 0280, el worktree `undecima` tenía la 0279 y la rama
-- `landing-t6` la 0281. Si al integrar alguien ya tomó la 0282, se renumera ANTES de aplicarla.)
--
-- Revisión de la tanda 4 del editor de landings (Paquete 3 de la tanda 6), con la regla de AGENTS.md
-- «Una política puede RECHAZAR; no puede no dejar rastro»: el POST público del paso de pago
-- (app/api/landing-generator/pagar) rechaza con 429, 403 y 404, y eso quedaba en un console.warn o en
-- nada. Un dueño cuyo comprador leyó «Demasiados intentos» no tenía dónde verlo.
--
-- UN CONTADOR por landing, día (UTC) y motivo. Sin email, sin IP, sin nombre: lo que se guarda es que
-- PASÓ y por qué, no quién. Se cuentan SÓLO los rechazos que llegan DESPUÉS de leer la landing (tope por
-- email, techo de la hora, dominio ajeno, producto que la foto no ofrece): cada uno suma en una fila que
-- ya existe, así que como mucho hay cuatro filas por landing y día, y nadie necesita podarlas. Los de
-- antes (tope por IP, tamaño, Origin, forma, trampa) no saben de qué landing son y van al log: una fila
-- por cada uno le daría a un bot una escritura por pedido.
--
-- Sin `workspace_id`, como `landing_pago_pedidos` (0276): cuelga de la landing (`doc_id`, en cascada) y
-- la lee SÓLO el server con el cliente crudo, después de confirmar que la landing es del workspace
-- (`rechazosDePago`). No va en TENANT_TABLES (lib/workspace.ts): ese proxy le agregaría un
-- `.eq('workspace_id')` a una columna que no existe.
-- =============================================================================
begin;

create table if not exists landing_pago_rechazos (
  doc_id  bigint not null references landing_docs(id) on delete cascade,
  dia     date not null default ((now() at time zone 'utc')::date),
  -- tope-email, techo, dominio-ajeno, producto (`MOTIVOS_RECHAZO_PAGO`, lib/editor-landing/pago-pedido.ts).
  -- Sin lista cerrada: un motivo nuevo no pide migración. El largo sí está acotado.
  motivo  text not null check (char_length(motivo) between 1 and 40),
  n       integer not null default 1 check (n >= 0),
  primary key (doc_id, dia, motivo)
);

comment on table landing_pago_rechazos is
  'Rechazos del POST del Botón de pago de una landing, contados por landing, día (UTC) y motivo. Sin datos personales. Mig 0282.';

-- RLS sin políticas = sólo el server (service_role). Y el revoke explícito, como la 0276: que el grant
-- llegue o no depende de quién aplique el DDL (AGENTS.md, «Toda migración decide su ORDEN»).
alter table landing_pago_rechazos enable row level security;
revoke all on landing_pago_rechazos from anon, authenticated;

-- Suma uno al contador de hoy en UNA sentencia: dos rechazos a la vez no se pisan, que es lo que haría
-- un «leer n y escribir n + 1» desde el server.
create or replace function landing_pago_rechazo_sumar(p_doc bigint, p_motivo text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into landing_pago_rechazos (doc_id, dia, motivo, n)
  values (p_doc, (now() at time zone 'utc')::date, p_motivo, 1)
  on conflict (doc_id, dia, motivo) do update set n = landing_pago_rechazos.n + 1;
$$;

-- Ninguna función de public ejecutable por la clave pública (0280): Supabase les da EXECUTE a anon y
-- authenticated por default privileges, y `from public` solo no los saca. Nace cerrada; el server la llama.
revoke execute on function landing_pago_rechazo_sumar(bigint, text) from public, anon, authenticated;
grant execute on function landing_pago_rechazo_sumar(bigint, text) to service_role;

commit;
