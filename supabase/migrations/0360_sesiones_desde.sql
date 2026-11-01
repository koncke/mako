-- =============================================================================
-- 0360 — usuarios.sesiones_desde: poder CERRAR las sesiones abiertas de una persona
-- =============================================================================
-- ⚠️ NÚMERO A CONFIRMAR con «Cerebro › Integración» antes de aplicar: elegido el 01/11/2026 mirando
-- main, integracion, las 160 ramas y las etiquetas respaldo/* y nube/* (la última era la 0359).
--
-- ORDEN DE DESPLIEGUE: da igual. El código que la lee (lib/sesiones-revocadas.ts) tolera que la
-- columna falte (42703 → «no hay corte»), así que un deploy sin la migración se porta como antes.
-- Mientras no se aplique, «cambiar la contraseña cierra las otras sesiones» NO rige.
--
-- EL SÍNTOMA (auditoría de seguridad del 01/11/2026). La sesión es una cookie firmada que dura 30 días y
-- el server no guardaba nada de ella: cerrar sesión, cambiar la contraseña o restablecerla con el link
-- dejaban vivas las copias de esa cookie en otros dispositivos. Una cookie robada seguía valiendo un
-- mes después de que la víctima cambiara la contraseña.
--
-- QUÉ HACE. Una columna con la hora a partir de la cual valen las sesiones de esa persona: toda sesión
-- firmada ANTES (`iat` del token) deja de valer. La escriben `revocarSesiones()` al cambiar o restablecer
-- la contraseña y la acción «Cerrar las otras sesiones» de Seguridad. NULL = ningún corte.
alter table public.usuarios add column if not exists sesiones_desde timestamptz;

comment on column public.usuarios.sesiones_desde is
  'Las sesiones firmadas antes de esta hora no valen (lib/sesiones-revocadas.ts). NULL = sin corte.';
