-- =============================================================================
-- 0366 — usuarios.sesiones_desde: poder CERRAR las sesiones abiertas de una persona
-- =============================================================================
--
-- ORDEN DE DESPLIEGUE: da igual. El código que la escribe (lib/sesiones-revocadas.ts) tolera que la
-- columna falte (42703 → no anota nada), así que un deploy sin la migración se porta como antes.
-- ⚠️ Aplicada tampoco cierra nada todavía: la sesión la decide `leerSesion` (lib/auth.ts), y ése no
-- lee la columna (docs/hallazgos-seguridad.md, «Cerrar sesiones: el corte se anota y nadie lo lee»).
--
-- EL SÍNTOMA (auditoría de seguridad del 01/11/2026). La sesión es una cookie firmada que dura 30 días y
-- el server no guardaba nada de ella: cerrar sesión, cambiar la contraseña o restablecerla con el link
-- dejaban vivas las copias de esa cookie en otros dispositivos. Una cookie robada seguía valiendo un
-- mes después de que la víctima cambiara la contraseña.
--
-- QUÉ HACE. Una columna con la hora a partir de la cual valen las sesiones de esa persona: la sesión
-- firmada ANTES (`iat` del token) queda del lado que no vale. La escriben `revocarSesiones()` al cambiar o restablecer
-- la contraseña y la acción «Cerrar las otras sesiones» de Seguridad. NULL = ningún corte.
alter table public.usuarios add column if not exists sesiones_desde timestamptz;

comment on column public.usuarios.sesiones_desde is
  'El corte de las sesiones de esta persona: lo firmado antes queda del lado que no vale (lib/sesiones-revocadas.ts). NULL = sin corte.';
