# Relevo · chat «CRM y Chats» (cuenta claude4, desde el 27/10 20:33)

Quién reparte: el Cerebro (sesión local_797d5445…). Cada pieza va al Cerebro como «VERDE sin tipos <sha>», con los .ts
cambiados, después del rojo-verde, tests-afectados y tsc-acotado (todo lo pesado con `node C:/dev/con-turno.mjs …`).
Nada de esto se pushea desde acá: sube el Cerebro en sus trenes. Notas viejas de la misma cuenta (27/10): la carpeta de
notas del Cerebro, `crm-y-chats-claude4-27-10.md` y `crm-y-chats-estado-28-10.md`.

Actualizado: 28/10/2026 21:40.

## Hecho (con su rama y commit)

| Qué | Rama · worktree | Commit | Estado |
|---|---|---|---|
| El chat nuevo del Ops Center con la caja única y adjuntos | `chatnuevo-adjuntos-2810` · C:/dev/wt-chatnuevo-2810 | 0453923ab, e4d04e7fa (EN PRODUCCIÓN, tren-t), 05d7c3187, d2f690673, 1d586a686, 5ddf1672a | VERDE mandado de cada uno |
| Los dos defectos de la verificación de 5ddf1672a: el ticket de Soporte espera hasta que el mensaje LLEGA a la tarjeta; la caja sin conversación no pierde lo leído al desmontarse | ídem | 31fd30df2 | VERDE mandado (rojo-verde 54/0, 6 roturas; tests-afectados 2725 verde) |
| Las horas en la zona del negocio y los totales del período en lo que lee MaKo (F3 del diagnóstico de MaKo en WhatsApp) + la medición de los pedidos del CRM (docs/pedidos-crm.md) | `crm-horas-2810` · C:/dev/wt-crm-horas-2810 (sobre 506877517) | b799f7ed4 | ⚠️ NO entra al tren: la verificación (C:/dev/revisiones/2810-verificacion-crm-horas-b799f7ed4.md) dio un ALTA y dos BAJAS. Arreglo en curso, ver abajo |

## A medias

### 1. Arreglo de b799f7ed4 (crm-horas-2810) — lo que pidió el Cerebro
- ALTA: en el chat de la app, `listar_horarios_reunion` pasa por `conHorasDelNegocio` y PISA el `startIso` de Calendly
  ('…T12:00:00.000000Z' → '2026-10-30 09:00'); `proponer_agendar_reunion` lo compara carácter por carácter
  (lib/mako-doer-acciones.ts:762) y la reserva falla siempre.
- BAJA: claves `_utc` (mako.run.ts) con la hora del negocio. BAJA: `inicio` de ver_calendario_comunidad en la zona del
  negocio al lado de la `zona` del evento.
- El arreglo decidido: NO pisar el instante; agregar al lado `<campo>_hora_negocio` (y `_dia_semana`), y la nota dice
  «para hablar, la de _hora_negocio; para pasarle un instante a otra herramienta, el original tal cual». Archivo:
  lib/api-mako/horas-del-negocio.ts + tests/horas-del-negocio.test.ts. Cada arreglo con su test probado rompiéndolo.

### 2. Acciones en bloque del tablero (tickets #21 y #22 de Leila) — `crm-lote-2810` · C:/dev/wt-crm-lote-2810, sobre origin/main 23b329b5e, SIN COMMIT
Pedido (Leila): «Quiero limpiar la casilla de contacto nuevo de lidermente y pasarlo a Funnel general» (394 leads) y «Los
podemos borrar de ahí». Martín (28/10): elegir una columna o leads sueltos y «mandar mensaje de difusión». La decisión del
Cerebro: acciones en bloque (columna entera con conteo real, pasar a otro funnel y etapa avisando agendados/pagados,
descalificar, «Eliminar» = papelera de 30 días, el lugar para la hoja de difusión de Automations, y la API de MaKo con UNA
confirmación). Hito «Hecho» con `tickets: [21, 22]`.

