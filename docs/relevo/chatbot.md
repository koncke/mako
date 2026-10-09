# Retomar: Chatbot

**Dónde quedó:** 09/10/2026, ~11:50. Cuenta `claude2`, con la cuota semanal en 93 %. La CUARTA tanda
está a medias: lo hecho está en `main` (push `9165da11`). El pedido literal de los 17 puntos está en
`app/admin/dev/chatbot/bitacora.ts` (hito del 9 oct 11:02), y las decisiones punto por punto en
`docs/chatbot-flujo-ramas-diseno.md` → «CUARTA TANDA». Lo que falta se retoma desde ahí.

## La cuarta tanda: qué está y qué falta (por número de punto)

**Hecho (en producción, sin verificar con clics):**
- **2.** El desplegable del CRON arranca en «Productos» y «Etiquetas». Sale «La que tiene puesta».
- **3 y 17.** «Probar» ya no se frena en las condiciones: sigue solo por el «Sí». Esa era la causa
  de que no salieran los mensajes. Sin botones de rama. «Probar en WhatsApp / Email» está arriba a
  la izquierda, y el «▶ Probar» del chrome se vuelve «✕ Cerrar». Es más alto: va de debajo del
  chrome hasta abajo.
- **4 y 12.** El CRON sin «Al entrar» ni «Si responde». El ＋ no ofrece REPLY ni GO TO. Los flujos
  que ya los tienen los siguen dibujando y corriendo.
- **6 (mitad).** «Confirmó la compra y no pagó» no se ofrece (`retirada` en el catálogo).
- **9.** El DELAY sólo espera; «antes de la reunión» sale del desplegable para lo nuevo.
- **10.** El ＋ con íconos SVG, los logos de WhatsApp y Gmail, la chispa de MaKo, «MaKo en
  WhatsApp», más ancho y por grupos con línea.
- **11 (mitad).** ACTION dice «Elige una acción», sin subtítulos, sin «Avisar al equipo» ni
  «Inscribir en otra automatización» (`FUERA_DEL_SELECTOR`).
- **13.** El filtro al lado del buscador, por estado y por emoji, con «Quitar filtro». El «⋯»
  abre hacia afuera.

**EN CONSTRUCCIÓN (09/10 ~12:00, cuenta `claude2` en 93 %):** Martín dijo «Continua con el resto». Un
workflow con seis partes en worktrees, cada una en su rama LOCAL `wip-v4-<parte>` (sin pushear):
`condiciones` (7, 5, 6b), `flechas` (8), `cron` (14 + el editor del CRON del punto 1 + revisar Crear con
IA), `editores` (1), `whatsapp` (15), `email` (16). Si se corta: cada rama tiene sus commits WIP; se
retoma con `resumeFromRunId: "wf_f6f9b9a0-933"` (script en `~/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main-wt-chatbot/461dd390-9e4f-44a5-810a-0e9efe9b8ae0/workflows/scripts/chatbot-cuarta-tanda-resto-wf_f6f9b9a0-933.js`; worktrees en `dashboard-marketing/.claude/worktrees/wf_f6f9b9a0-933-N`) o se termina a mano desde la rama. Después: unir en `chatbot-v2`, enchufar
los bloqueantes, aplicar la migración del CRON (0230 o la que toque) ANTES del push, suite entera, push.

⚠️ **El punto 11 (más acciones del CRM y de CS) NO va en esta tanda:** el chat «API de MaKo» las está
escribiendo en `wip/api-acciones-0910` (worktree `C:/dev/mako-api`, sin pushear): `mover_cliente_entrega_cs`,
`cambiar_acceso_curso_cs`, `invitar_cliente_curso_cs`, `mandar_link_curso_cs`, `asignar_trabajo_cliente_cs`,
`agendar_llamada_cs`, `registrar_cobro_cuota`… Cuando esa rama entre a main, se suman a `ACCIONES_DEL_FLUJO`
(lib/editor-acciones.ts) las que tengan sentido corriendo solas. Esa rama también toca `chatbot.def.ts`
(`cambiar_disparador_secuencia`): si el CRON pasa a varias etapas, ahí hay que ajustar.

