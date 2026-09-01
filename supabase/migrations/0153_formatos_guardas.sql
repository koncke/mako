-- =============================================================================
-- 0153 — Las tres guardas que le faltaban a `formatos`
-- =============================================================================
-- Las encontró una auditoría sobre la migración 0152, escrita hoy mismo. Las
-- tres fallan CALLADAS, que es por lo que ninguna se ve al probar.
begin;

-- ── 1. `camara` es la llave de un diccionario CERRADO ────────────────────────
-- `Camara` tiene cuatro valores y `lib/escenas.ts` los usa así:
--
--     COMO_FILMA[puesta.camara] ?? COMO_FILMA.estatica
--
-- O sea que un valor que no esté en el diccionario NO da error: cae a
-- «estática», y el formato entero se filma con trípode. Alguien que creó un
-- formato selfie recibe planos fijos y no hay una sola línea en ningún log que
-- lo diga.
--
-- La 0152 declaró la columna `text` sin CHECK, así que cualquier cadena entraba.
alter table formatos drop constraint if exists formatos_camara_valida;
alter table formatos add constraint formatos_camara_valida
  check (camara in ('estatica', 'mano', 'selfie', 'seguimiento'));

-- ── 2. `mixto` sin `ritmo` deja el anuncio ENTERO mudo ───────────────────────
-- `ritmoDeClips` expande el patrón H/O de `ritmo` a un array por clip. Con
-- `habla = 'mixto'` y `ritmo` vacío, ese patrón queda vacío… y la rama que lo
-- cubre devuelve `true` para todos, o el default cae del lado equivocado según
-- por dónde entre.
--
-- El default de la 0152 era `''`, así que la combinación rota era la que salía
-- sola. Un formato `mixto` sin ritmo declarado no es un formato a medias: es uno
-- que produce un anuncio que no se puede publicar.
alter table formatos drop constraint if exists formatos_mixto_con_ritmo;
alter table formatos add constraint formatos_mixto_con_ritmo
  check (habla <> 'mixto' or ritmo ~ '^[HO]+$');

-- ── 3. El rango de segundos tiene que ser LEGAL de punta a punta ─────────────
-- La 0152 ya exige que los extremos estén en (4,6,8,10). Falta que el rango no
-- sea de un solo valor cuando eso deja sin salida a un guion largo: si min y max
-- son iguales, `cabidaDeGuion` no tiene combinación alternativa que probar y el
-- texto que no entra se apila en la última toma. Es el apilado que se acaba de
-- arreglar, entrando por otra puerta.
--
-- No se prohíbe —un formato de un solo largo es legítimo— pero se deja escrito
-- que `clips` SÍ tiene que tener rango: es la otra palanca, y sin ninguna de las
-- dos el guion no tiene a dónde crecer.
alter table formatos drop constraint if exists formatos_clips_con_aire;
alter table formatos add constraint formatos_clips_con_aire
  check (clips_max > clips_min or segundos_max > segundos_min);

comment on constraint formatos_camara_valida on formatos is
  'COMO_FILMA cae a «estatica» sin avisar ante un valor desconocido: un formato selfie saldria filmado con tripode y sin un error en ningun log.';
comment on constraint formatos_mixto_con_ritmo on formatos is
  'Un formato mixto sin patron H/O produce un anuncio entero mudo.';

commit;
