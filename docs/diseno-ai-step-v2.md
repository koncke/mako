# AI Step v2 — diseño y contrato (11/10/2026, décima tanda)

Pedido de Martín (FEEDBACK AI STEP 1-8, literal en `app/admin/dev/chatbot/bitacora.ts`, último hito): audio con su voz clonada y clonar
ahí mismo; sin «Tono»; un caso con PASOS como el CRON y «lo primero es siempre definir el OBJETIVO»; el simulador de objeciones con el
chat del medio; el hand-off y la «libertad» («no quiero que sea algo muy complejo de configurar»); dictar o grabar en el primer paso y
que la IA arme el resto; «solo permitir 1 caso por tarjeta»; y cada AI Step atado a un medio, con un toque visual de ese medio. Me pidió
que lo defina yo: no deja nada abierto; lo que decidí por él y puede dar vuelta, en §10. Base: el AI Step de la novena tanda
(docs/hallazgos-chatbot.md → «Novena tanda»): una FORMA de «Si responde» (`paso_ia`) que el motor recorre EXPANDIDA (`expandirPasoIA`).

## 1. El modelo: una tarjeta = un caso; varias tarjetas por automatización

- **Sigue siendo la forma `paso_ia` del nodo `respuesta`** (`claseDe` = 'respuesta'): hereda «sin padre, sin esperas, sin paralelos,
  cuelga del CRON». Lo que cambia es **cuántas**: hasta 10 AI Step por medio en una automatización, **cada uno con `casos` de largo 1**.
  «＋ Caso» desaparece (y con él el scroll lateral y el tacho tapado del punto 3); en su lugar, al pie del panel, «＋ Otro AI Step»
  (crea otra tarjeta del mismo medio y la abre) y el click derecho «Duplicar» deja de excluirlo.
- **El motor sigue viendo UNA «Si responde»**: `expandirPasoIA(pasos, { medio })` junta los AI Step NO sueltos de ese medio en el
  primero (por orden del array) con un caso por tarjeta, y deja a los demás en su índice como `respuesta` suelta y sin casos (inerte:
  `raizRespuesta` salta las sueltas). **No se sacan del array**: `responderConGrafo` escribe `paso_actual: indicePorId(expandido, …)` al
  retomar con «Ir a», y un hueco corre los índices. Los ids expandidos pasan a derivar de la TARJETA de cada caso (`<tarjeta>~<caso>~r`,
  `~a`); el de la primera no cambia. Sin AI Step del medio del mensaje, la automatización no contesta por ahí: `asistirRespuesta` decide
  con `raizRespuesta(expandirPasoIA(pasos, { medio }))`, no con lo guardado.
- **Campos nuevos** (todos por `camposDelFlujo`/`sanearCaso`, lib/nutricion-grafo-motor.ts — la quinta puerta; y en el tipo de
  lib/flujo-grafo.ts):

  | dónde | campo | valores | ausente = |
  |---|---|---|---|
  | nodo | `medio` | 'whatsapp' \| 'instagram' \| 'messenger' | 'whatsapp' (todo lo guardado hoy es WhatsApp) |
  | caso | `objetivo` | texto ≤ 300 | sin objetivo propio (el redactor usa el de la automatización) |
  | caso | `cualquiera` | true | entra por su `cuando` (con `true`, `cuando` no se pide ni se lee) |
  | caso | `no_contesta` | true | contesta con `responder` (guarda el texto aunque no conteste) |
  | caso | `hasta` | 'una' | hasta lograr el objetivo (la charla de siempre: 7 días, fin_bien/fin_mal/insistencia) |
  | caso | `audio` | `{ voz: 'propia' \| <voiceId> }` | responde en texto |
  | caso | `ejemplos` | ≤ 6 × `{ lead, tu }` de ≤ 500 | sin ejemplos del ensayo |

  `responder`, `sola`, `avisar` y `titulo` siguen igual. `instrucciones` (Tono) y `otra_aviso` se LEEN (lo guardado) y no se escriben
  más: el editor no los muestra.