Escrito (todo sin commit en el worktree):
- **Papelera** — `supabase/migrations/0340_leads_papelera.sql` (tabla `leads_papelera` + funciones que sacan la FOTO del lead
  y todo lo que se lleva en cascada, leyendo `pg_constraint`, y lo devuelven con los mismos ids; una transacción por lead).
  ⚠️ El SQL va al Cerebro para el sí de Martín: ANTES del deploy. Probada en un Postgres de verdad:
  `scripts/probar-0340-pglite.mjs` (9 casos verdes, 11 roturas en rojo; PGlite instalado en el scratchpad de la sesión
  27d40a62…/scratchpad/pglite). lib/leads-papelera.ts, lib/leads-papelera-reglas.ts, el cron
  app/api/cron/leads-papelera (vercel.json `45 10 * * *`), la pantalla app/crm/PapeleraLeads.tsx (menú de funnels,
  «Papelera · N»), y los tres «Eliminar» (barra, tarjeta, ficha y su hoja) mandan a la papelera con Deshacer.
- **Pasar a otro funnel** — lib/lead-funnel.ts (`pasarAOtroFunnel`, `previaDePasar`, `pasarLoteAOtroFunnel`,
  `deshacerPasar`, `quitarDeProducto` con `promoverA`, `agregadosDelCrm` mudada de actions.ts), lib/pasar-funnel-reglas.ts,
  app/crm/lead-funnel-actions.ts (3 actions), app/crm/PasarAOtroFunnel.tsx (renglón aparte del desplegable «Funnel»).
- **Descalificar/perder en bloque con UN motivo** — `moverLeadsDeEtapaAction(…, motivo)` y los chips en la barra.
- **Columna entera** — lib/leads.ts `filasDeAgregados` paginado (cortaba en 1.000 callado); `columnaEntera` en CrmBoard.
- **Difusión** — app/crm/seleccion-difusion.ts y la prop `onMandarMensaje` de la barra. FALTA montar
  `<HojaDifusion>` (app/automations/difusion/HojaDifusion.tsx, de Automations, rama aut-2510): al 28/10 21:30 todavía no
  existe en ninguna rama; el Cerebro avisa cuando llegue.
- **API de MaKo** — 5 operaciones en crm.def.ts/crm.run.ts (`pasar_en_bloque_otra_columna`, `pasar_en_bloque_otro_funnel`,
  `mandar_en_bloque_a_papelera`, `ver_papelera_crm`, `recuperar_de_papelera_crm`), lib/crm-bloque-server.ts,
  `idsDeColumna` en lib/etapas-crm-server.ts, lib/funciones-mako.ts, docs/api-mako.md y el snapshot regenerados.
- **Tests** — tests/crm-acciones-bloque.test.ts (nuevo) y adaptados: crm-lote-tandas, automations-por-que-no-sale,
  crm-campo-inline, leads-por-producto.

Falta: correr los tests de la zona (estaban corriendo), ops-center-bateria y ops-center-clasificador-app (AGENTS.md: una
operación nueva puede dejar afuera a otra), el rojo-verde, tests-afectados, tsc-acotado final, la cosecha
(docs/hallazgos-crm.md → «Acciones en bloque y la papelera»; AGENTS.md: «Eliminar = papelera»), el hito de la bitácora
app/admin/dev/crm/bitacora.ts con `tickets: [21, 22]`, el commit y el VERDE con el SQL de la 0340.

## La cola (orden del Cerebro, después de lo de arriba)
2. Unir dos fichas que ya son clientes (toca plata: con la revisión de pagos; lib/leads-unificar.ts ya existe).
3. Qué datos muestran los bloques de Pagos. 4. Las 8 decisiones de los requisitos de etapa (docs/pedidos-crm.md).
5. De dónde vino cada lead en varios funnels. 6. Los «Producto» que quedan → «Funnel». 7. Google Calendar en «Asignar
evento» (por el título del evento). 8. Más de 60 perfiles por «Extraer». 9. Las tarjetas del teléfono, «Prioridades» y el
check gris (también en el Plan del teléfono). 10. Cumpleaños (si pide migración, el SQL al Cerebro).
«Enviar a todos» de una etapa: es de Automations. La rama `crm-cuotas-espera-revision` NO se sube. `tienda-cws-2710` no se mezcla.

## Lo que espera a Martín (vía el Cerebro)
- El sí para aplicar la migración 0340 en producción (antes del deploy de las acciones en bloque).
