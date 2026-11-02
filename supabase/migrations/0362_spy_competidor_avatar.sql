-- =============================================================================
-- 0362 — La cara del competidor, guardada
-- =============================================================================
-- Martín, 2/11/2026: «quiero que cada competidor tenga su caricatura, como acostumbramos, como
-- tarjetas claro». En la lista de competidores hoy hay una letra adentro de un cuadrado.
--
-- La cara de un competidor NO se genera: es su foto de perfil pública, la que Instagram ya
-- devuelve en `profile_picture_url`. Lo que no se podía antes era GUARDARLA — `lib/instagram-perfil.ts`
-- lo dice textual: «una URL del CDN de Meta que VENCE (para mostrarla en una lista, nunca para
-- guardarla)». Con el bucket de 0361 eso dejó de ser cierto: la foto se baja igual que la
-- miniatura de una pieza y acá se guarda NUESTRA url, que no vence.
-- =============================================================================
begin;

alter table spy_competidores
  add column if not exists avatar text
    check (avatar is null or (avatar like 'https://%' and char_length(avatar) <= 1000));

comment on column spy_competidores.avatar is
  'Su foto de perfil pública, YA BAJADA a nuestro bucket (spy-miniaturas). No vence. Si está en null, la lista dibuja la inicial.';

commit;
