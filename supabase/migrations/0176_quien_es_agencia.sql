-- =============================================================================
-- 0176 — Quién ES una agencia. Lo decide el super admin, una vez.
-- =============================================================================
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy, por lo mismo que la 0175:
-- el código nuevo ya lee esta tabla. Sin ella, `esAgencia()` devuelve false para
-- todos y el botón de abrir cuentas no aparece — fail-closed, que es lo correcto,
-- pero deja la feature invisible.
--
-- ⚠️ POR QUÉ HACEN FALTA DOS TABLAS Y NO UNA.
--
-- La 0175 contesta «¿qué clientes puede mirar esta agencia?». Ésta contesta una
-- pregunta distinta y anterior: «¿quién puede tener clientes?». Derivar la
-- segunda de la primera —«es agencia el que tenga alguna fila»— parece ahorrar
-- una tabla y deja un agujero de huevo-y-gallina con un solo lado abierto: para
-- tener la primera fila hay que poder pedirla, así que **cualquier admin de
-- cualquier workspace** podría darse de alta clientes y crear workspaces nuevos
-- en la plataforma. No es un agujero de DATOS —la 0175 sigue exigiendo la firma
-- del super-admin para MIRAR adentro— pero sí de recursos: un inquilino creando
-- objetos de plataforma.
--
-- Y es, además, lo que el dueño pidió con todas las letras: «por ahora poné sólo
-- a Juanfran / Código Inmobiliario en ese nivel de acceso» (27/09/2026). Eso es
-- una fila, no una condición derivada.
--
-- ⚠️ Y NO ES UNA `capa`. La tentación era `capa = 'agencia'`, y son dos ejes
-- distintos: la capa dice QUÉ COMPRÓ (qué tabs ve), y esto dice QUÉ PUEDE HACER
-- con otros workspaces. Mezclarlos obliga a que toda agencia compre lo mismo. Y
-- técnicamente es peor: una capa nueva choca con el CHECK `workspaces_capa_valida`
-- (0096) y con `esCapaValida` en `crearWorkspace`, y si igual entrara un valor
-- desconocido a la columna, `capaDef` es **fail-open** hacia 'completo' — o sea
-- que el cliente vería tabs que no compró.

create table if not exists agencias (
  -- El workspace que puede tener clientes. PK: se es agencia o no se es.
  ws            bigint      not null primary key references workspaces(id) on delete cascade,
  -- Quién lo habilitó. El email y no un id, por lo mismo que en la 0175: los
  -- usuarios se dan de baja y la decisión queda.
  habilitada_por text,
  habilitada_at  timestamptz not null default now(),
  nota           text
);

comment on table agencias is
  'Qué workspaces pueden tener clientes propios. Lo decide el super admin. Distinto de agencia_clientes (0175), que dice a CUÁLES puede entrar cada una. Ver docs/hallazgos-seguridad.md → «Vista de agencia».';

alter table agencias enable row level security;
revoke all on agencias from anon, authenticated;

-- Juanfran / Código Inmobiliario (ws 13), que es el pedido textual del dueño y la
-- única agencia de hoy.
--
-- ⚠️ EL SEED VA EN POSITIVO Y POR ID, no «todos los que tengan tal cosa». Con un
-- solo valor no se puede saber si la condición está bien escrita (corolario 3 de
-- OWNER_WS), así que acá no hay condición: hay una fila, puesta a mano, que dice
-- exactamente lo que se decidió. La segunda agencia se agrega desde /admin.
--
-- El `where exists` es para que la migración no reviente en un entorno donde ese
-- workspace no exista (un clon, un proyecto nuevo): la FK lo rechazaría.
insert into agencias (ws, habilitada_por, nota)
select 13, 'martinkoncke@gmail.com', 'Pedido del dueño el 27/09/2026: la primera agencia.'
where exists (select 1 from workspaces where id = 13)
on conflict (ws) do nothing;