**Falta (en este orden, del más chico al más grande):**
- **7. «＋ y» / «＋ o» de vuelta y sin «＋ Rama».** Cada fila nueva guarda con qué se une (`union:
  'y' | 'o'` en `FilaCondicion`, lib/flujo-grafo.ts); se evalúa con las «y» atando más que las
  «o» (`cumpleFila` / la evaluación de la rama, y el mismo cambio en lib/simulador-grafo.ts). El
  editor es `app/chatbot/EditorCondicion.tsx`. Las condiciones de antes con varias ramas se
  siguen dibujando.
- **1. Los editores de control sin aire.** CRON, DELAY, CONDITION, TAG y ACTION abren un panel de
  alto FIJO de ~420 (`MUELLE.editorAltoMax`, lib/lienzo-grafo.ts) con un selector chico arriba.
  Que el panel mida su contenido para los de control (la regla de la casa dice que un panel que
  salta de tamaño es malo: decidir un alto chico fijo para los de control, ~200, y el grande
  para WhatsApp/Email), y el selector como campo grande de ancho completo.
- **5. La reunión, una sola familia de condiciones.** El chat de CRM YA marcó qué etapas son
  reuniones (`adf1ca3d`, `kind: 'reunion'`, regla en `lib/etapa-reunion.ts`). La condición
  «Asistió / No asistió a la reunión», «Tiene reunión agendada» y «Próxima reunión en» suman
  un selector de etapas de reunión; el índice sale de `reunionesDe(stages).indexOf(etapa)`
  (0 → `r1`, 1 → `r2`; una tercera da «no sé»). Las R1/R2 de antes, `retirada`.
- **6 (la otra mitad). «No pagó la cuota N».** Hoy los hechos de pagos son `{ pagadas, vencidas }`
  (lib/condiciones-catalogo.ts, `HechosCatalogo.pagos`): hace falta leer el estado POR cuota en
  `hechosDeLeads` (lib/nutricion.ts).
- **11 (la otra mitad). Más acciones del CRM y de Customer Success.** El registro tiene UNA de CS
  (`marcar_estado_cliente_cs`). Las que faltan se declaran en `lib/api-mako/areas/cs.def.ts` /
  `crm.def.ts` (mover en el kanban de entrega, sacar de una automatización, dar o quitar acceso
  al curso) y después entran a `ACCIONES_DEL_FLUJO` (lib/editor-acciones.ts).
- **16. Email:** «De» con los remitentes vinculados y «Vincular nuevo»; sin «Vista previa» ni el
  ojo; modo HTML; el pie de baja con el nombre del NEGOCIO (no «MaKo»; el link de baja se queda);
  el «{ }» y el emoji en la barra de formato. `app/chatbot/EditorEmailGmail.tsx`, `lib/email-html.ts`.
- **15. WhatsApp con varios mensajes por tarjeta:** «Enviar» suma la burbuja y vacía la barra;
  lápiz y papelera visible (con 5 s de deshacer) por burbuja; sin transcripción; «{ }» al lado del
  clip; «✦ MaKo» al lado del título; elegir el número de salida con «Vincular nuevo». Es un cambio
  de MODELO (el paso tiene un solo cuerpo + audio + archivo): o una lista de partes en el paso
  (que pase por `setSecuenciaPasos` y el motor las mande en orden), o tarjetas encadenadas.
  `app/chatbot/EditorMensajeWhatsApp.tsx`, lib/nutricion.ts.
- **8. Varias flechas por resultado de una condición** («Sí» y «Si no» con sus flechas en
  paralelo). Toca el modelo (`paralelos` por rama) y el motor de hilos (lib/nutricion-hilos.ts):
  al resolver la rama, arrancan sus hilos.
