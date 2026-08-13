-- =============================================================================
-- 0131_shares_token_cifrado — poder VOLVER A COPIAR un link ya emitido
-- =============================================================================
-- Del token solo se guardaba su `token_hash` (sha256), y esa es la regla 1 de
-- lib/shares.ts: un dump de la base no entrega los links vivos, y por eso el
-- link se muestra una única vez. La consecuencia práctica no estaba pensada:
-- **perder esa única vez no tenía vuelta**. La UI solo podía ofrecer «emitir uno
-- nuevo», que mata el anterior. El dueño lo dijo derecho: «estoy queriendo
-- copiarlo, no rotar el link».
--
-- La solución NO es guardar el token en claro — eso tira justo la propiedad que
-- motivó el hash. Se guarda **cifrado** con el mismo AES-256-GCM v2 de las
-- credenciales (lib/cripto-credenciales.ts): clave derivada por HKDF desde
-- CREDENCIALES_SECRET, sal por fila, y AAD que ata el criptograma a SU fila.
--
-- Qué cambia y qué no:
--  · `token_hash` sigue siendo el ÚNICO camino de resolución (`resolverToken`).
--    El cifrado no participa de autenticar a nadie: solo de MOSTRARLE el link a
--    un admin logueado que ya podría revocarlo y emitir otro.
--  · Un dump de la base sigue sin entregar links: sin CREDENCIALES_SECRET, el
--    criptograma no abre. Antes hacían falta 0 secretos y ahora hace falta 1.
--  · Es NULLABLE a propósito. Las filas viejas no tienen con qué rellenarse —el
--    token original no existe en ningún lado— y para ésas la UI sigue ofreciendo
--    reemitir. No se inventa un backfill de un dato que no se puede reconstruir.
-- =============================================================================
begin;

alter table shares
  add column if not exists token_cifrado text;

comment on column shares.token_cifrado is
  'El token del link, cifrado (gcm2, AAD = ws + share:<id>). Sirve SOLO para volver a mostrarle el link a un admin. Quien resuelve un token entrante es token_hash, nunca esto. NULL en las filas anteriores a la mig 0131: ésas solo se pueden reemitir.';

alter table share_invitados
  add column if not exists token_cifrado text;

comment on column share_invitados.token_cifrado is
  'Ídem shares.token_cifrado, con AAD = ws + invitado:<id>. NULL en filas viejas.';

commit;
