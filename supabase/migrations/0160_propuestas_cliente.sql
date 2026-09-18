-- =============================================================================
-- 0160 — el borrador de una reunión recuerda CON QUÉ CLIENTE fue
-- =============================================================================
-- Para el tablero único de Mauricio (08-T45, 08-T41): cada tarea que sale de una reunión
-- con un cliente tiene que llegar al tablero con ese cliente como etiqueta de origen
-- (experimento_tareas.cliente_nombre, mig 0159), para poder filtrar por cliente.
--
-- El cliente ya se resolvía (resolverClienteDeReunion, lib/reunion-auto.ts) y se usaba
-- para elegir el proyecto «Cliente: X». Después se tiraba: el borrador no tenía dónde
-- guardarlo, y al confirmar ya no había reunión a la cual preguntarle.
--
-- ⚠️ VA EN EL BORRADOR Y NO EN CADA TAREA, y no es por prolijidad. El modal de
-- confirmación autoguarda las tareas del borrador cada 900 ms con los campos que ÉL
-- conoce (TareasRecibidasModal, `aPayload`): un campo por tarea que el modal no conoce
-- se borra la primera vez que alguien abre la pantalla. Las columnas del borrador ese
-- autoguardado no las toca. Además es el dato correcto: el cliente es de la REUNIÓN,
-- todas sus tareas lo comparten.
--
-- null = la reunión no era con un cliente (o es un borrador de antes de esta migración).
-- =============================================================================

begin;

alter table plan_propuestas
  add column if not exists cliente_nombre text,
  add column if not exists cliente_lead_id bigint references leads(id) on delete set null;

comment on column plan_propuestas.cliente_nombre is 'Cliente de la reunión de la que salió el borrador (resolverClienteDeReunion). null = no era con un cliente (mig 0160).';
comment on column plan_propuestas.cliente_lead_id is 'Lead del CRM de ese cliente, si lo hay (mig 0160).';

commit;

notify pgrst, 'reload schema';
