# Mapa del Ops Center · experimentos-closing

Parte de [docs/ops-center-principal.md](../ops-center-principal.md) (20/10/2026), y es lo que pidió su Anexo C (puntos A.1 y A.2): las dos áreas que
quedaron afuera de los 8 mapas. Las mapeó el chat Dashboard el 20/10/2026, en sólo lectura sobre `dashboard-bloques`
(con origin/main del 20/10). Lo «sin verificar» no se afirma.

**Chat responsable:** Dashboard, las dos. Experiments se retiró el 17/10: un experimento es un elemento de la hoja que
propone «Editar con MaKo» (docs/hallazgos-graficos.md, «Experiments se retiró…»). Closing Analyst es la hoja
`/dashboard?hoja=closing`, la herramienta del closer. El follow-up por WhatsApp después de una llamada va con CRM. Lo
transversal (clasificador, bloques, confirmar adentro) es de Ops Center 3, como en los otros mapas.

**Tabs:**
- /dashboard: el elemento «Experimento» de la hoja (propuesta → «Arrancar» → antes/ahora en vivo → «Concluir»), y
  «probemos X» en «Editar con MaKo»
- /dashboard?hoja=closing: la hoja Closing (ranking, factores, embudo, tendencia) y la ficha de una llamada
  (`?llamada=<recording_id>`), con su resultado y sus puntajes
- /experimentos, /analisis y /closing: sólo redirigen al Dashboard

**Hoy:** 28 acciones · sí 11 · parcial 14 · no 2 · sin verificar 1.

## Cómo se midió

Con el turno real del canal app (`clasificarIntencion` → `herramientasDelChat`), ws 9, una frase natural por operación,
como admin y como miembro (closer o setter). «Llega» quiere decir que la herramienta viaja en el turno. Para las acciones
no alcanza: además tiene que confirmarse adentro del chat.
- Como admin llegan 13 de 28. Como miembro llegan 6 de 28 (las de Experimentos son sólo del admin: `rolMinimo: 'admin'`).
- **El freno es el mismo de los otros mapas: el clasificador.** Las 9 acciones de Experimentos y de la Retro caen en
  «capturar (dudosa)», salvo `borrar_retro`: arrancá, cerrá, descartá, aceptá, posponé. «probemos un anuncio con
  testimonio» también cae en «capturar», aunque en el panel «Editar con MaKo» del Dashboard es justo la frase que arma
  el experimento (ese panel tiene su propio motor y no pasa por este clasificador).
- Closing: lo que se pregunta (panorama, ranking, pendientes) llega. Lo que se pide «analizá», «redactá», «corregí» o
  «abrime» llega en «pensar» o «capturar», sin su herramienta.

## Acciones

| Acción | Operación de la API | Hoy | Falta | Bloque en el chat | Tam. |
|---|---|---|---|---|---|
| Experimentos · Ver los que están en curso | listar_experimentos, vista_experimentos | si | bloque | Lista de experimentos con su estado y «Abrir en el Dashboard» | S |
| Experimentos · Ver uno: hipótesis, métrica, antes y ahora | ficha_experimento, medicion_experimento | si | bloque | El elemento «Experimento» de la hoja (ElementoExperimento.tsx): antes → ahora | S |
| Experimentos · Lo aprendido (las verdades del negocio) | listar_conclusiones_experimentos, estado_experimentos | si | bloque | Lista de conclusiones con su experimento | S |
| Experimentos · Qué métricas se pueden medir | catalogo_metricas_experimento, snapshot_funnel_experimentos | si | nada |  | S |
| Experimentos · «probemos X»: pasar una hipótesis a experimento | sugerir_experimento | parcial | herramienta | La propuesta del experimento con «Crear» | S |
| Experimentos · Que MaKo proponga qué probar | idear_experimentos | si | bloque | Elegir entre 3 experimentos | S |
| Experimentos · Crear uno | crear_experimento (pantalla) | parcial | herramienta, confirmacion, bloque | La propuesta con sus campos editables y «Crear» adentro del chat | M |
| Experimentos · Arrancarlo (mide el baseline) | iniciar_experimento | parcial | herramienta | Tarjeta con la métrica y el baseline que va a medir | S |
| Experimentos · Concluirlo con el veredicto | cerrar_experimento | parcial | herramienta | Antes y después, con el veredicto | S |
| Experimentos · Descartarlo | descartar_experimento | parcial | herramienta |  | S |
| Experimentos · Que aparezca en una hoja (uno creado por la API o de antes del 17/10) | null | no | herramienta | «Agregar a la hoja…» | S |
| Retro · Ver las corridas y su reporte | listar_retros, ficha_retro, plan_retro | parcial | herramienta, bloque | El plan de la Retro con sus ítems | S |
| Retro · Rendición de cuentas de la última | seguimiento_ultima_retro | si | bloque |  | S |
| Retro · Si el Perro deja correr una, y los huecos de medición | estado_gate_retro, cobertura_datos_retro, destacados_periodo_retro | sin_verificar | nada |  | S |
| Retro · Aceptar, posponer, descartar o deshacer un ítem del plan | aceptar_item_plan_retro, posponer_item_plan_retro, descartar_item_plan_retro, deshacer_item_plan_retro | parcial | herramienta, bloque | El ítem con sus tres botones | S |
| Retro · Borrar una | borrar_retro (pantalla) | parcial | confirmacion | Tarjeta roja con el período y «No se puede deshacer» | S |
| Retro · Correr una nueva | null | no | herramienta, motor | Trabajo largo que termina en el reporte | M |
| Closing · Cómo vienen las llamadas | panorama_closing, tendencia_score | si | bloque | Gráfico vivo de la hoja Closing | S |
| Closing · Ranking de closers | metricas_closers | si | bloque | Tabla del ranking (la de la hoja) | S |
| Closing · Qué decide los cierres | factores_cierre | parcial | herramienta, bloque |  | S |
| Closing · Embudo R1 → R2 → cierre | embudo_closing | parcial | herramienta, bloque | El embudo de la hoja | S |
| Closing · Llamadas analizadas y su detalle | listar_llamadas_analizadas, detalle_llamada, llamadas_lead | parcial | herramienta, bloque | La ficha de la llamada (FichaLlamada.tsx) con «Abrir en el Dashboard» | M |
| Closing · La transcripción | transcript_llamada | si | bloque | Visor de la transcripción | S |
| Closing · Las que no se pudieron analizar | llamadas_pendientes_o_con_error, estado_analisis_lead, lead_tiene_llamada | si | nada |  | S |
| Closing · Marcar el resultado de una llamada | marcar_resultado_llamada | si | nada |  | S |
| Closing · Corregir los puntajes | corregir_puntajes_llamada (pantalla) | parcial | herramienta, confirmacion | Los puntajes de antes y los de después | S |
| Closing · Re-analizar las llamadas de un lead | analizar_llamadas_lead (pantalla) | parcial | herramienta, confirmacion, bloque | Trabajo largo que termina en la ficha | M |
| Closing · Enganchar grabaciones de Fathom a leads / el follow-up de la llamada | adjuntar_grabaciones_fathom (pantalla), redactar_followup_post_llamada (pantalla) | parcial | herramienta, confirmacion, bloque | El borrador del follow-up (el de CRM) / la lista de grabaciones con su lead | M |

