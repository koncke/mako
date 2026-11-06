-- =============================================================================
-- 0403 — Los COMPROBANTES que llegan al GRUPO de WhatsApp de una agencia (la mensualidad, 6/11/2026)
-- =============================================================================
-- Martín (5/11/2026): la mensualidad de una agencia se avisa por el grupo de MaKo con la agencia, y «MaKo pide ahí el
-- comprobante de Binance». Hasta hoy un comprobante que llegaba a un grupo no disparaba nada. Ahora lo lee
-- lib/agencia-mes-comprobante.ts con las MISMAS reglas que la tarjeta «Leer comprobante» (lib/comprobante-reglas.ts) y lo
-- guarda en la MISMA tabla, para que un N.º de operación cuente una sola vez por negocio (el índice único de la 0400).
--
-- EN PALABRAS: la tabla `comprobantes_leidos` acepta una fila SIN lead (la del grupo de una agencia: `origen = 'grupo'`) y
-- SIN archivo guardado (un PDF del grupo no se copia al storage; la foto sí, a la carpeta de los recibos). Una fila del grupo
-- siempre va sin lead, y una de un lead siempre con lead: lo exige un CHECK. No cambia nada de lo que ya existe.
--
-- ORDEN DE DESPLIEGUE: ANTES del código, o junto. Sin esto, el insert del grupo rebota (lead_id null) y el comprobante va a
-- Martín para revisarlo a mano: no se marca nada solo, pero no se pierde nada. Número elegido el 6/11/2026 barriendo main
-- (llega a 0402), todas las ramas y etiquetas de origin: el más alto era 0402.
--
-- Sin funciones: no hace falta revoke de EXECUTE. La tabla ya tiene RLS y su revoke (0400).
-- =============================================================================

begin;

alter table comprobantes_leidos alter column lead_id drop not null;
alter table comprobantes_leidos alter column media_path drop not null;

alter table comprobantes_leidos drop constraint if exists comprobantes_leidos_origen_check;
alter table comprobantes_leidos add constraint comprobantes_leidos_origen_check check (origen in ('flujo', 'chat', 'api', 'grupo'));

-- Una fila del grupo, sin lead; una de un lead, con lead.
alter table comprobantes_leidos drop constraint if exists comprobantes_leidos_lead_o_grupo;
alter table comprobantes_leidos add constraint comprobantes_leidos_lead_o_grupo check ((origen = 'grupo') = (lead_id is null));

-- A qué se aplicó (`mes:2026-12`, `entrada:17`, separados por coma), sólo para el grupo. Lo escribe lib/agencia-mes.ts.
alter table comprobantes_leidos add column if not exists aplicado_a text check (aplicado_a is null or char_length(aplicado_a) <= 300);

commit;
