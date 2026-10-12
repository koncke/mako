# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 12/10/2026 ~07:55 (hora de Argentina) por la cuenta 3, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

**La v5 está terminada, pusheada y EN PRODUCCIÓN** (el feedback de 24 puntos del 11/10 a la noche, textual en
`app/admin/dev/dashboard/bitacora.ts`): sin «Bloques de MaKo» (los 17 del informe de Mauricio se migran solos al
abrirlo, en el saneo), un solo «Filtro» + búsqueda tipo Ctrl+F, pop-ups configurables, «Conclusiones de MaKo»
(IA gratis), sección/desplegable, conectores, gráficos gordos, mapa de cualquier país, hojas VSL/CS/Chat Analyst
(sin el desplegable «Analysts»), el setter con sólo Chat Analyst (también en el teléfono), la Landing rápida y el
mapa de calor en vivo.

- Contrato de la tanda (decisiones y modelo): [dashboard-v5.md](dashboard-v5.md).
- Verificado antes del push: typecheck 0, `npm test` 8.667 con 3 rojos que son de `main` y no de esto
  (`plan-proyectos-catalogo`: falta la familia «Customer Success» en el catálogo; `plan-filtro-cliente` y
  `mover-etapa-validacion`), build verde, la migración del informe de Mauricio en memoria sin fallas (sólo
  lectura), y humo en Chrome (ws9): sin errores, sin bloques, las tres rutas viejas redirigen.
- El deploy del push quedó en Error (`git_info_fail`, también el push anterior de Offer); se destrabó por la API
  con el token del dueño (`dpl_5HDXDD7frUZhkegSssbp1TSpWyqn`, Ready 12/10 08:28). Cómo: `docs/hallazgos-infra.md`.
- Migraciones 0260 (`dashboard_ia_elementos`), 0261 (`retencion_vsl_resumen`) y 0262 (ubicación de las visitas)
  **aplicadas en prod** antes del push.
- Lo aprendido: `docs/hallazgos-graficos.md` → «La v5» (y api-mako, landing, infra, mobile).

**Lo que Martín tiene que mirar en producción** (no se vio con sus datos): la hoja Closing de Mauricio ya migrada
(que los gráficos que reemplazan a los bloques se lean bien), las tablas que antes eran «tabla de barras» (punto
20), y el mapa de calor en vivo de su landing.

**Después (12/10 ~12:00):** Buscar, Filtro, Editar y ⋮ en una sola fila de la topbar (`editor-css.ts`, `.lk-top-der`), y quien
nunca guardó un informe arranca con la pantalla de siempre y «＋ Nuevo Dashboard» en el medio del lienzo (`page.tsx` `sinPaginas`, `EditorInforme` `enBlanco`; la
primera que crea es la única). ⚠️ El teléfono (`/m/dashboard`) todavía le muestra Marketing y Comercial fijos a
quien no tiene informe: falta aplicarle lo mismo.

## Lo que falta

0. **LO PRIMERO — «¿Qué vas a crear hoy?» en lugar de «Pídeselo a MaKo», y copiar un dashboard con un token.**
   Pedido de Martín (12/10, textual, por el chat Chatbot): «pasale la sección de "¿Qué vamos a hacer hoy?" al chat
   de graphics para que lo implemente tal cual en lo que se tiene hoy de "Pídeselo a MaKo". Tiene que ser
   funcional, es decir, que los dashboards también deberían poder copiarse y enviarse con ese token». No se
   empezó (la cuenta 3 estaba al 97% semanal). Lo que ya existe en main desde `14e06b45`:
   - La caja compartida: `app/landing-generator/CajaPedido.tsx` (título, placeholder animado, «+», micrófono,
     enviar). La montan `app/landing-generator/CajaCrear.tsx` y `app/automations/CrearConIA.tsx`. Va en lugar
     de «Pídeselo a MaKo» de `app/dashboard/NuevaHoja.tsx`.
   - El «+» de Automations: «Subir archivo o imagen» (`app/automations/archivo-pedido-cliente.ts`,
     `app/api/chat-agent/secuencias/archivo/route.ts`, que lee con `lib/archivo-a-texto.ts`) y «Pegar un flujo».
   - El token: «Copiar flujo» crea `MAKO-FLUJO-…` en la tabla `flujo_copias` (mig 0265, con
     `workspace_origen`, RLS + revoke); pegarlo muestra «Flujo copiado: <nombre>» y lo crea en este negocio.
     Código: `app/automations/copia-flujo-cliente.ts`, `lib/flujo-copia.ts`, `lib/flujo-copia-negocio.ts`, las
     acciones `copiar_flujo`/`leer_copia` de `app/api/chat-agent/secuencias/route.ts`. Para el Dashboard: el
     mismo patrón con prefijo propio (`MAKO-DASH-…`) y la misma tabla generalizada o una propia (a decidir). Ojo:
     una hoja copiada a OTRO negocio lleva sólo la definición (gráficos, filtros, textos), nunca datos ni
     personas, y los filtros fijos sobre valores del negocio de origen (un closer, una campaña) no valen allá.
   - `app/_ui/BotonMako.tsx` ahora dibuja el logo de MaKo, y eso cambió también los botones de MaKo del Dashboard.
1. **Borrar el código muerto de los bloques** (ya no se dibuja ninguno): la lista exacta de qué está muerto y qué
   hay que mudar está en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer», primer punto.
2. **Avisarle al chat «Chatbot»** el estado final del área Dashboard de la API (lo espera para cablear ⚡ Acción):
   sin `leer_bloque_dashboard` ni el parámetro `bloque`; nuevas `conectar_componentes_dashboard`,
   `quitar_conector_dashboard`, `leer_conclusiones_dashboard` y `generar_conclusiones_dashboard` (ésta cuesta IA y
   es lenta). Y el aviso «El AI Analyst terminó» con hoja, resumen, hallazgos y link SEPARADOS en `datos`.
3. **Textos sueltos de Landing Analyst** (nota de `lib/model-catalogo.ts`, encabezado de `lib/landing-writer.ts`,
   `docs/diseno-editor-landing.md`).
4. **Sin usar y sin borrar** (lo decide Martín): `PulsoPaginas.tsx` + su ruta y su lib; `ScriptsBrowser` y
   `GuionesFull` (~900 líneas muertas en `app/ads-analyst/ScriptsBrowser.tsx`).
5. **Defaults de Mauricio en Ads Writer** (no son del Dashboard): `DEFAULT_ANGLES` (lib/script-angles.ts),
   TAG_VOCAB y los umbrales de lib/ads-analyst-patrones.ts se aplican a todos los negocios.

Uso semanal de la cuenta 3: 86% el 12/10 ~07:45 (se reinicia el 14/10 06:00 de Argentina).