- **14. El CRON con varias etapas.** `nutricion_secuencias.etapa` es UNA: hace falta una columna
  (migración ANTES del deploy), que el motor inscriba por cualquiera, el desplegable con selección
  múltiple, y que Crear con IA elija todas las de entrega cuando el pedido habla de un alumno.
  Revisar también el flujo que Martín creó con IA («felicitar a un alumno que terminó una clase»).
- **Verlo con clics** en producción, la tercera y la cuarta tanda.

## Lo que espera a Martín (no cambió)

- La key de Gemini de la plataforma está bloqueada por Google.
- Activar #221/#222 (pausando 212, 213 y 198) y el disparador de #224.
- Lo de las tandas anteriores, abajo.

## La tercera tanda (para contexto)

### Lo que se hizo (pedido del 9 oct 02:05, en la bitácora)

Hecho: el editor mediano (WhatsApp en una columna, sin «Revisar antes de enviar»), «Ir a» fuera del
＋ y de la IA, el CRON por producto → adquisición/entrega → etapa (sin «Eventos»), títulos en inglés
y tarjetas con cara de WhatsApp y de Gmail, la tarjeta MAKO (aviso al grupo con datos del lead), el
emoji del título, los «⋯» de la lista (activar, duplicar, eliminar), «Nueva» al instante, el
catálogo de 48 condiciones por sección filtrado por el CRON (el motor las evalúa en batch), el email
con el editor rico de las lecciones (HTML saneado), «Probar» por canal (teléfono o bandeja Gmail) y
frenado si falta algo, «Publicar» apagado sin cambios, las acciones en una lista corta con un
control por campo (monto y motivo sólo para Ganado/Perdido), y Crear con IA arreglado (Groq entra
con un pedido compacto) con la caja del Plan, dictado en vivo, placeholder animado y la capa con
Cancelar.

Falta: verlo con clics; lo demás está en `docs/hallazgos-chatbot.md` → «Lo que quedó sin hacer».

## La segunda tanda (para contexto)

### El hilo

El pedido de Martín del 08/10 a la noche, 11 puntos. Están literales en
`docs/chatbot-flujo-ramas-diseno.md` → «SEGUNDA TANDA» y en `app/admin/dev/chatbot/bitacora.ts`.
Lo que quedó, punto por punto:

1. **Un solo CRON.** «Si responde» es la segunda fila de la tarjeta CRON («Al entrar» / «Si
   responde») y cuelga de ella. Ya no hay tarjeta fantasma.
2. **Flechas en paralelo** desde el CRON y desde cualquier mensaje, acción o espera. Cada una es un
   hilo que corre a la vez (`hilos` en la inscripción). El freno de 20 h y los topes son por canal, y
   la ventana 9-21 va en la zona del negocio.
3. **El editor de WhatsApp es apaisado**: el chat a la izquierda y el composer a la derecha, en una
   franja abajo del lienzo.
4. **Email tipo Gmail**: De (el remitente del workspace, con aviso si es sandbox o está apagado),
   Para, Asunto, Vista previa y cuerpo con B/I/S. A la derecha, el mail abierto con el mismo render
   que sale. «✉️ Email» está en el ＋.
5. **Dos familias de tarjetas.** Las de control (condición, esperar, etiqueta, ir a) son compactas y
   teñidas, y la espera es una píldora. El CRON tiene su ícono (⏰).
6. **La tarjeta de etiqueta** (🏷️ + / −) se edita con una frase: «[Poner ▾] [etiqueta ▾]».
7. **El editor de acción, simplificado**: un desplegable por secciones con buscador («Más usadas»,
   «Con este lead», una por área, «Avanzado»), una línea de qué hace, lo opcional plegado, y sin los
   campos que llena el flujo.
8. **«Probar» ancho y bajo**, arriba a la derecha. Recorre los hilos con reloj virtual y muestra el
   email como un mail.
