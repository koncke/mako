-- =============================================================================
-- 0319 · Lo que aceptó la persona al conectar su computadora (docs/ia-del-cliente.md §10, 21/10/2026)
-- =============================================================================
-- El Cerebro (21/10): «al conectar, la PERSONA instala y corre el programa ella misma, y acepta con un toque un texto
-- corto». Queda la VERSIÓN del texto que aceptó, en el código que pidió y en la PC que se conectó con él, con la hora.
-- Aditiva: dos columnas por tabla, sin tocar lo que ya hay.
-- =============================================================================

begin;

alter table ia_pc_codigos add column if not exists consentimiento text check (consentimiento is null or char_length(consentimiento) <= 40);
alter table ia_pc_dispositivos add column if not exists consentimiento text check (consentimiento is null or char_length(consentimiento) <= 40);
alter table ia_pc_dispositivos add column if not exists consentimiento_at timestamptz;

comment on column ia_pc_dispositivos.consentimiento is 'La versión del texto que aceptó la persona al conectar esta PC (lib/ia-pc-reglas.ts → VERSION_CONSENTIMIENTO).';

commit;