- **Reglas** (`validarGrafo` / `erroresDelPasoIA` / `faltaEnCaso`, una sola copia para el freno y el rojo): al guardar, no mezclar
  «Si responde» de los de siempre con AI Step, y nada debajo de un AI Step (como hoy). Al publicar: cada AI Step con UN caso; nombre;
  `cuando` salvo `cualquiera`; que haga algo (contesta, o `avisar`); como mucho un `cualquiera` por medio; audio solo en WhatsApp.
  **El objetivo NO frena Publicar** (§10-A). Que la voz exista y el medio esté conectado no es puro: va en el freno async de Publicar,
  junto al «medio sin conectar» del punto 6 de FEEDBACK GENERAL (lo dicen la tarjeta, «Probar» y el freno).
- **«Otra cosa» no es una tarjeta**: lo que no encaja en ningún AI Step del medio va al de `cualquiera` si hay; si no, al aviso de
  siempre (`AVISO_OTRA_COSA`, con el primer `otra_aviso` no vacío de lo guardado) y la charla pasa a una persona
  (`charlaPasaAUnaPersona`, sin cambios).
- **Una puerta para lo viejo**: `separarPasosIA(pasos, rnd)` (pura, lib/flujo-grafo.ts) parte un AI Step de N casos en N tarjetas
  (§8). La aplican el lienzo al abrir (como `quitarIrA`), la API al escribir, «Crear con IA», «Pasar a AI Step» y el script.

## 2. El panel: cinco pasos, uno abierto a la vez (el molde del CRON)

Numerados como `pasosDisparo` del CRON: el abierto ocupa el panel, los cerrados son una línea con su resumen, y abrir uno lo desplaza a
la vista (lo mismo que pide FEEDBACK CRON 3). Una tarjeta nueva abre en el 1; una completa, en el último tocado. Textos cortos y en tú.

1. **Objetivo** — arriba, los chips del medio (WhatsApp · Instagram · Messenger; default: el canal de los mensajes de la automatización,
   si no WhatsApp). Debajo, «¿Qué tiene que lograr?» con los ejemplos que se escriben solos (`useEjemploQueSeEscribe`, hoy privado en CrearConIA, se exporta:
   «Que agende una llamada», «Que confirme la reunión»…) y el micrófono de siempre (`BotonDictar`, app/plan/board/CrearTareaModal.tsx:
   dicta en vivo, y grabar y subir de respaldo). Botón «✦ Armar el resto»: llena 2 a 4 (`armarAIStep`, §7) con la capa y el «Cancelar»
   de CrearConIA; lo armado se marca «✦» hasta que se toca. No pisa lo escrito a mano sin preguntar («¿Reemplazo lo que escribiste?»).
2. **Cuándo entra** — el nombre (40) y dos opciones: «Cuando escribe algo como…» (el `cuando`, lo que lee el clasificador) o «Cualquier
   respuesta» (deshabilitada con «Ya la tiene otro AI Step» si otro del medio la usa).
3. **Cómo responde** — «Cómo responder» (la guía). «Responde con: Texto · Audio» (Audio sólo en WhatsApp) y, con Audio, la voz (§5).
   Una línea «Tu forma de escribir · Editar» (o «Falta tu forma de escribir · Crear», en ámbar) abre `OnboardingChatAgent` con
   `soloPaso='contexto'` en un modal, sin salir: **eso reemplaza al «Tono»**, que es justo el bloque «TU TONO» de `mako.voz_guia`. Si
   hay respuestas del ensayo, un chip «3 respuestas tuyas» con ✕ para borrarlas.
4. **Libertad** — dos controles y un toggle (es todo lo que se configura del hand-off):
   - «Responde»: **Sólo te avisa** (`no_contesta` + `avisar`) · **Para aprobar** (default) · **Sola** (`sola`). Debajo, gris: «El precio
     siempre va para aprobar.» (lo hace `puedeContestarSolo`, sin copia en la pantalla).
   - «Hasta»: **Lograr el objetivo** (default) · **Una respuesta** (`hasta: 'una'`: después de la primera, la charla pasa a ti).
   - «Te aviso cada vez» (`avisar`; fijo prendido con «Sólo te avisa»).
   - Una línea gris fija: «Si no sabe qué contestar o la charla termina mal, te la paso.» (lo que ya hace el motor: «Otra cosa»,
     `fin_mal`, `insistencia`, el tope de 3 solas en 24 h y el horario 9-21 de `puedeContestarSolo`). No son opciones a propósito.
