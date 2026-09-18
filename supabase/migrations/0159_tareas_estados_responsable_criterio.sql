-- =============================================================================
-- 0159 — el tablero del cliente aprende tres cosas: 2 estados, QUIÉN, y el CRITERIO
-- =============================================================================
-- Sale de las reuniones con Mauricio del 8 y 9/9 (08-T49, 08-T41, 08-T37). Todo es
-- ADITIVO: ninguna fila cambia, ningún estado se renombra, y ninguna pantalla cambia
-- de comportamiento hasta que alguien escriba estas columnas.
--
-- 1) DOS ESTADOS NUEVOS en `experimento_tareas.estado`, que hasta hoy era texto libre
--    (0051:49) y solo lo cuidaba el tipo de TypeScript:
--      · `no_cumple`      — «No cumplen criterio»: lo que la extracción de una reunión
--                           NO dejó pasar. Se guarda en vez de tirarse (08-T27).
--      · `en_seguimiento` — «En seguimiento»: ya no depende de uno, se espera a otro.
--    Los tres de siempre NO se renombran: 212 filas y ~10 lectores los usan. Cambia la
--    ETIQUETA que se muestra (Nuevas / En proceso / Concluidas), no la clave.
--
--    ⚠️ EL CHECK ES LA MITAD DE ESTO. Sin él, un `estado` mal escrito por cualquier
--    camino (un script, la API de MaKo) deja la tarjeta en una columna que no existe:
--    no la ve nadie y no hay error. Antes de ponerlo se midió prod: solo hay
--    por_hacer / en_curso / hecho (17/9). Si esta migración falla por el check, ALGO
--    escribió un estado inventado — hay que mirar qué, no aflojar el check.
--
-- 2) QUIÉN — responsable de la tarea y cliente de origen (08-T41, 08-T25, 08-T45).
--    Hoy la extracción ya los calcula (lib/tarea-dueno.ts, resolverClienteDeReunion)
--    y se pierden: no había dónde guardarlos. `responsable_tipo` es relativo al DUEÑO
--    DEL TABLERO — 'mio' / 'cliente' / 'tercero' —, que es lo que pide el filtro
--    «míos vs. me deben». NULL = no se sabe (todas las tareas de antes), que NO es lo
--    mismo que 'mio': inventar que eran del dueño sería mentir en el filtro.
--
-- 3) EL CRITERIO — el veredicto del juez y POR QUÉ (08-T37). Mauricio quiere «entender
--    qué principio no cumplió» para reescribir su criterio. Cada cosa en su columna,
--    y ninguna reemplaza a `estado`: el estado es dónde la PUSO una persona (la puede
--    sacar de «No cumplen»), el veredicto es lo que DIJO el juez, y eso no cambia
--    cuando la tarjeta se mueve. Si se mezclaran, promover una tarea borraría la
--    evidencia de que el juez se equivocó, que es justo el dato que sirve.
-- =============================================================================

begin;

alter table experimento_tareas
  add constraint experimento_tareas_estado_check
  check (estado in ('no_cumple', 'por_hacer', 'en_curso', 'en_seguimiento', 'hecho'));

alter table experimento_tareas
  add column if not exists responsable text,
  add column if not exists responsable_email text,
  add column if not exists responsable_tipo text
    check (responsable_tipo in ('mio', 'cliente', 'tercero')),
  add column if not exists cliente_nombre text,
  add column if not exists cliente_lead_id bigint references leads(id) on delete set null,
  add column if not exists tema text,
  add column if not exists criterio_veredicto text
    check (criterio_veredicto in ('cumple', 'no_cumple')),
  add column if not exists criterio_regla text,
  add column if not exists criterio_razon text,
  add column if not exists cita text;

comment on column experimento_tareas.estado is 'no_cumple (No cumplen criterio) · por_hacer (Nuevas) · en_curso (En proceso) · en_seguimiento (En seguimiento) · hecho (Concluidas). Etiquetas en lib/todo-estados.ts (mig 0159).';
comment on column experimento_tareas.responsable is 'Quién la ejecuta, como lo nombró la reunión. null = no se sabe (mig 0159).';
comment on column experimento_tareas.responsable_email is 'Email del responsable si se pudo resolver contra los participantes (mig 0159).';
comment on column experimento_tareas.responsable_tipo is 'Relativo al dueño del tablero: mio / cliente / tercero. null = no se sabe, NO es mio (mig 0159).';
comment on column experimento_tareas.cliente_nombre is 'Cliente de la reunión de la que salió (resolverClienteDeReunion). Es la etiqueta de ORIGEN, independiente del proyecto donde se archive (mig 0159).';
comment on column experimento_tareas.cliente_lead_id is 'Lead del CRM de ese cliente, si lo hay (mig 0159).';
comment on column experimento_tareas.tema is 'Tema de la tarea según la extracción, para filtrar (mig 0159).';
comment on column experimento_tareas.criterio_veredicto is 'Lo que dijo el juez del criterio del cliente. NO cambia cuando una persona mueve la tarjeta. null = no se juzgó (mig 0159).';
comment on column experimento_tareas.criterio_regla is 'Qué regla/principio del criterio no cumplió (mig 0159).';
comment on column experimento_tareas.criterio_razon is 'Por qué no la cumplió, en concreto (mig 0159).';
comment on column experimento_tareas.cita is 'Cita textual de la reunión que respalda la tarea (mig 0159).';

commit;

notify pgrst, 'reload schema';