9. **Auditoría de ManyChat**: `docs/chatbot-auditoria-manychat.md`. Trae lo que hacemos mejor, lo
   que hacíamos mal (y qué se arregló), lo que falta en orden, lo que decide Martín y lo que no hay
   que copiar.
10. **Secuencias de los clientes, creadas EN PAUSA** (09/10, ~01:40). No se tocó ninguna prendida:
    - ws1: **#221** «Agendó: confirmar y preparar» (reemplaza a 212 y 213, pone la etiqueta
      «Confirmó», que se creó), **#222** «Bienvenida con email» (reemplaza a 198; sus «Ir a» van a
      #221), y la **#220** suma «Si responde» (sigue apagada).
    - ws13: **#223** «Agendó: confirmación de auditoría», con el WhatsApp y el email EN PARALELO desde
      el CRON, y **#224** «No asistió: reagendar auditoría», todavía sin disparador (queda en «A
      mano»): la etapa «noresp» de sus leads no existe en su embudo.
    - Las especificaciones están en `docs/relevo/chatbot-secuencias.json`.
    Para Código Inmobiliario quedó hecho lo que pidieron: el aviso «Nuevo agendado» trae teléfono,
    email y las respuestas del formulario de Cal.com, que ahora se guardan en la ficha.
11. **Crear con IA.** «＋ Nueva» crea una automatización vacía y pausada y abre la caja del pedido. El
    modelo es Gemini o Groq gratis, nunca Claude. Las tarjetas aparecen de a una, y el ✦ de las
    herramientas pide cambios (sólo agrega). El wizard de 9 pasos se borró.

La revisión adversarial reportó 38 hallazgos: 32 confirmados, los 32 arreglados con test. Suite:
5938 tests, 0 rojos.

## Lo que falta

- **Mirarlo en un navegador en producción.** Nada de la tanda se vio con clics (bootear local
  escribe en prod). La lista de qué mirar está en `docs/hallazgos-chatbot.md` → «Lo que quedó sin
  hacer».
- **El disparador de la #224** (no-show de Código Inmobiliario): su embudo tiene lead, agenda,
  ganado, st0, manual y reactivación, y no tiene «noresp». Hay que sumar la etapa o usar
  `no_show_j1`, que exige leads abiertos, y ninguno de sus 14 no-shows lo está.
- Los pendientes técnicos chicos están en `docs/hallazgos-chatbot.md`.

## Lo que espera a Martín

- **Activar las secuencias nuevas**: pausar 212 y 213 y activar la #221. Para la #222 (que
  reemplaza a la 198), el email del ws1 tiene que estar prendido y el remitente no puede seguir
  siendo «MaKo». La copia nueva («voy a liberar el espacio» 4 h antes, «no vio el video», «puede no
  calificar») sale como borrador hasta que la mires.
- **Código Inmobiliario no tiene canal** hacia sus leads: la línea está desconectada y el email sale
  del sandbox.
- **Decisiones mías de la tanda (con su default)**, en el diseño:
  - una respuesta pausa todos los hilos;
  - el «Ir a» de «Si responde» retoma uno;
  - dos hilos de WhatsApp se permiten, y el freno los espacia;
  - los topes de 40 por día y 6 por corrida son sólo de WhatsApp, y el email tiene 100 por día;
  - «Si responde» cuelga sólo del CRON;
  - las flechas en paralelo de una tarjeta borrada pasan a la que la reemplaza.
- **Guardar la zona del ws1** (`mako.timezone` = America/Tijuana): hoy decide con Ciudad de México.
- **De la auditoría**: varias acciones por tarjeta o una; «Si responde» con tiempo límite; guardar lo
  que el lead contesta en un campo.
- **Las cuatro de la primera tanda que siguen sin respuesta**: el espejo etiqueta↔etapa, la
  sincronización de email, las esperas en horas y días, y que archivar apague.