5. **Ensayar** — botón «Ensayar objeciones» que abre el modal de §4. Opcional: no frena nada.

## 3. La tarjeta en el lienzo

Alto FIJO (un caso): cabecera «AI STEP» con la estrella de MaKo (ícono de hoy) y, a la derecha, el logo del medio a 14 px; el nombre del
caso en negrita; «→ objetivo» en una línea (o «Sin objetivo», tenue); al pie los chips «avisa» / «aprueba» / «sola», 🎙 si responde en
audio y «1 vez» con `hasta: 'una'`. **El toque del medio**: una franja de 3 px arriba y el borde del chip con el color de la marca
(WhatsApp #25D366, Instagram el degradé de `logoSocialSvg`, Messenger #0084FF), puesto como `--medio` en la tarjeta (en oscuro, igual).
Del CRON sale una flecha por AI Step no suelto (`grafoDeSecuencia`: hoy dibuja una sola, a `resp`). El chip «N sin caso» de los hand-offs
va en la tarjeta `cualquiera`, o en la primera si no hay. `filasDePasoIA`/`altoPasoIA` pasan a una fila fija; `CASOS_EN_TARJETA_IA` y
«+N casos» se van.

## 4. El ensayo de objeciones: un modal central grande

- **Dónde**: modal centrado, `min(1040px, 94vw) × min(720px, 90vh)`; en el teléfono, pantalla completa. El panel lateral y «Probar»
  (560 × 400) son chicos para un chat: no se reusa ninguno de los dos. Izquierda (60 %): el chat con la piel del MEDIO del AI Step —
  `ChatHilo` (app/whatsapp/_shared) para WhatsApp, `SimuladorSocial` para Instagram/Messenger— con su composer (en WhatsApp también se
  contesta con audio: se transcribe). Derecha: el objetivo, las 4 objeciones con su avance, y el switch «Respondes tú · Responde MaKo».
- **Respondes tú** (lo que pidió): MaKo hace de LEAD con el prompt del ensayo de siempre (`setting.ensayo`,
  app/api/chat-agent/onboarding/ensayo/route.ts), con un escenario armado del caso (`escenarioDeCaso`: quién, qué le pasa, las 4
  objeciones como `evolucion` y el turno de cierre). Las objeciones salen de UNA llamada barata con el objetivo, el `cuando`, el perfil,
  el avatar y el bloque «TUS OBJECIONES» de la guía de voz. Al terminar, «Guardar respuestas» escribe los pares en `ejemplos` del caso
  POR LA EDICIÓN DEL FLUJO (`cambiar` → borrador → Publicar), no en un setting aparte: así viajan con la automatización.
- **Responde MaKo**: el lead es el mismo, y contesta el redactor con la config del caso (la ruta de «Probar»,
  app/api/chat-agent/simulador). Cada respuesta tiene «Corregir»: lo que escribas pasa a ser un ejemplo.
- No le manda nada a nadie y no gasta Claude: `CASCADA_GRATIS`, como el ensayo y el redactor.

## 5. Responder con audio (ElevenLabs, BYOK)

- **Voz**: un desplegable «Tu voz» (el clon de `video.voz`, app/video-generator/voz-cliente.ts) + las otras voces + «＋ Clonar tu voz» /
  «＋ Otra voz». Se guarda `voz: 'propia'` (se resuelve al clon VIGENTE al mandar: re-clonar no deja tarjetas viejas) o el `voiceId` de
  otra. **Otra voz** = `otras: ClonDeVoz[]` en el mismo setting, cada una con su `autorizadoAt` (sin consentimiento no se clona: la regla
  que ya está ahí).
- **Clonar ahí mismo**: un modal sobre el panel que usa la ruta que existe (`/api/onboarding/voz`: subir muestras, `action: 'clonar'`)
  más `destino: 'otra'` + nombre; grabar con el grabador de los pasos de audio o subir (4 MB por archivo, el tope real de Vercel), el
  tilde de autorización, y «Escuchar» con `decirConVoz` como prueba. Sin key de ElevenLabs: «Conectar ElevenLabs» en un modal, sin salir.
- **Al mandar** (`redactarRespuesta`): el redactor recibe «es una nota de voz: hasta 70 palabras, sin links ni emojis»; las puertas de
  siempre miran el TEXTO; `decirConVoz(voz, texto, { tope: 700 })` → `crearAudio({ transcript: texto, origen: 'ai_step' })` →
  `guardarBorradorSetter({ audioId, texto: <sólo los links, si quedó alguno> })`; `enviarBorrador` ya manda la nota de voz (Evolution
  `sendWhatsAppAudio`, `encoding: true` convierte el mp3) y el pie después. Si la voz falla o el texto no entra: **borrador en texto, no
  sale sola**, y el aviso dice por qué (nunca un respaldo en silencio). «Probar» muestra la burbuja de audio con su texto y un «Escuchar»
  que genera a pedido.

## 6. El medio

WhatsApp funciona hoy de punta a punta (número de empresa). **Instagram y Messenger** son motor nuevo: hoy una respuesta por DM sólo
PAUSA (`pausarRespuestaSocial`, lib/zernio-entrante.ts) y MaKo no tiene bandeja de Instagram desde el 06/10. Con v2: después de pausar,
`asistirRespuesta(lead, ids, texto, null, { medio })`; «Sola» manda el DM por Zernio (es respuesta: dentro de las 24 h), «Para aprobar»
manda el borrador en el aviso al grupo («Te dejé esta respuesta para mandarla tú: …») y «Sólo te avisa» igual que en WhatsApp. Sin audio.
**Los chips de Instagram y Messenger se muestran recién cuando esto esté**: la pantalla ofrece lo que el emisor hace.
**HECHO el 14/10/2026 (`c9cdbdf3a`, TikTok fase 0):** el motor contesta por esos dos canales y los chips están.

## 7. El motor: qué se reusa y qué se escribe

| pieza | estado | cambio |
|---|---|---|
| `expandirPasoIA` | se reusa | junta las tarjetas del medio; `cualquiera` → destino de `si_no`; `no_contesta` → sin «MaKo contesta»; los campos nuevos viajan en la tarjeta expandida |
| clasificador (`clasificarEscenario`, `escenariosDeRespuesta`) | igual | — |
| `responderConGrafo` | se reusa | pasa `objetivo`, `ejemplos`, `audio`, `hasta` al escenario; el `medio` del mensaje entrante |
| `redactarRespuesta` | se reusa | audio (§5); `hasta: 'una'` cierra la charla como hand-off después de contestar; el aviso nombra el caso también en borrador |
| `responderSimulador` / `bloqueEscenario` | se reusan | `EscenarioSecuencia` suma `objetivo?`, `ejemplos?`, `audio?`, `hasta?`; el objetivo del caso se SUMA al de la automatización, no lo reemplaza (`preparar` tiene texto propio) |
| `puedeContestarSolo`, `conversacionAbierta`, `charlaPasaAUnaPersona` | iguales | `HABLA_DE_PLATA` se exporta para `armarAIStep` |
| `armarAIStep(objetivo, medio, hermanos)` | nuevo | lib/ai-step-armar.ts: JSON por `CASCADA_DOCS` (los clientes sólo-Gemini), reparado con código (nunca «Sola» si habla de plata; `cualquiera` sólo si no hay otro); prompt editable `automations.ai_step.armar` |
| objeciones + `escenarioDeCaso` | nuevo | lib/ai-step-ensayo.ts; prompt editable `automations.ai_step.objeciones`; `Escenario.audio` pasa a opcional |
| audio de respuesta | nuevo | `guardarBorradorSetter` acepta `audioId`; `crearAudio` acepta `transcript` y `origen` |

## 8. Migración sin cortar envíos

1. **Deploy de código primero**, que lee v1 (un AI Step con N casos, `instrucciones`, `otra_aviso`) y v2: la expansión trata cada caso de
   un v1 como una tarjeta, así lo publicado sigue contestando igual. El lienzo separa al abrir; lo que se guarda desde ahí ya es v2.
2. **La galería en código** (lib/plantillas-automatizaciones.ts, `aiStep`): bienvenida 3, agendó-preparar 4, agendó-confirmar 5,
   no-asistió 2, reactivar 3 → una tarjeta por caso, `medio: 'whatsapp'`, con objetivo escrito a mano (tabla de §8.4).
3. **`scripts/ai-step-v2.mts`** (molde de scripts/novena-tanda-ws1.mts): SIMULACRO por default, `--aplicar` lo decide quien cierra; TODOS
   los ws (lo creado desde la galería desde el 10/10 también). Por fila con `paso_ia` en `pasos` O en el borrador (mig 0240): respaldo en
   `backups/`; `separarPasosIA` con ids nuevos de semilla fija que no chocan con la historia (`nodo_actual`, `hilos`, `nodo_id`); la
   primera tarjeta conserva el id del nodo y su primer caso; las nuevas van AL FINAL del array (la 202 de la #213 sigue en `o1`); el Tono
   se pliega adentro de cada `responder` como hoy lo pega `guiaDeCaso` («Tono: …\n…», mismo texto al redactor) y **si no entra en
   `TOPE_RESPONDER` la fila se frena**, no se corta; posiciones nuevas debajo de la original; compare-and-set sobre `updated_at`.
   **#198** (cero casos, «otra cosa» → aviso) = una tarjeta `cualquiera` + «Sólo te avisa» (mismo aviso, misma charla cerrada).
   **#213** = 4 tarjetas (el respaldo de la novena, `backups/novena-tanda-ws1-…`: «Confirma o ya vio el video», «Pregunta el precio»,
   «Pregunta por la reunión», «Quiere cambiar el día»; sin Tono). Comprobación: `escenariosDeRespuesta` antes y después da los MISMOS casos,
   `cuando`, guía y «sale sola», y el mismo `si_no`; cualquier diferencia frena.
4. **Objetivos de lo migrado** (por nombre del caso): Confirma (y «… o ya vio el video») → «Que confirme que viene a la reunión»; Pregunta el precio → «Que agende
   sin hablar de cifras» (post-agenda: «Que llegue a la reunión sin hablar de cifras»); Pregunta por la reunión → «Que sepa cuándo y cómo
   es su reunión»; Quiere cambiar el día / Quiere reagendar → «Que proponga otro día y horario»; Quiere agendar → «Que agende una
   llamada»; Quiere retomarlo → «Que vuelva a agendar»; No le interesa → «Que se vaya bien, con la puerta abierta»; Puede no calificar
   (sólo avisa) → sin objetivo. Un nombre que no está: sin objetivo y listado (no frena: §10-A).
   ⚠️ **Revisión del 11/10/2026: en lo MIGRADO esta tabla NO se escribe** (contradecía §10-A, y el objetivo viaja al redactor:
   con `--aplicar` la #213 del ws1, activa y con dos casos que salen solos, pasaba a contestar otra cosa). El script la imprime
   como sugerencia; la galería (punto 2) la sigue usando. `loQueContesta` compara ahora también el objetivo, así que un objetivo
   nuevo frena la fila.
5. ⚠️ **Volver a un deploy anterior DESPUÉS de `--aplicar` es destructivo**: el motor de antes toma la primera tarjeta como la única
   «Si responde» y los demás casos dejan de contestar sin error. Sólo vuelve atrás el respaldo.

## 9. Archivos a tocar (por parte; `lib/nutricion.ts` lo toca UNA)

- **modelo**: lib/flujo-grafo.ts (tipos, `expandirPasoIA`, `separarPasosIA`, reglas), lib/nutricion-grafo-motor.ts (`sanearCaso`,
  `camposDelFlujo`, `agregarCasoAlGrafo` → crea una TARJETA), lib/flujo-edicion.ts (`crearSuelta`, duplicar), lib/paso-ia-convertir.ts,
  lib/flujo-ia.ts (hoy «junté sus casos en una»: al revés), lib/plantillas-automatizaciones.ts, lib/chatbot-lista-filtro.ts (filtra por
  `medio`), lib/api-mako/areas/chatbot.def.ts + chatbot.run.ts (forma v2 + op `armar_ai_step`; regenera docs/api-mako.md).
- **motor**: lib/nutricion.ts (`asistirRespuesta`, `responderConGrafo`, `redactarRespuesta`, `pausarPorRespuesta` social),
  lib/setting-simulador.ts, lib/setter-conversacion.ts, lib/setting-estrategia.ts (`EscenarioSecuencia`), lib/evolution-envio.ts,
  lib/setting-audios.ts + migración numerada `setting_audios.origen` (default 'biblioteca'; `listAudios` sólo esas: si no, cada respuesta
  en audio llena la biblioteca del dueño), lib/elevenlabs.ts (`tope`), lib/simulador-grafo.ts, app/api/chat-agent/simulador/route.ts.
- **canales** (§6): lib/zernio-entrante.ts, app/api/webhooks/zernio/route.ts, lib/canal-zernio.ts.
- **panel**: app/automations/EditorPasoIA.tsx (los cinco pasos), FlujoLienzo.tsx, lib/flujo-conversacion.ts (alto fijo, menú: AI Step
  siempre salvo que haya un «Si responde» de los de siempre, `nodoNuevo('ai_step')` con medio, una flecha por AI Step),
  lib/lienzo-grafo.ts; nuevos app/automations/ModalEnsayoAIStep.tsx y VozAIStep.tsx; app/automations/PanelProbar.tsx (burbuja de audio).
- **IA**: lib/ai-step-armar.ts, lib/ai-step-ensayo.ts, app/api/automations/ai-step/{armar,ensayo,voz}/route.ts, lib/prompt-registry.ts,
  lib/chat-agent-escenarios.ts (`audio` opcional y la primera línea de `bloqueEscenario` sólo con audio).
- **voz**: app/video-generator/voz-cliente.ts (`otras`), app/api/onboarding/voz/route.ts (`destino`).
- **datos**: scripts/ai-step-v2.mts. **tests**: automations-paso-ia(-revision), plantillas-automatizaciones, flujo-ia,
  setter-conversacion y uno nuevo tests/ai-step-v2.test.ts. Roturas sugeridas: expandir sólo la primera tarjeta; `sanearCaso` sin
  `objetivo`; `separarPasosIA` con las nuevas al principio; voz caída que sale sola; dos `cualquiera` del mismo medio que publican.

## 10. Decisiones que tomé por Martín (se pueden dar vuelta)

- **A.** El objetivo va primero y lo pide la pantalla, pero **no frena Publicar**: lo migrado y lo que enseña la API no tienen uno, y sin
  él el redactor usa el de la automatización como hoy.
- **B.** «Voz del dueño» del punto 2 = «Tu forma de escribir» (`mako.voz_guia`, su primer bloque es «TU TONO»), no el clon de audio.
- **C.** Libertad en 3 niveles y «Hasta» en 2. Sin «sola en todo»: rompería «el precio siempre en borrador» (06/10).
- **D.** «Te aviso cada vez» se queda: desde la unificación, el aviso del redactor (`wa-mensaje-entrante`) sale sólo si el negocio agregó
  «Aviso cuando un lead te escribe»; el del caso es del flujo y sale siempre. El doble aviso pendiente de la novena queda en su mano.
- **E.** Instagram/Messenger en la misma tanda pero en su parte; sin audio y sin bandeja (el borrador va por el aviso).
- **F.** Las respuestas del ensayo se guardan como `ejemplos` del caso, no en el ensayo del onboarding.

## 11. Trampas que encontré leyendo (para la cosecha)

- `decirConVoz` corta en 400 caracteres con `slice`, **en silencio** (sale cortado a mitad de frase): tope explícito, y lo que no entra va en texto.
- `bloqueEscenario` del ensayo arranca «el negocio te mandó una nota de voz» y `Escenario.audio` es obligatorio: reusarlo tal cual le
  miente al modelo cuando el AI Step contesta en texto.
- Sacar del array las tarjetas que se juntan corre los índices: `responderConGrafo` escribe `paso_actual` con el índice EXPANDIDO.
- Plegar el Tono adentro de `responder` puede pasar `TOPE_RESPONDER` (2000) y el saneo CORTA el final, que es la respuesta.
- El borrador del lienzo (mig 0240) lleva la huella de lo publicado: un script que cambia `pasos` sin convertir el borrador deja la
  pestaña abierta en «desactualizado».