## La inteligencia del chat de esta área

QUÉ TIENE QUE LEER ANTES DE ACTUAR.
- Experimentos: `catalogo_metricas_experimento` antes de crear (una métrica que no está en el catálogo no se adivina:
  docs/hallazgos-graficos.md), y `listar_experimentos` para no proponer otro igual al que corre.
- Closing: `lead_tiene_llamada` antes de hablar de la llamada de un lead, y `estado_analisis_lead` antes de re-analizar
  (cuesta IA).

QUÉ PREGUNTA EN VEZ DE INVENTAR.
- Qué métrica mide el experimento y por cuánto tiempo, si no se dijo.
- Cuál llamada, si el lead tiene más de una.
- El veredicto al cerrar un experimento: lo dice la persona, MaKo propone con el antes y el ahora.

QUÉ NO HACE NUNCA.
- No arranca un experimento sin el baseline medido, ni lo cierra sin mostrar antes y ahora.
- No corrige puntajes ni re-analiza sin confirmación (los dos cambian lo que ve el closer).
- No le muestra a un closer lo de otro closer: la regla de la hoja Closing (`informeDeRol`, el closer ve SÓLO su hoja).
- No manda un follow-up: lo redacta, y lo manda la persona (es de CRM).

QUÉ REUSAR.
- Piezas: app/dashboard/ElementoExperimento.tsx, app/dashboard/entidades/FichaLlamada.tsx, la hoja Closing de
  lib/graficos-plantillas.ts.
- La regla de quién ve qué en Closing: `hojaDeRol` / `informeDeRol` (lib/graficos-plantillas.ts).

## Bloques nuevos

- El elemento «Experimento» en el hilo (antes → ahora, «Arrancar» / «Concluir»), con «Abrir en el Dashboard»
- La ficha de una llamada en el hilo, con su resultado y sus puntajes
- El plan de una Retro, con aceptar / posponer / descartar por ítem

## Decisiones para Martín (las de esta área)

- ¿El closer y el setter usan el Ops Center para su hoja Closing? Hoy les llegan 6 de 28 (es la misma pregunta del mapa
  de Plan, Calendario y Dashboard).
- La Retro se retiró con Experiments el 17/10, pero sus 10 operaciones siguen en el registro. ¿Se corre una Retro desde
  el chat, o se retira también de la API?

## Piezas, en orden

| Pieza | Hecho = | Depende de | Tam. |
|---|---|---|---|
| 1. Las frases de esta área al clasificador: «probemos X», arrancá, cerrá, descartá, aceptá, posponé, corregí, analizá, redactá, abrime el análisis | Las 28 frases de esta medición traen su operación en el canal app (hoy 13), y el closer recibe las de Closing | 1.2 (lo lleva MaKo WhatsApp con Ops Center 3) | S |
| 2. Confirmar adentro: `crear_experimento`, `borrar_retro`, `corregir_puntajes_llamada`, `analizar_llamadas_lead`, `adjuntar_grabaciones_fathom` y `redactar_followup_post_llamada` | Ninguna de las seis devuelve un link a `/mako/revisar`; se confirman en la tarjeta | 1.10 | M |
| 3. Agregar a una hoja un experimento que no tiene elemento (creado por la API o de antes del 17/10) | «poné el experimento del precio en mi hoja» lo agrega; está en el registro | 2.6 | S |
| 4. Los bloques: el experimento, la ficha de la llamada y el plan de la Retro | Cada uno con «Abrir en el Dashboard» | 1.7 | M |
