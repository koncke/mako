# Relevo del chat «Nada por detrás» (nube, 6/11/2026)

Lo pedido (el Cerebro, por la lista de `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md` y `docs/relevo/pendientes-barrido.md`):
hacer lo que quedó sin hacer de esa lista. Orden: 3.1 «nada por detrás», después lo que Barrido no terminó (el guion de YouTube de
Spy, 1.4, 1.5, 1.6, 4.28), y las funciones 4.11, 4.12, 4.5, 4.8, 4.9, 4.4, 4.3, 4.13, 4.1. Martín, 14/10: «jamás que "mako" haga
cosas que no están en el flujo... Depreca absolutamente todas las cosas que MaKo haga por detrás».

## Hecho

| Qué | Dónde | Estado |
|---|---|---|
| **Spy:** un tramo de un guion de YouTube con menos de 600 caracteres por minuto va al otro modelo; si ninguno lo pasa, el más largo se guarda y dice «Puede faltar parte» | lib/ai-cheap.ts (`PISO_GUION_YT_CPM`), lib/spy-transcripcion.ts | commit `f27ef1a4`, por subir |
| **4.28:** el índice de hallazgos con una fila por área (362 → 76) y las cuatro que estaban en otra tabla | docs/hallazgos.md | commit `f27ef1a4`, por subir |
| **Nada por detrás:** la CONDITION «Es / No es el negocio número N» en todo evento de la plataforma | lib/aviso-evento.ts, lib/variables-aviso.ts | por subir |
| **Nada por detrás:** «Tareas de Reuniones al Plan» nace con «No es el negocio número 13» | lib/plantillas-automatizaciones.ts | por subir |

## Medido y sin hacer, a propósito

- **1.4** (el `visitor_id` del opt-in duplicado): YA HECHO. `app/api/track/optin/route.ts:491` lo pone en la propuesta y
  `app/crm/revisar/[id]/propuesta-lead.ts:100` lo copia (`CAMPOS_ATRIB`).
- **1.5** (cruce entre negocios en el generador de video): es de la tab Video, que otro chat acaba de rehacer. Las lecturas de
  `flow_puentes` y `flow_trabajos` en lib/flow-cola.ts filtran por `workspace_id`; no se auditó entero.
- **1.6** (la vista previa del PDF en el chat): no se sabe en qué chat era, y una pantalla nueva se copia de una app real con navegador.

## Para el Cerebro (desde la PC, con producción)

1. **Crear la fila de «Tareas de Reuniones al Plan» DESPUÉS del deploy** que trae esta tanda (nace pausada, con la exclusión del 13):
   `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --env=C:/dev/mako-api/.env.local --eventos=reunion_tareas_al_plan --aplicar`
   Prenderla es decisión de SuperAdmin, mirando el texto.

## Lo que sigue (en orden)

1. «Nada por detrás», familia Plan y objetivos: `meta-alcanzada`, `objetivo-en-riesgo`, `quarter-planificar` (cron
   objectives-vigilante, `emitirAviso` directo con el texto en el código), `tareas-autocompletadas` y `plan-proyecto-vence`. Nacían
   apagados (sin `porDefecto`): antes de mudarlos hay que medir qué negocio los tenía prendidos en /mensajes y rehacerlo con
   «Es el negocio número N».
2. Las funciones, en el orden del pedido.
