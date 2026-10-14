# Hallazgos de Automations, ex Chatbot (/automations: el flujo con ramas)

Lo que hay que saber antes de tocar el lienzo de /automations (ex /chatbot: la tab se renombró el
09/10/2026 y la ruta vieja redirige), su motor, «Probar» o el conversor de las secuencias de antes.
Las entradas fechadas antes del renombre nombran la ruta como era. El área es dónde vive el código:

- el modelo: `lib/flujo-grafo.ts` y `lib/flujo-legado.ts`;
- el motor: `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts` y los demás `lib/nutricion-*.ts`;
- el lienzo: `lib/flujo-conversacion.ts`, `lib/lienzo-grafo.ts`, `app/_components/Lienzo.tsx`,
  `app/automations/FlujoLienzo.tsx` y `app/automations/SecuenciaPerfil.tsx`;
- «Probar» y la página: `lib/simulador-grafo.ts`, `lib/prueba-paso.ts`, `app/automations/PanelProbar.tsx`,
  `app/automations/SimuladorWhatsApp.tsx`, `app/automations/ChatAgentApp.tsx` y
  `app/api/chat-agent/simulador/route.ts`;
- la biblioteca de archivos: `lib/setting-adjuntos.ts` y `lib/setting-adjuntos-reglas.ts`.

El composer de WhatsApp (`app/whatsapp/_shared/`), la biblioteca vista desde el bucket y las
etiquetas del teléfono están en [hallazgos-comunicacion.md](hallazgos-comunicacion.md); las
etiquetas del CRM, en [hallazgos-crm.md](hallazgos-crm.md). Lo de antes del rediseño (el modo
asistido, el recordatorio, la reagenda) sigue en hallazgos-comunicacion.md → «Las seis tarjetas
del Chatbot en paralelo». El diseño y el pedido literal de Martín (los doce puntos del
08/10/2026) están en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md).
**No es un changelog.**

*Origen: el rediseño del 08/10/2026, cuenta 2. Cinco partes en paralelo (corrida
`wf_8096a9d7-b3f`: **P** página y «Probar», **C** composer, **L** lienzo, **E** etiquetas, **M**
motor), una revisión adversarial (`wf_c1c0d3d3-ae3`: 43 hallazgos, 42 confirmados, 1 refutado) y
sus arreglos (`wf_92e4c306-856`). Entre corchetes, quién lo vio: la parte, o el id del hallazgo de
la revisión.*

## Lo que más muerde

- **Un flujo nunca pasa por `legadoAGrafo`, y tener ids no lo hace un flujo.** El conversor arma la
  salida recorriendo el array en fila: sobre un flujo con ramas las aplasta → [El modelo](#el-modelo).
- **La entrada es `raizSalida`, nunca `pasos[0]`, y «lo que sigue» sale de los puertos, nunca de
  `pasos.slice`.** Debajo, en el array, puede haber otra rama → [El motor](#el-motor).
- **«Otra cosa» cierra la CHARLA, no el estado.** Congelar en 'handoff' «como antes» deja la
  inscripción sin salida; no cerrar nada deja a MaKo contestando solo mientras le habla una persona
  → [El motor](#el-motor).
- **La LIMPIEZA de la estrategia no es inerte.** `logrado: 'ninguno'` cambiaba lo que MaKo le
  escribía al lead y lo dejaba sin post-agenda al reagendar → [El modelo](#el-modelo).
- **Lo que la pantalla afirma sale de la regla del motor.** La casilla «Revisar» pintaba «sale sola»
  y el motor dejaba un borrador → [El lienzo](#el-lienzo).
- **«A mi WhatsApp» le escribía al cliente**, y el arreglo obvio (`getPerfil`) devuelve al admin del
  cliente → [«Probar» y la página](#probar-y-la-página).
- **Un escritor que no sabe de ramas aplana un flujo SIN ERROR**: una lista es un flujo válido.
  `armarSecuenciasDeAudios` (onboarding) lo hacía en cada carga sobre #198/#212/#213 →
  [Escritores que no saben de ramas](#escritores-que-no-saben-de-ramas-aplanaban-un-flujo-sin-error-cosecha).

---

## El modelo

### «Volver al principio» dejaba la salida sin raíz: un salto no es un padre [P]

**Síntoma:** un flujo que termina en «Ir a» la PRIMERA tarjeta (el «volver al principio» de
ManyChat, con una espera en el medio) pasaba `validarGrafo` sin un error y su salida no arrancaba
nunca. Medido: `[m1 → esperar 1 día → ir_a m1]` daba `raiz = null` y `errores = []`, y «Probar»
mostraba «Sin tarjetas».

**Causa:** `raizSalida` salteaba todo nodo que fuera destino de un salto, y el destino era justo la
raíz. `validarGrafo` contaba los destinos de salto como alcanzables, así que no marcaba nada suelto.

**Regla:** la raíz se elige por PUERTOS: el primer nodo que ningún puerto apunta y que no es «Si
responde». Ser destino de un «Ir a» no lo descarta, y un salto tampoco salva a una tarjeta suelta:
a la que sólo se llega saltando es una segunda salida que nadie dibuja. Arreglado en la base
(`ebdb5003`).

**Vive en:** `lib/flujo-grafo.ts` (`raizSalida`, `validarGrafo`) · `tests/flujo-grafo.test.ts`

### Tener ids no es ser un flujo, y un flujo nunca pasa por `legadoAGrafo` [P, L, M]

**Síntoma:** tres partes lo vieron por separado. Un flujo con ramas que traía algo de antes encima
(un `delay_horas` que volvió a poner la API de MaKo, o la estrategia todavía sin limpiar) se habría
vuelto a convertir: el lienzo lo mostraba en una sola fila y «Probar» le sumaba un segundo «Si
responde» con los casos viejos.

**Causa:** `legadoAGrafo` arma la salida recorriendo el ARRAY en fila y pisa `siguiente`: sólo
sirve para listas. Y `tieneLegado` miraba la estrategia y los `delay_horas` aunque los pasos ya
fueran un grafo.

⚠️ **El atajo obvio, «si tiene ids ya es un flujo» (`esGrafo`), es el equivocado.**
`setSecuenciaPasos` le pone `id: o<i>` y `siguiente` explícito a toda lista de antes en el primer
guardado: una lista guardada tiene ids y sigue siendo una lista que se puede convertir.

**Regla:** la pregunta es `esFlujoExplicito`: hay una tarjeta de control, o algún `siguiente` que no
es el elemento siguiente del array. Sobre un flujo, `tieneLegado` contesta false y `legadoAGrafo`
devuelve los pasos normalizados sin tocarlos. Si en un flujo queda algo de antes en un PASO, se
marca en la tarjeta y el motor lo sigue haciendo; si queda en la ESTRATEGIA, se limpia al publicar.
Vale para el lienzo, «Probar» y `scripts/migrar-secuencias-a-grafo.mts`.

**Vive en:** `lib/flujo-legado.ts` (`esFlujoExplicito`, `tieneLegado`) ·
`app/automations/SecuenciaPerfil.tsx` · `lib/simulador-grafo.ts` (`flujoParaProbar`)

### La LIMPIEZA conserva el logro: `logrado: 'ninguno'` parecía inerte y no lo era [motor-4, motor-8, lienzo-8]

**Síntoma:** después de convertir #212 y #213, el lead que contestaba quedaba en 'respondio' para
siempre: cuando reagendaba no le salía la post-agenda de la reunión nueva (decisión del 06/10:
«también con reunión nueva») y además bloqueaba la otra mitad. Y el redactor de «MaKo contesta» le
escribía otra cosa que antes, para el mismo caso.

**Causa:** la limpieza pisaba `desenlace.logrado` con 'ninguno'. Con 'respondio', `evaluarDesenlaces`
era lo único que cerraba como lograda la inscripción del que contestó; y `responderSimulador` le
dice al modelo cuándo se cumplió el objetivo con ese mismo campo («esta secuencia no cierra sola» en
vez de «el lead contesta cualquier cosa»).

**Regla:** `limpiezaPara(est)` conserva `logrado` y apaga sólo lo que ahora hacen las tarjetas: la
etapa, el «sigue con» y el fallo por silencio. Con `agendo`/`pago` en un flujo, `evaluarDesenlaces`
no interrumpe: lo hacen las condiciones. Y **sin estrategia no hay nada que limpiar**:
`estrategiaConLimpieza(null)` le inventaba `objetivo: 'agendar'` a una secuencia que no tenía
ninguno, y desde ahí `encadenar()` salteaba a todo lead que ya había agendado. Si una función recibe
null y tiene que «limpiar», devuelve null y quien llama no escribe nada.

**Vive en:** `lib/flujo-legado.ts` (`limpiezaPara`) · `lib/flujo-conversacion.ts`
(`estrategiaConLimpieza`) · `lib/nutricion-desenlace.ts` · `lib/setting-simulador.ts`

### Lo que el conversor genera tiene que existir en el registro [lienzo-2]

**Síntoma:** una secuencia de antes con «Termina si… → etapa» se abría con tarjetas «Acción
mover_lead_etapa» (el id crudo) y no se podía publicar: «"mover_lead_etapa" no es una acción de
MaKo». El script de migración las escribía igual, porque sólo corre `validarGrafo`.

**Causa:** `OP_MOVER_ETAPA` era un nombre que ningún `.def.ts` declara, y `validarGrafo` mira la
forma, no las operaciones.

**Regla:** la operación es `proponer_cambio_etapa`, y un test pasa por `porId` + `esAccion` cada
operación que genera `legadoAGrafo`. Lo que un conversor escribe se valida contra lo que el motor
ejecuta, no contra lo que el conversor cree (`b6f43009`).

**Vive en:** `lib/flujo-legado.ts` (`OP_MOVER_ETAPA`) · `lib/nutricion.ts` (`setSecuenciaPasos`) ·
`tests/flujo-grafo.test.ts`

### Se convierte lo que el motor LEE: la estrategia parseada [M]

**Síntoma:** convertir desde la estrategia CRUDA inventaba casos y desenlaces en secuencias cuyo
motor no los ejecutaba.

**Causa:** `parseEstrategia` devuelve null si falta `objetivo`, y el motor lee la parseada: una
cruda sin objetivo, para él, no es asistida ni tiene desenlace.

**Regla:** `legadoAGrafo` recibe la estrategia PARSEADA, la limpieza va sobre la parseada y el
objeto se guarda entero.

**Vive en:** `scripts/migrar-secuencias-a-grafo.mts`

### Trampas menores del modelo

- **Los ids `n…` son aleatorios a propósito; los `o<n>` son estables** [M]. `nuevoId` no reusa el id
  de un nodo borrado (una inscripción parada ahí seguiría por la tarjeta nueva). Por eso un dry-run
  del script se compara con lo aplicado por los `o<n>` y por la forma, nunca por los ids nuevos.
- **«Ir a» sólo entra en una salida VACÍA** [L]. `insertarNodo` no le cuelga a un salto lo que
  había en ese lugar: insertado en el medio de una flecha, dejaba suelto todo lo que seguía. Lo
  valida `insertarDesdeLienzo`, no sólo el menú del ＋.
- **`textoFila` escribe en días las horas múltiplo de 24 desde 48** [L]: «72 h» sale «3 días». Para
  comparar el texto de una fila, `textoFila` o un número que no sea múltiplo de 24.

---

### Escritores que no saben de ramas aplanaban un flujo sin error [cosecha]

**Síntoma:** encontrado al cosechar, DESPUÉS de convertir en producción #198/#212/#213 (por suerte
antes de que se abriera el onboarding): esas secuencias podían volver a ser una lista de uno o dos
pasos sin que nada avisara, y con la estrategia ya limpia se perdían «Si responde» y sus casos.

**Causa:** `armarSecuenciasDeAudios` (`lib/secuencias-audios.ts`) corre en CADA carga del paso del
onboarding (`GET /api/chat-agent/onboarding/resumen`) y en la operación `armar_secuencias_de_audios`,
y hacía `.update({ pasos: plan.pasos })` directo, sin `setSecuenciaPasos`. ⚠️ El diagnóstico de la
parte del motor («los escritores sin guarda pasan por `setSecuenciaPasos`, lo peor es un 400») era
cierto para /email y falso para éste. Y aunque hubiera pasado por `setSecuenciaPasos`, no habría
fallado: **una lista lineal es un flujo VÁLIDO**, así que `validarGrafo` no tenía nada que objetar.

**Dónde:** `lib/secuencias-audios.ts` (`audiosDeLaListaEnElFlujo`), `lib/nutricion.ts`
(`setSecuenciaPasos` → `puedePisarFlujo`), `lib/flujo-legado.ts`, `tests/flujo-grafo.test.ts`.

**La regla:** sobre un flujo de tarjetas (`esFlujoExplicito`) nadie escribe la lista entera.
Re-grabar un audio le cambia el `audio_id` a su tarjeta (`o<k>`, el id que conserva la conversión) y
nada más. Y la red general está en `setSecuenciaPasos`: si lo guardado es un flujo y lo nuevo no
trae ni un id, se rechaza con «se edita en /chatbot» (el lienzo manda siempre sus ids). Un escritor
nuevo de `pasos` que arme la lista de cero choca con esa red en vez de aplanar en silencio.

## El motor

### La entrada es `raizSalida`, nunca `pasos[0]`, y el índice se traduce en UNA puerta [M, motor-10, lienzo-1]

**Síntoma:** tres caras del mismo dato. Una inscripción que nunca avanzó (`paso_actual` 0,
`nodo_actual` NULL) quedaba parada en «Si responde» cuando el lienzo dejaba esa tarjeta primera en
el array. Un lead de la rama A cuyo nodo se borró recibía el mensaje de la rama B. Y una inscripción
de antes del deploy con `paso_actual = 1`, sobre una #212 publicada desde el lienzo, leía
`pasos[1]` del array nuevo, que es el audio que ya había recibido: le salía otra vez.

**Causa:** `paso_actual` es un ÍNDICE del array, todo lo que inscribe escribe 0, y con ramas el
array cambia de orden en cada conversión o borrado.

**Regla:** `indiceActual` es la única puerta. `nodo_actual` que existe → ése; que ya no existe → -1
(se cierra con rastro); NULL con `paso_actual` 0 → la entrada (`raizSalida`); NULL con k > 0 →
primero el id `o<k>` (el que `legadoAGrafo` conserva) y sólo después el índice. El primer envío al
inscribir lo programa `pasoDeEntrada`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`indiceActual`, `indiceEntrada`, `pasoDeEntrada`) ·
`lib/nutricion.ts` (`procesarEnvios`, `planificarEnvios`, `pausarPorRespuesta`) ·
`tests/flujo-motor-grafo.test.ts`

### «Lo que viene después» sale de los puertos y de los saltos, nunca del array [M]

**Síntoma:** la regla del canal apagado («¿queda algo enviable después?») contestaba sobre lo que
había más abajo en el array.

**Causa:** ⚠️ el diagnóstico obvio («miremos el resto de los pasos») era el equivocado: con ramas,
lo de abajo puede ser OTRA rama que este lead no va a recorrer.

**Regla:** todo «después» sale de `puertosDe` y de los «Ir a» a una tarjeta (`alcanzablesDesde`),
nunca de `pasos.slice(i + 1)`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`alcanzablesDesde`) · `lib/nutricion.ts` (`canalOn`)

### En la misma corrida sólo se avanza por lo que no es un mensaje [M]

**Síntoma:** si después de un mensaje se miraba lo que seguía en la misma corrida (`otraVuelta`),
un segundo mensaje pegado quedaba en «saltado: msg <20h» en cada envío.

**Causa:** `leadsConEnvioReciente` se recalcula por lote leyendo la base y ve el envío que se acaba
de hacer.

**Regla:** en la misma corrida se resuelve sólo lo que no es un mensaje (condición, espera,
acción); otro mensaje sale en la corrida siguiente, como siempre.

**Vive en:** `lib/nutricion.ts` (`avanceDesde`)

### «Otra cosa» cierra la CHARLA, no el estado [motor-3, M]

**Síntoma:** en #212/#213 convertidas, el lead escribía algo fuera de guion, «Otra cosa» avisaba, el
dueño se ponía a hablarle a mano… y al mensaje siguiente («listo, confirmo el martes») MaKo le
contestaba solo por el caso «Confirma», en medio de la charla de una persona.

**Causa:** `responderConGrafo` escribía `conversacion_ultima_at` en TODA rama, así que la charla
quedaba abierta y `seguirCharla` la retomaba. Antes la inscripción pasaba a 'handoff' y
`conversacionAbierta` la excluía.

⚠️ **Las dos salidas obvias eran las equivocadas.** Volver a congelar en 'handoff' «como antes»
deja la inscripción sin salida: `avisar_al_equipo` no crea fila en `chat_agent_handoffs` (nadie la
puede resolver), `evaluarDesenlaces` saltea 'handoff', `inscripcionReusable` la cuenta como no
terminada (bloquea la post-agenda al reagendar, la misma clase de bug que la limpieza) y
`resolverHandoff` reactiva sin `proximo_envio_at`, que la cola no levanta nunca. Y cerrar con
`conversacion_cierre = 'handoff'` no se puede: el CHECK de la 0203 sólo admite fin_bien, fin_mal e
insistencia.

**Regla:** un hand-off nuevo cierra la CHARLA: `conversacion_cerrada_at` puesto y
`conversacion_cierre` null EXPLÍCITO (`undefined` quiere decir «no se leyó»). Lo lee
`cerradaPorUnaPersona`, y el motivo sale del ÚLTIMO cierre (`f33578dc`). Si algún día el CHECK suma
'handoff', cambian a la vez los dos escritores y `cerradaPorUnaPersona`. Medido el 08/10: 0
cierres en toda la base.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/setter-conversacion.ts`
(`cerradaPorUnaPersona`, `conversacionAbierta`) · `supabase/migrations/0203_charla_del_setter.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### Un aviso deduplicado no es un aviso que salió [motor-1]

**Síntoma:** en #212, a las 37 h salía la tarjeta «no confirmó» (`avisar_al_equipo`, dedup por lead
12 h). Si dos horas después el lead escribía algo fuera de guion, «Otra cosa» avisaba… y el aviso
se descartaba por dedup. MaKo no contestaba y Mauricio no se enteraba. Y el aviso decía «Te
escribió algo que no sé contestar», sin el mensaje.

**Causa:** `avisoDelFlujo = true` se marcaba ANTES de correr la acción y sin mirar si salió, y eso
apagaba el aviso de respaldo, el único con el texto del lead. Las dos tarjetas usaban el mismo tipo
y la misma clave. El hand-off de antes mandaba el texto literal, sin dedup y con otro tipo.

**Regla:** se marca sólo si la acción emitió de verdad. Como `aplicarEnElActo`
(`lib/api-mako/flujo.ts`) descarta los `datos` del resultado, la señal viaja en el PREFIJO del
resumen (`AVISO_REPETIDO`): una constante que comparten el runner y el motor, con test, nunca una
comparación con texto libre. Y el aviso de «Otra cosa» lleva el texto del lead y una clave por
respuesta.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/nutricion-grafo-motor.ts`
(`AVISO_REPETIDO`, `avisoSalio`) · `lib/api-mako/areas/chatbot.run.ts` (`avisar_al_equipo`)

### Saltar a otra automatización no reinicia lo terminado [motor-2]

**Síntoma:** el «Sigue con» convertido (`ir_a { secuencia_id }`, #198 → #212) le reenviaba la
secuencia entera a un lead que ya la había completado, quizás para la misma reunión. Apuntando a sí
misma, era un bucle que reenviaba todo en cada vuelta.

**Causa:** el motor lo resolvía con `inscribirEnSecuencia`, que aplica las reglas de la inscripción
MANUAL («lo terminado se puede volver a arrancar»). Antes, `encadenar()` cortaba ante cualquier fila
previa.

**Regla:** desde un flujo, `inscribirEnSecuencia` va con `desdeFlujo`: cualquier fila previa es «ya
estuvo» y además mira `hitoYaHecho`. Un «Ir a» a la propia automatización se rechaza al guardar
(`irAEstaMisma` en `setSecuenciaPasos`: `validarGrafo` no sabe el id de la secuencia).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-inscripcion-manual.ts` · `lib/nutricion-grafo-motor.ts`
(`irAEstaMisma`)

### Un mensaje fijo de «Si responde» se reclama por (inscripción, nodo) [motor-5]

**Síntoma:** «Otra cosa» → «¡Gracias! En un rato te respondo» se repetía con cada mensaje del lead
durante los 7 días de la charla, sin anti-ban ni tope.

**Causa:** `mandarMensajeDeRespuesta` no tenía reclamo; la acción sí (`reclamarEspaciado`).

**Regla:** antes de mandar, `reclamarEspaciado` por (inscripción, nodo) con 20 h. El costo
aceptado: el reclamo va antes de mandar (la regla de la casa), así que un envío que falló también
ocupa la ventana, y el aviso lo dice («ya salió (o se intentó)»).

**Vive en:** `lib/nutricion.ts` (`mandarMensajeDeRespuesta`)

### Sólo un MENSAJE sube por las condiciones hasta la espera anclada [motor-6, M]

**Síntoma:** con «1 día antes de la reunión → condición → mensaje», si el lead movía la reunión
salía «Mañana es tu reunión» cuatro días antes, o para una reunión cancelada.

**Causa:** `minutosAntesDeReunion` miraba sólo el padre directo, que era la condición: el mensaje
quedaba sin anclar, sin re-anclaje y sin cierre por reunión pasada.

⚠️ **«Subir por todos los padres que no esperan» era el arreglo equivocado:** subiendo también
desde una ACCIÓN, la acción del logro («ya pagó → muévelo»), que cuelga de la condición, quedaba
anclada y se postergaba hasta la reunión nueva.

**Regla:** sólo un mensaje sube por las condiciones hasta la primera espera; una acción mira su
padre directo.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`minutosAntesDeReunion`) · `lib/nutricion.ts`

### Sin la 0223, el webhook se comía la primera respuesta, y tirar ante cualquier error era peor [motor-9, M]

**Síntoma:** desplegado sin la 0223, `pausarPorRespuesta` marcaba la inscripción 'respondio'
(columnas viejas: sale bien) y después `getSecuenciasConStats` pedía `etiqueta_id` y fallaba; el
`catch` se la tragaba. Sin borrador ni aviso, y aplicar la 0223 después no la recuperaba. La
cabecera de la 0223 decía «falla cerrado, nada se pierde» mirando sólo el cron.

**Causa:** PostgREST rechaza la consulta ENTERA si falta una columna, y el orden era marcar → leer.

⚠️ **El arreglo obvio (leer antes de marcar y tirar ante cualquier error) empeoraba otro caso:** ante
un error pasajero el lead quedaba 'activa' y la corrida siguiente le mandaba el próximo mensaje de
prospección a alguien que acababa de contestar.

**Regla:** se tira sólo cuando FALTA UNA COLUMNA (42703 o PGRST204: `esColumnaInexistente`);
cualquier otro error pausa como siempre. Una TABLA que falta es otra cosa (PGRST205 o 42P01:
`esTablaInexistente`) y sí se tolera donde se lee `crm_lead_etiquetas`. «does not exist» aparece en
los dos mensajes: una regex floja confunde columna con tabla. Y la migración va antes del deploy;
un script que lee la columna nueva la prueba al arrancar y con `--aplicar` se niega sin ella. Las
trampas de PostgREST, en [hallazgos-infra.md](hallazgos-infra.md).

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`) · `lib/nutricion-grafo-motor.ts`
(`esColumnaInexistente`, `esTablaInexistente`) · `supabase/migrations/0223_flujo_grafo.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### El disparador por etiqueta sin horario es SÓLO el evento [etiquetas-1, datos-1, motor-7]

**Síntoma:** poner una etiqueta en lote, o por el espejo de una etapa, no disparaba en el acto (lo
promete el diseño: «una acción en lote no dispara»)… y en la corrida horaria siguiente el barrido de
la cohorte inscribía a todos los que la tenían: 150 leads, 40 por día por la línea no oficial,
delante de la post-agenda.

**Causa:** `leadsConEtiqueta` devolvía todas las filas de `crm_lead_etiquetas` sin mirar quién la
puso, y una secuencia sin horario da `toca: true` en cada corrida.

⚠️ **El mismo mecanismo salió CONFIRMADO dos veces y REFUTADO una (motor-7) en la misma
revisión.** No se contradicen: el refutador juzga la AFIRMACIÓN, no el mecanismo. «Barre a perdidos
y a leads de hace meses» era una decisión escrita en el código («SIN FILTRO, a propósito»); «el
lote dispara por la puerta de atrás» contradecía una promesa de la pantalla.

**Regla:** sin horario, una secuencia por etiqueta corre SÓLO por el evento; con horario, el barrido
alcanza a los que la tienen, porque eso eligió el dueño al poner el horario. Vive en
`barridoInscribe`. Si Martín quiere que «Se le puso X» sin horario alcance a quien ya la tenía, es
una decisión suya.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`barridoInscribe`) · `lib/nutricion.ts`
(`comprometerInscripciones`, `leadsConEtiqueta`) · el lado de las etiquetas, en
[hallazgos-crm.md](hallazgos-crm.md)

### Elegir un disparador no toca el producto: ausente no es null [motor-11]

**Síntoma:** cambiar el disparador de una secuencia con producto a un evento o a una etiqueta le
escribía `funnel_id: null`, que es «todos los embudos»: la próxima corrida inscribía leads de todos
los productos.

**Causa:** `pedidoDisparo` no manda `funnel_id` para esos disparadores, y la ruta convertía el
ausente en null.

**Regla:** ausente = no se toca; `funnel_id: null` explícito = todos los embudos. La ruta distingue
`'funnel_id' in body`. Hoy no afecta a ninguna fila (0 secuencias con `funnel_id`, medido el 08/10).

**Vive en:** `app/api/chat-agent/secuencias/route.ts` · `lib/setting-secuencias.ts`
(`setTriggerSecuencia`) · `lib/flujo-conversacion.ts` (`pedidoDisparo`)

### Un mensaje que pasa a archivo o a voz suelta sus variantes [costuras-1, C]

**Síntoma:** un paso de texto con variantes (las que escribe MaKo al armar la secuencia) pasaba a
PDF con el caption «Te dejo la info 👇», y a 3 de cada 4 leads les llegaba el PDF con un texto viejo
como caption; con el caption vacío, a todos. «Probar» mostraba el bueno (`p.cuerpo`), así que la
prueba no lo detectaba.

**Causa:** `pasoAMedia` no tocaba `variantes`, y `textoDelPaso` sólo cortaba el sorteo para un
audio.

⚠️ **«El editor no manda el cambio» era el diagnóstico equivocado:** el editor sí manda
`variantes: []`; el merge de `setSecuenciaPasos` trata un `[]` igual que la clave ausente y repone
las guardadas.

**Regla:** `textoDelPaso` devuelve `cuerpo` para audio y archivo; `pasoAMedia` y `pasoAVoz` dejan
`variantes: []`; el «↻ N» sólo se dibuja en un mensaje de texto. Y un merge que conserva un campo
cuando «no viene» separa ausente (`undefined`) de vacío (`[]`), o la persona no puede borrar ese
campo nunca. Esa última mitad NO está hecha (ver abajo).

**Vive en:** `lib/nutricion-canal.ts` (`textoDelPaso`) · `lib/guion-audio.ts` (`pasoAMedia`,
`pasoAVoz`, `cambiosDePaso`) · `app/automations/EditorMensajeWhatsApp.tsx` · `lib/nutricion.ts`
(`setSecuenciaPasos`)

### Las guardas de texto del motor anclaban en la forma del modelo viejo [M]

**Síntoma:** al pasar el motor al grafo se pusieron rojos 29 tests sin un solo bug de
comportamiento.

**Causa:** las guardas anclaban en expresiones literales del modelo de antes:
`sec.pasos[insc.paso_actual + 1]`, `insc.paso_actual === 0 && sec.antiguedad_max_horas`,
`.update({ pasos: limpio`, el cuerpo entero de `asistirRespuesta`.

**Regla:** antes de cambiar el modelo de un motor, se grepean sus anclas en `tests/`, y se ancla en
funciones o constantes con nombre (`topeAntiguedad`, `avanceDesde`, `anclada`), no en la forma de
una expresión. Dos más del mismo día:
- la guarda `/linea:/` no ve una propiedad abreviada (`{ …, linea }`): en las llamadas que una
  guarda cuenta por texto, la propiedad va explícita (`linea: c.linea`);
- `tests/nutricion-canal.test.ts` mide el tramo entre `const limpio = pasos` y `const { error } =`
  con un tope de 4000 caracteres: las validaciones nuevas de `setSecuenciaPasos` van ANTES de
  `const limpio`.

Y una del typecheck: `filtros: (q) => q.not(...) as ConsultaPaginada` dio TS2589 («Type
instantiation is excessively deep») en `hechosDeLeads`; con `.not` va sin el cast, como en el resto
del repo.

**Vive en:** `tests/antiguedad-cableada.test.ts` · `tests/setter-conversacion.test.ts` ·
`tests/lineas-whatsapp.test.ts` · `tests/nutricion-canal.test.ts` · los `tests/nutricion-*.test.ts`

---

## El lienzo

### Lo que la casilla pinta como heredado sale de la regla del motor [costuras-3, L]

**Síntoma:** en una secuencia que sale sola, «＋ caso» en «Si responde» creaba el «MaKo contesta»
con la casilla «Revisar antes de enviar» destildada (promete que sale sola), y el motor dejaba un
borrador: el lead no recibía respuesta hasta que alguien la aprobara.

**Causa:** el editor pintaba `paso.revisar ?? !envio_automatico` para cualquier mensaje; para un
`tipo: 'ia'` de «Si responde», el motor exige `revisar === false` estricto (`escenariosDeRespuesta` →
`contestaSolo`). Y `agregarCaso` creaba el mensaje sin `revisar`.

**Regla:** el valor heredado sale de la MISMA regla del motor (`revisarHeredado`, que llama a
`saleSolo` y a `escenariosDeRespuesta`, los dos puros), fijado con un test de MATRIZ que compara lo
que se pinta contra lo que hace el motor. La matriz no caza el valor con el que NACE un caso (pone
`revisar` a mano en cada vuelta): hacen falta los dos tests, el del nacimiento y el de la herencia.
`agregarCaso` crea con `revisar: true`, como el conversor.

**Vive en:** `lib/flujo-conversacion.ts` (`revisarHeredado`, `agregarCaso`) ·
`app/automations/FlujoLienzo.tsx` · `lib/nutricion-grafo-motor.ts` (`saleSolo`)

### Una tarjeta se nombra con lo que dibuja, y el error abre la tarjeta [L, lienzo-6]

**Síntoma:** primero, las tarjetas recién agregadas se publicaban vacías y los errores nombraban ids
(`n0abcde`). Después del primer arreglo, Publicar decía «Falta completar "Mensaje 4"» y ninguna
tarjeta lleva número: era la segunda «MaKo contesta».

**Causa:** `validarGrafo` mira la forma y no el contenido, y escribe con ids. `nombreDeTarjeta`
numeraba por el orden del array contando todas las clases de mensaje.

**Regla:** Publicar corre `validarGrafo` y después `faltaEscribir`, antes del PATCH. Una tarjeta se
nombra con su título visible más un trozo de lo que dice, y el título lo calcula UNA función que
usan el árbol y los errores (`tituloDeTarjeta`). Todo error, propio o del server, pasa por
`errorLegible`, que se come el sustantivo de `validarGrafo` («la condición X»; si no, queda «la
condición "Condición"»). Y el error ABRE la tarjeta culpable (`tarjetaDelError`).

**Vive en:** `lib/flujo-conversacion.ts` (`faltaEscribir`, `nombreDeTarjeta`, `tituloDeTarjeta`,
`tarjetaDelError`, `errorLegible`) · `app/automations/SecuenciaPerfil.tsx`

### Una tarjeta con salidas tiene alto FIJO: se mide por partes [L, costuras-7]

**Síntoma:** la nota de voz se cortaba: ni el pie (el link) ni el «Dice: …» se veían nunca, así que
una nota con link se veía igual que una sin link.

**Causa:** el punto de cada salida lo dibuja el lienzo AFUERA de la tarjeta, contado desde el pie
(`yDePuerto`). Por eso una tarjeta con `puertos` tiene alto fijo (`nodo.alto`) y `overflow: hidden`:
si creciera con su contenido, cada flecha saldría de la fila de al lado. Y el layout puro no sabía
si el audio tenía transcripción.

**Regla:** lo que se pinta adentro tiene que caber en el alto estimado; si no cabe, se ajusta la
estimación (`altoDeMensaje`, por partes y con las constantes de los estilos que la dibujan), nunca
el alto de la tarjeta. Lo que el layout puro no sabe le llega por una opción (`audioDe`).

**Vive en:** `lib/lienzo-grafo.ts` (`yDePuerto`, `ALTO_PUERTO`, `PIE_PUERTOS`) ·
`app/_components/Lienzo.tsx` (`TarjetaNodo`) · `lib/flujo-conversacion.ts` (`altoDeMensaje`)

### Una lectura que falla no es una lista vacía: la biblioteca tiene tres estados [costuras-6, costuras-11]

**Síntoma:** toda tarjeta de archivo decía «(no disponible)», o «document (no disponible)» sin
caption, sobre un PDF sano. Y una etiqueta archivada en una condición salía «Una etiqueta que ya no
está»: el dueño la reemplazaba creyendo que se había borrado.

**Causa:** la tarjeta le pasaba a `BurbujaHilo` un archivo con `url: null`, y la burbuja dice «(no
disponible)» siempre que falta la url. Y el lienzo pedía `/api/crm/etiquetas` sin `archivadas=1`.

**Regla:** la biblioteca se lee con tres estados (ok / error / cargando) y sólo «ok sin el id»
afirma que falta: con `[]` ante un error, la tarjeta diría «Un archivo que ya no está». Lo que se
busca por id para NOMBRARLO se pide incluyendo lo archivado. `GET /api/chat-agent/adjuntos` es sólo
para admin: un setter ve «Archivo».

**Vive en:** `lib/flujo-conversacion.ts` (`vistaDeArchivo`) · `app/automations/FlujoLienzo.tsx` ·
`app/automations/SecuenciaPerfil.tsx`

### Un guard de layout mide el ANCLAJE, no sólo que nada se pise [L]

**Síntoma:** el test «dos ramas no se pisan» seguía en verde con el bloque de ramas mal medido.

**Causa:** ⚠️ el diagnóstico obvio era el equivocado: ese error no produce solapes, porque el
apilado igual suma lo que cada subárbol sube por encima de su tope. Lo que rompe es el CENTRADO: el
bloque baja y las ramas de arriba dejan de estar arriba del puerto.

**Regla:** un guard de layout mide qué queda centrado contra qué. «No se pisan» lo garantiza el
apilado aunque la cuenta esté mal.

**Vive en:** `lib/flujo-conversacion.ts` (`bloque`, `medir`, `colocar`) ·
`tests/flujo-conversacion.test.ts`

### Con «Probar» abierto, la tarjeta a editar caía debajo del teléfono [lienzo-4, L]

**Síntoma:** al tocar una tarjeta con «Probar» abierto, la vista se corría hasta dejarla debajo del
panel; sin «Probar», se corría a x = 1024 y se cortaba contra el borde.

**Causa:** `vistaConPanel` hacía `panelAncho + margen * 2` con `margen = 12 + insetIzq`: el inset
izquierdo se contaba dos veces, y no había límite a la derecha.

⚠️ **El límite derecho ENMASCARA el error doble:** con «Probar» abierto el límite corta antes y el
test pasa igual; la rotura sólo se ve en el caso sin «Probar». Un límite nuevo se prueba también
donde no actúa.

**Regla:** un margen que ya incluye un inset no es simétrico: el borde libre se calcula una vez
(inicio + ancho + separación) y todo corrimiento lleva el tope del otro lado (`insetDer`). Es la
regla de AGENTS.md «Apoyar algo sobre el borde de un lienzo», del lado derecho.

⚠️ **Y el comentario del panel miente.** Dice que `panelAncho` es ancho de CONTENIDO, y
`app/globals.css` tiene `* { box-sizing: border-box }`: es el ancho exterior, y el `+ 30` del
`maxWidth` le saca 30 px de más en ventanas angostas. El reporte de construcción de L afirmaba lo
contrario; el de los arreglos leyó el reset global y lo desmintió. Antes de razonar sobre el modelo
de caja de una pieza compartida, se mira el reset global.

**Vive en:** `lib/lienzo-grafo.ts` (`vistaConPanel`) · `app/_components/Lienzo.tsx` (el `maxWidth` del
panel del nodo)

### Todo cambio sube como función del estado anterior, y «es tipear» es una propiedad del cambio [L, costuras-9, lienzo-7]

**Síntoma:** el composer manda dos cambios en el mismo tick (`onChange({ tipo })` y `onModoIA(on)`) y
el segundo pisaba al primero, cada uno con su foto de deshacer. Y tipear una variante apilaba una
foto por tecla: a los 30 caracteres se perdía la foto de antes de borrar una rama.

**Causa:** las closures de un mismo render ven los mismos `pasos`; y `soloTexto` aceptaba sólo
`cuerpo` y `asunto`.

**Regla:** todo cambio sube como FUNCIÓN del estado anterior (`onPasos(fn, apilar)`), con UNA foto
por tick (una bandera que limpia `queueMicrotask`); un cambio que no pasa por `onPasos` no se
deshace. «Es tipear» es mismo campo y misma forma (mismo largo de la lista): agregar o quitar una
variante sí apila (`cambioApila`).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` (`onPasos`, `fotoAntes`) · `lib/flujo-conversacion.ts`
(`cambioApila`) · `app/automations/FlujoLienzo.tsx`

---

## «Probar» y la página

### El simulador corre el MISMO dato con las MISMAS funciones que el motor [P]

**Síntoma:** «no puedo interactuar para probarlo de verdad» (punto 10 del pedido).

**Causa:** ⚠️ el diagnóstico obvio (un bug de UI: el composer tapado, el chat en `readOnly`) era la
mitad. El simulador viejo recorría `pasos` con su propio orden (todos los de WhatsApp, también los
que se excluyen entre sí), resolvía variables con su propio reemplazo y contestaba con un setter
libre. La #198 tiene 0 casos: en producción toda respuesta iba a hand-off y MaKo callaba, y en el
simulador MaKo contestaba igual.

**Regla:** «Probar» usa `raizSalida`, `siguienteDe`, `claseDe`, `clasificarEscenario` con
`escenariosDeRespuesta` y el redactor de producción (`responderSimulador`); las variables, con
`aplicarVariables` y los ejemplos del catálogo. Sin «Si responde» dice «MaKo no contesta», que es lo
que pasa en producción. Y prueba lo de la PANTALLA: re-elegir en la lista la misma automatización
vaciaba la edición local y volvía a lo publicado [lienzo-5].

**Vive en:** `lib/simulador-grafo.ts` (`flujoParaProbar`, `iniciar`, `siguiente`, `elegir`) ·
`app/automations/PanelProbar.tsx` · `app/automations/SimuladorWhatsApp.tsx`

### Todo destino «a mi…» sale de la fila propia de la sesión [P, lienzo-3]

**Síntoma:** «A mi WhatsApp» venía precargado con el contacto de reportes del workspace. En el ws1
es el de Mauricio: si Martín probaba el flujo de un cliente, la prueba le llegaba al cliente, bajo el
rótulo «Tu número».

**Causa:** `user_telefono` y `user_email` son el contacto de REPORTES del workspace, no de quien
mira.

⚠️ **El arreglo obvio era el equivocado:** `getPerfil()` (`lib/perfil.ts`), con un admin parado en
un workspace ajeno, devuelve el perfil del ADMIN DEL CLIENTE (`usuarioDelPerfil`, «viendo como
cliente»): justo la persona a la que no hay que escribirle.

**Regla:** el destino sale de la fila PROPIA de la sesión (`getUsuarioActual`, y si no,
`buscarUsuarioPorEmail(sesion.email)`); sin fila propia, vacío. El campo es editable, el interruptor
nace apagado y el destino NO se guarda nunca (guardarlo cambiaría a dónde le llegan los reportes al
dueño). El primer mensaje real lleva «🧪 Prueba de MaKo», decidido en el server.

**Vive en:** `lib/simulador-grafo.ts` (`destinoDelQueMira`) · `app/api/chat-agent/simulador/route.ts`
(GET `?destino=1`) · `lib/perfil.ts` · `tests/chatbot-probar.test.ts`

### Lo que se repite SOLO no se reenvía; lo que dispara quien prueba, sí [datos-4, P]

**Síntoma:** con «A mi WhatsApp» prendido, un flujo mensaje → esperar → «Ir a» el mismo mensaje
mandaba unos 21 WhatsApp idénticos en segundos por la línea no oficial: el simulador no espera y
repite hasta `TOPE_SALTOS = 20`. Y la ruta mandaba texto libre a cualquier número, sin tope.

**Causa:** el envío real colgaba de cada mensaje dibujado, y el server no contaba.

⚠️ **Un Set por tarjeta habría silenciado respuestas legítimas:** en «Si responde» la misma «MaKo
contesta» corre en cada turno con un texto nuevo.

**Regla:** lo que se repite solo (un «Ir a» que vuelve, en la salida o en el mismo turno) no se
reenvía; lo que dispara quien prueba (un mensaje nuevo como lead) sí: la clave lleva el turno
(`debeSalirDeVerdad`). Y el server topea por destino: N por ventana se arma con N casilleros de
`reclamarEspaciado`, que es un compare-and-set sobre UNA marca por clave (`reclamarCupoPrueba`); se
reclama después de los chequeos que pueden cortar, y si el conteo falla no se manda. Costo: hasta 11
filas de `app_settings` por destino probado, que nadie limpia.

**Vive en:** `lib/simulador-grafo.ts` (`debeSalirDeVerdad`, `reclamarCupoPrueba`) · `lib/prueba-paso.ts` ·
`app/automations/PanelProbar.tsx`

### Un pedido de abrir algo desde afuera baja como OBJETO y se aplica al dibujar [costuras-5, P]

**Síntoma:** el link del aviso de hand-off (`/chatbot?sec=<id>`, «súmalo como caso en "Si
responde"») abría el wizard de 9 pasos, donde no hay «Si responde».

**Causa:** el ancla del deep link era de cuando el wizard era el editor.

**Regla:** el pedido baja como un objeto nuevo por pedido (comparado por identidad: el mismo id dos
veces vuelve a abrir) y se aplica AL DIBUJAR con el patrón de estado previo, no en un efecto (un
efecto pinta primero la primera de la lista). `tests/chatbot-probar.test.ts` cruza el
`linkApp('/chatbot?<param>=')` de `lib/chat-agent-handoff.ts` con el `params.get` de la página: si
el aviso cambia de parámetro, el test cae.

**Vive en:** `app/automations/ChatAgentApp.tsx` · `app/automations/SimuladorWhatsApp.tsx` (prop `abrir`) ·
`lib/chat-agent-handoff.ts`

### La pantalla ofrece lo que el emisor hace, nada más [P]

**Síntoma:** en el recordatorio de la reunión dibujado como tarjetas, «quitar un toque» parecía una
capacidad natural.

**Causa:** el emisor no la tiene: guarda sólo los textos propios (uno vacío vuelve al de fábrica) y
recorre siempre los tres toques (1440, 60 y 15 min).

**Regla:** un «quitar» que el emisor ignora es un botón roto. Para apagar un toque, primero el
emisor (un `apagado` por toque en el setting) y después la tarjeta. La pantalla escribe por la MISMA
ruta y la MISMA clave (`chatbot.recordatorio_reunion`): mudarla de lugar no lo apaga ni lo duplica.

**Vive en:** `app/automations/RecordatorioFlujo.tsx` · `lib/recordatorio-lead.ts` ·
`lib/reunion-recordatorio.ts`

### Trampas menores de «Probar»

- **Un documento va con `nombreArchivo` y el caption aparte** [costuras-8]: sin eso, `ChatHilo` usa
  el texto como nombre del archivo y el caption no sale.
- **`PanelProbar.tsx` conserva a propósito un `eslint-disable` de react-hooks** (el efecto de
  montaje): con eso el React Compiler saltea el componente entero (ver
  [hallazgos-ui.md](hallazgos-ui.md)).

---

## Las costuras entre las partes

### Repartir por archivo dejó capacidades sin enchufar [revisión, integración]

**Síntoma:** de los 42 confirmados de la revisión, 11 eran «costuras»: cosas que cada parte hizo
bien y que se cayeron entre dos. La más cara, una regresión: el lienzo dejó de pasarle `paraGuion`
al editor y «✦ guion» perdió objetivo, gancho y preguntas (en un negocio sin link de agenda, todo
guion que dijera «agendemos» volvía a terminar en «Prueba de nuevo»). Además, la prop `handoffs` de
`SecuenciaPerfil` nació con cero call sites (la marca de «Otra cosa» no se veía hasta `1b0e2515`),
`SecuenciaDto` no declaraba `etiqueta_id`, `EstrategiaWizard` quedó huérfano y
`app/admin/dev/areas.ts` no conocía los archivos nuevos (`75402dd7`).

**Causa:** la forma del reparto, ya escrita en AGENTS.md («repartir trabajo por archivo garantiza
salidas huérfanas»): la capacidad queda en un archivo y el call site en el de otra parte.

**Regla:** cada parte declara en su reporte, con las líneas exactas, lo que no pudo enchufar (las
«notas para integrar» de esta corrida lo hicieron, y por eso se cerró en horas); el integrador
grepea cada prop nueva y cuenta sus call sites antes del commit.

**Vive en:** `app/automations/FlujoLienzo.tsx` (`paraGuion`) · `app/automations/SimuladorWhatsApp.tsx`
(`handoffs`) · `app/automations/ChatAgentApp.tsx` (`SecuenciaDto`)

### Estado de producción (medido con SELECT)

- **08/10/2026, al cerrar la primera tanda:** ni la 0223, ni la 0224, ni la 0225 estaban aplicadas.
  ⚠️ Es una afirmación CON FECHA: el mismo día se aplicaron, y la conversión de las 6 secuencias
  corrió. La segunda tanda la leyó como estado actual y dos relevos la repitieron.
- **09/10/2026, al cerrar la segunda:** 0223-0225 y **0228** aplicadas (`hilos`, `hilos_rev` y el
  CHECK `nutricion_inscripciones_hilos_chk`, verificados contra information_schema y pg_constraint);
  0 inscripciones activas en toda la base.

---

## La segunda tanda (08-09/10/2026): un solo CRON, hilos en paralelo, editores anchos, IA

El pedido (11 puntos), el diseño y las 16 decisiones están en docs/chatbot-flujo-ramas-diseno.md →
«SEGUNDA TANDA». Se construyó en 7 partes (modelo + 6 en worktrees) y una revisión adversarial de
5 frentes: 38 hallazgos, 32 confirmados por un verificador independiente, los 32 arreglados con test.

### Una flecha en paralelo es un PUERTO, y así el modelo no tuvo que cambiar sus recorridos [modelo]

**Qué:** `paralelos?: string[]` en mensaje, acción, espera y el nodo `inicio` (id `'entrada'`, se crea
sólo con la primera flecha desde el CRON y va al FINAL del array para no correr índices).
`puertosDe` los devuelve como `par:<id>`, así `apuntados`, `padreDe`, `descendientes`, la regla de un
padre y las sueltas siguieron andando sin tocarlos. Lo que sí hubo que escribir: `raicesSalida`,
`hiloDe` ('p' el principal, el id de la primera tarjeta de cada flecha, 'r' «Si responde') y las
reglas de `validarGrafo` (paralelos en un bucle de «Ir a» = un hilo nuevo por vuelta; «Ir a» de la
salida a otro hilo = el mismo mensaje dos veces).

**La regla:** una clase nueva de nodo pasa por DOS lugares del guardado con dueños distintos: el
saneo (`camposDelFlujo`) y el relleno (`esNodoDeControl`). Sanear la clase no alcanza: el inicio se
guardaba como si fuera un mensaje. Y `PasoSecuencia` copiaba a mano la unión de `nodo`: al ampliar una
unión del contrato, los tipos copiados y los `switch` exhaustivos de afuera se cuentan antes.

**Vive en:** `lib/flujo-grafo.ts` · `lib/nutricion-grafo-motor.ts` (`camposDelFlujo`) · `lib/nutricion.ts`

### Un compare-and-set por revisión sólo protege si TODOS los escritores suben la revisión [motor]

**Síntoma (revisión):** una escritura del motor leída antes de que el lead contestara revivía los
hilos congelados y pisaba la tarjeta del «Ir a» de «Si responde».

**Causa:** las dos retomas (`responderConGrafo` y el destrabe de `pausarPorRespuesta`) escriben
`hilos: null` sin subir `hilos_rev`; la fila volvió a 'activa' y la revisión seguía igual, así que el
CAS del motor pasaba. ⚠️ Y el diagnóstico obvio al revés también es falso: perder el CAS NO dice «otra
corrida movió este hilo»: cualquier hilo de la fila sube la revisión. Al perder se relee y se pregunta
por ESTE hilo (`hiloSigueEn`).

**La regla:** si el CAS es por la versión de la fila, exige también la FORMA leída (`not hilos is null`
cuando se leyó con hilos), o todos los escritores suben la revisión.

**Vive en:** `lib/nutricion.ts` (`escribirHilos`) · `lib/nutricion-hilos.ts`

### En modo hilos, el estado del ÚLTIMO hilo que cierra es el de la inscripción [motor]

**Síntoma (revisión):** mismo lead, mismos WhatsApp recibidos: el «no confirmó» salía o no según qué
hilo cerraba último. Un email terminal (sin email, dado de baja) cerraba su hilo 'cancelada'; si era el
último, la inscripción entera quedaba 'cancelada' y el desenlace la saltaba.

**La regla:** todo cierre de hilo con estado terminal se prueba en los DOS órdenes. Con hilos, lo
terminal de un email cierra 'completada' (el silencio se mide igual desde el último envío real).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-hilos.ts` (`aplicarAHilo`) · `lib/nutricion-desenlace.ts`

### «Vuelve a la cola» se decidía en TRES caminos, y el nuevo concepto entró en dos [motor]

**Síntoma (revisión):** un hilo «Enseguida» que arrancaba una acción esperaba una hora; detrás de un
mensaje o una espera salía en la misma corrida.

**La regla:** si una decisión del motor se repite en varios caminos, va en UNA función que llamen
todos; al sumar un concepto (hilos), `grep` de `otraVuelta = true` y revisar cada condición. Y lo nuevo
del motor va FUERA de `procesarEnvios` (un test lo recorta con tope de 40.000 caracteres).

**Vive en:** `lib/nutricion.ts` (`procesarEnvios`)

### El freno anti-ban y los topes son POR CANAL, y eso cambia también a los flujos de antes [motor]

`qNutri` y `enviosUltimas24h` contaban todos los canales y el freno se calculaba una vez por lote:
WhatsApp y email del mismo CRON salían con 20 h de diferencia, y dos hilos de WhatsApp en la misma
vuelta. Ahora los 20 h y los topes miran WhatsApp, el email tiene su propio freno y su tope
(`MAX_EMAIL_POR_DIA` = 100), y `enviadoEnCorrida` se actualiza tras cada envío. ⚠️ No es «modo hilos»:
un email masivo ya no frena 20 h al WhatsApp del mismo lead en NINGÚN flujo. Medido: 0 inscripciones
activas al desplegar.

**Ventana 9-21:** se decide con `zonaDelMotor` (`mako.timezone`; sin zona, Ciudad de México como
siempre). El ws1 NO tiene `mako.timezone`; ws9/10/13/14/15 son Buenos Aires. Para MOSTRAR una hora va
`tzDeWorkspace`. Guardar la zona del ws1 (America/Tijuana) es una decisión de Martín.

**Vive en:** `lib/nutricion.ts`

### Una validación nueva dentro de una escritura que corre un `ejecutar()` consume la pendiente [motor]

Activar pasó a validar lo mismo que Publicar (decisión 15) adentro de `setSecuenciaActiva`, que es lo
que corre el «sí» de la pendiente `nutricion_toggle`: el sí se consumía y contestaba error. La misma
validación va exportada y la corre quien PROPONE. Regla de AGENTS.md («falla en preparar()»), aplicada
a un throw nuevo en una función vieja: grepear quién la llama desde un `ejecutar()`.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaActiva`, `setSecuenciaPasos(…, { soloValidar })`) · `lib/mako-doer-acciones.ts`

### Lo que un editor OFRECE sale de la regla que lo RECHAZA al guardar [modelo]

El lienzo ofrecía «＋ En paralelo» y destinos de «Ir a» que Publicar después rechazaba: `admiteParalelo`
y `tarjetasParaIrA` reescribían a mano PARTE de `validarGrafo` y se olvidaron del bucle. Para ofrecer un
valor se corre la regla sobre el flujo hipotético con ese valor puesto. (Queda: «Crear con IA»
—`problemaDeSalto`— todavía copia reglas en vez de usar `repartenEnBucle`.)

**Vive en:** `lib/flujo-conversacion.ts` · `lib/flujo-grafo.ts` (`repartenEnBucle`) · `lib/flujo-ia.ts`

### Lo que flota sobre un lienzo se mide contra la SALIDA del encuadre, no sólo contra los insets [ui]

La caja de «Crear con IA» centrada entre los insets caía EXACTAMENTE encima del CRON, porque
`encuadreInicial` centra el grafo en el mismo lugar. El encuadre le reserva su franja (`franjaIA`,
`lib/crear-ia-lugar.ts`). Y el envoltorio de una capa con `pointerEvents: auto` mide lo mismo que lo que
dibuja: el aire transparente también come clics. Lo que tiene un pedido en vuelo se ESCONDE, no se
desmonta (desmontar cancela la IA).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` · `lib/crear-ia-lugar.ts`

### El panel apaisado llega al rincón de abajo a la derecha y necesita capa propia [modelo, ui]

Sin z-index, la esquina de avisos tapaba «Revisar antes de enviar» del editor en fila. Capa entre 55
(esquina de avisos) y 60; los modales arrancan en 130. El contenido va en columna flex con `flex: 1` +
`min-height: 0` (los editores anchos estiran así; nada de `height: 100%`).

**Vive en:** `app/_components/Lienzo.tsx`

### Crear con IA: lo que el modelo inventa se repara con código, y hay cosas que no se ven en los tests [ia]

- **Un id, una etiqueta, un link o un monto nunca vienen del modelo**: la etiqueta por nombre (o se
  crea), el link desde una clave, y un monto de Ganado vale sólo si aparece literal en lo que escribió
  una persona. Las `{{variables}}` en los datos de una ⚡ Acción se borran (`aplicarVariables` corre
  sólo sobre mensajes: llegarían con llaves al grupo).
- **Dos padres y uno es una espera: gana la espera** (sólo existe para demorar lo que sigue). Lo
  encontró una salida REAL de Groq que pasaba `validarGrafo`; las fixtures escritas a mano no.
- **Lo que puede CREAR una referencia se resuelve antes de decidir qué se crea** (el disparador por
  etiqueta nueva quedaba `etiqueta:-2`).
- **Un callback que se llama al final de un pedido largo va por un ref**: la prop capturada al clic
  comparaba contra el lienzo de hace un minuto.
- **Cancelar sólo se dibuja mientras el server todavía lo respeta**, y un 409 por estado viejo
  devuelve lo guardado.
- **La key de Gemini de PLATAFORMA está bloqueada por Google** (403 «Your project has been denied
  access»): una prueba «con la key de plataforma» no prueba nada; se probó por Groq.
- **El voseo de la salida no lo caza `marcasDeVoseo`** (lista corta a mano): el detector bueno vive en
  `tests/puente-panel-copy.test.ts`. Mudarlo a `lib` está sin hacer.
- **Lo que una pantalla decide con un módulo que tiene prompts va en un módulo aparte**
  (`lib/flujo-ia-cliente.ts`): importar un valor de `lib/flujo-ia.ts` desde un `'use client'` se lleva
  los prompts al navegador.

**Vive en:** `lib/flujo-ia.ts` · `lib/flujo-ia-cliente.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `app/automations/CrearConIA.tsx`

### Un estado sembrado de una prop que el SERVER cambia bajo el mismo `key` [ui]

Después de «Crear con IA», el CRON decía «A mano»: `disparo` se sembraba una vez y la ruta de IA cambia
el disparador en el server sin cambiar el id. Se resiembra comparando una firma en el render. Lo mismo
con la caché de etiquetas: una ruta del SERVER que crea entidades obliga a quien recibe su respuesta a
invalidar la caché (`avisarCambioEtiquetas`).

**Vive en:** `app/automations/SecuenciaPerfil.tsx` · `app/_components/etiquetas-cliente.tsx`

### Cal.com: las respuestas, el aviso y lo que la pantalla promete [datos]

Las respuestas se deduplican por clave (`responses` primero; `userFieldsResponses` repite), se saltean
las ocultas, y lo que ya es un campo de la reserva se excluye en positivo. ⚠️ Un jsonb no conserva el
orden de las claves: comparar con `JSON.stringify` contra lo guardado habría insertado de nuevo cada
reentrega. Un emoji cortado en el tope deja un sustituto suelto y Postgres rechaza el jsonb ENTERO
(se perdían todas las respuestas). Y el aviso dice «+N en el resumen»: el resumen tenía que leer ESA
tabla (`lead_respuestas`).

**Vive en:** `lib/calcom.ts` · `app/api/webhooks/calcom/route.ts` · `lib/leads.ts` · `lib/lead-respuestas.ts`


## La tercera tanda (09/10/2026): condiciones de todo el negocio, CRON por producto, editores medidos

Pedido literal en la bitácora (9 oct 02:05); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«TERCERA TANDA». Seis partes en worktrees y una integración: 6035 tests, typecheck 0.

### Una condición devuelve sí, no o «no sé», y «no sé» no se cumple ni negada [condiciones]

`lib/condiciones-catalogo.ts` tiene 48 condiciones por sección y ámbito (adquisición = CRM; entrega =
Customer Success), y cada una sale de un dato que el motor lee en BATCH (`hechosDeLeads(db, ids,
filas)` lee sólo las fuentes que piden los flujos del lote). «No asistió a la R1» negado salía para
quien todavía no tuvo la reunión: un no-show exige la asistencia registrada como «no asistió», no la
falta de reunión. Y lo que no tiene un dato que lo registre no se ofrece: «Confirmó la asistencia» y
«Reagendó» no existen en ningún campo; la sección «Plan» tampoco (la unión tarea→lead está puesta en 6
de 776 tareas, medido).

**Vive en:** `lib/condiciones-catalogo.ts` · `lib/flujo-grafo.ts` (`cumpleFila`) · `lib/nutricion.ts` (`hechosDeLeads`) · `app/automations/EditorCondicion.tsx`

### «+y» que creaba «+o»: agregar y elegir el modo son dos decisiones [condiciones]

Los dos botones agregaban una fila con un «Agendó» de relleno Y fijaban el modo de la rama entera, así
que el separador de todas las filas cambiaba con el último tocado. Ahora «＋ Condición» abre el
desplegable por secciones y la fila nace al elegir; «Todas / Cualquiera» es su propio control. Y una
rama (o una condición) nueva nace VACÍA: validarGrafo la frena hasta que se elija algo.

**Vive en:** `app/automations/EditorCondicion.tsx` · `lib/flujo-conversacion.ts` (`agregarRama`, `nodoNuevo`)

### Lo que pide una etapa se calcula sobre el embudo REAL, no sobre el pipeline de fábrica [acciones]

El diagnóstico obvio para «Mover de etapa» era «ganado pide monto, perdido pide motivo» sobre
`DEFAULT_PIPELINE`. Lo que pide una etapa sale de `cfg.stages` del embudo del producto
(getFunnelDe/buildFunnel), y para elegir A DÓNDE mover hacen falta todas las etapas, incluidas las
salidas (`productosConEtapas` las filtra: la ruta nueva `app/api/flujos/opciones` las lee sin filtrar).
⚠️ `proponer_cambio_etapa` sólo mueve en el producto principal: el producto del editor es una
referencia hasta que la acción acepte `embudoId`. Y un parámetro que la acción no declara viaja en los
params sin error: un nombre mal escrito desaparece igual de callado.

**Vive en:** `app/_components/EditorAccionMako.tsx` · `app/_components/CamposAccion.tsx` · `lib/editor-acciones.ts`

### Crear con IA fallaba porque el único proveedor sano no cabía [ia]

Medido con las keys del ws1: Gemini 403 (Google bloqueó el proyecto de la key, que es la misma de la
plataforma) y 429; OpenRouter 404 (el modelo gratis ya no es gratis); Mistral 429 siempre; OpenAI 429
sin crédito. Groq armaba un flujo válido en 3 s y la cascada nunca lo probaba: `maxTokens` CUENTA para
el techo de entrada, y 4k de prompt + 6k de salida pasaban los 7k. Se achicó el contexto (claves
cortas para los disparadores, topes al perfil) y la salida se calcula para que entre (`salidaParaIA`).
⚠️ El mensaje culpaba a «la configuración de MaKo» porque clasificaba todos los errores juntos: ahora
es por proveedor (`falloDeIA`). Los demás callers de `errorDeCascada` siguen con el defecto.

**Vive en:** `lib/flujo-ia.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `lib/ai-cheap.ts` (`techoDeEntrada`)

### El email en HTML: las variables se resuelven POR CONTEXTO dentro del saneo [mensajes]

El cuerpo del email es el editor rico de las lecciones y el paso guarda `cuerpo_html` saneado con
lista blanca (`lib/email-html-seguro.ts`). Un `{{nombre}}` adentro de un href (`?n={{lead_nombre}}`)
con «Ana Pérez» rompía el link: en el texto va escapado, en un href/src codificado, y la URL se valida
DESPUÉS de reemplazar. Sin imágenes subidas: falta un almacenamiento público.

**Vive en:** `lib/email-html-seguro.ts` · `lib/email-html.ts` · `app/automations/EditorEmailGmail.tsx` · `lib/nutricion.ts` (envío)

### Una fila optimista es un estado aparte, y se sigue por una clave estable [lista]

La fila de «＋ Nueva» que aparece al instante desaparecía a mitad de la creación y la selección se
perdía al llegar el id real. Va calculada sobre la lista del server (`creando:<temporal>`), aplicada al
dibujar. Y «Duplicar» no copia la fila entera: inserta una pausada con lista blanca de columnas y cada
campo con puerta propia pasa por su puerta (pasos → setSecuenciaPasos).

**Vive en:** `app/automations/SimuladorWhatsApp.tsx` · `app/automations/ChatAgentApp.tsx` · `lib/secuencia-duplicar.ts`

### Un cambio de contrato de una parte deja «verde por aire» el test de otra [integración]

Al sacar «Eventos» del CRON, el test de presupuesto de Crear con IA siguió en verde con sus roturas: el
negocio de prueba pesaba 40 eventos y ya no medía el borde. Un test de presupuesto se calibra CERCA del
borde, con la medición escrita, y se re-prueba rompiéndolo cuando cambia lo que mide. Y una función
que alimenta una pantalla y otro lector no se reforma para la pantalla: se agrega la forma nueva al
lado (el CRON por pasos dejaba a Crear con IA sin disparadores).

**Vive en:** `tests/flujo-ia*.test.ts` · `lib/flujo-conversacion.ts` (`seccionesDisparo`)


## La cuarta tanda (09/10/2026, a medias): «Probar» que no mostraba nada, y sacar sin romper lo prendido

Pedido literal en la bitácora (9 oct 11:02); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«CUARTA TANDA». Se hizo una parte, directo y en pasos chicos (la cuenta en 92-93 %): lo que falta,
por número de punto, en `docs/relevo/chatbot.md`.

### «Le di a probar y no salieron los mensajes»: no era el envío, era una puerta del simulador [probar]

El diagnóstico obvio era que la prueba no mandaba. Lo que pasaba: el simulador FRENABA en cada
condición esperando que alguien eligiera la rama con los botones («Llegó hace menos de 3 días /
Si no»), y con una condición como primera tarjeta no salía ningún mensaje. Ahora sigue sola por la
primera rama (el «Sí»). La regla: una prueba que arranca sola no puede quedarse esperando una
decisión que nadie le pidió a quien mira; si hace falta probar la otra rama, eso es un control
aparte, no un freno.

⚠️ **Y «siempre por el Sí» fue el arreglo equivocado** (quinta tanda): cambió el freno por un desvío.
Ver «"Probar" por el "Sí" también escondía los mensajes», más abajo: la decide el motor con un lead
recién llegado.

**Vive en:** `app/automations/PanelProbar.tsx` (el `case 'condicion'`)

### Sacar un tipo de tarjeta del producto = dejar de OFRECERLO, no dejar de dibujarlo [lienzo]

Martín pidió sacar REPLY, GO TO, «Si responde» del CRON, «antes de la reunión» del DELAY y
condiciones que el CRM no registra. Varias secuencias PRENDIDAS los usan (las convertidas de la
primera tanda tienen «Si responde»). Sacarlos del dibujo habría cambiado qué hace hoy una secuencia
sin que nadie lo viera. Se sacan de lo que se OFRECE (el ＋, el desplegable, el catálogo con
`retirada`, `FUERA_DEL_SELECTOR`) y lo que ya existe se sigue dibujando, corriendo y borrando. La
migración de esas secuencias a lo nuevo es una decisión aparte.

**Vive en:** `lib/flujo-conversacion.ts` (`opcionesDelMas`, la tarjeta CRON) · `lib/condiciones-catalogo.ts` (`retirada`, `seOfrece`) · `lib/editor-acciones.ts` (`FUERA_DEL_SELECTOR`) · `app/automations/FlujoLienzo.tsx` (`EditorEspera`)

### El desplegable de la casa no es un `<select>`: lo puesto que no está en la lista lo dice el botón [cron]

«La que tiene puesta» existía por la regla del `<select>` cuyo valor no está entre sus opciones
(muestra la primera y el primer clic la pisa). El `Dropdown` de la casa no tiene esa trampa: el botón
dibuja `botonLabel` (`rotuloDisparo` cae a `textoActual`) y nada se escribe hasta elegir. Esa sección
era ruido, y Martín la vio como tal. La regla del `<select>` sigue valiendo para un `<select>` nativo.

**Vive en:** `lib/flujo-conversacion.ts` (`pasosDisparo`, `rotuloDisparo`)

### `echo tsc=$?` después de un pipe mide el `tail`, no el typecheck [proceso]

`npx tsc --noEmit | tail -15; echo tsc=$?` imprime el exit del `tail` (0), y un commit salió con un
error de tipos que el mismo comando mostraba arriba. Se cazó en el paso siguiente, sin pushear. El
chequeo va a un archivo y el `$?` del comando: `npx tsc --noEmit > out.txt 2>&1; echo $?`.

### El «De» del email: hoy hay UN remitente por negocio, y «Vincular nuevo» lo REEMPLAZA [email]

Martín pidió elegir el remitente «si se tiene vinculado varios email, con el botón de vincular
nuevo». Medido: un workspace tiene UN remitente (`getEmailFrom`: `resend_from` → `RESEND_FROM` → el
sandbox), «Guardar remitente» de /email lo PISA, y de los 11 workspaces sólo el ws1 tiene
`resend_from` (y es «MaKo <equipo@hola-mako.com>»). No existe una lista de remitentes en ningún lado.

Lo hecho sin inventar un modelo: el «De» lista lo que hay (`remitentesVinculados` ya lee un
`remitentes` si la ruta algún día lo manda) y «Vincular nuevo» monta el MISMO `DominioSetup` de
/email en un modal. Como el rótulo promete SUMAR y ese botón pisa el «De» de todos los emails del
negocio (los pasos sin remitente propio y los broadcasts), el modal lo dice arriba cuando ya hay uno
(«Reemplaza el remitente de tu negocio.»). El paso guarda `remitente` sólo si no es el del workspace,
y el motor lo usa sólo si es del MISMO dominio (`remitenteDelPaso`): la cuenta de Resend es una para
todos los clientes, así que sin esa guarda un paso guardado con el mail de otro cliente saldría.

**Regla:** mudar a un botón cercano una acción que pisa algo COMPARTIDO le cambia los supuestos de
frecuencia (AGENTS.md); el lugar nuevo nombra lo que pisa. Sumar de verdad es un dato nuevo (varios
remitentes por negocio) y lo decide Martín.

**Vive en:** `lib/email-remitente.ts` · `app/automations/EditorEmailGmail.tsx` (`VincularRemitente`,
`AVISO_REEMPLAZA`) · `app/email/EmailApp.tsx` (`DominioSetup`) · `lib/nutricion.ts` (envío y
`setSecuenciaPasos`)

### Una prop nueva del editor con CERO call sites: el «De» se guardaba y no se veía [email]

`EditorEmailGmail` acepta `remitente` y sus tests lo prueban montándolo a mano, pero quien lo monta
en el lienzo (`EditorEmail`, `app/automations/FlujoLienzo.tsx`, de otra parte de la tanda) no se lo pasa:
elegir otro remitente lo GUARDABA en el paso y la pantalla seguía diciendo el del workspace. Es
«escribir la salida no es ofrecerla» con la forma del reparto por archivo: la capacidad en un
archivo y el enchufe en otro que la parte no podía tocar. Se enchufó al unir la tanda, y lo fija
`tests/chatbot-enchufes.test.ts`.

**Vive en:** `app/automations/FlujoLienzo.tsx` (`EditorEmail`)

### El modo HTML: lo que el editor visual no sabe dibujar SALE, y se simplifica al volver a escribir [email]

La caja HTML pasa cada tecla por la misma lista blanca (`sanearHtmlEmail`) y lo saneado llega al
paso tal cual, incluido lo que el editor rico no tiene en su esquema (un `h1`, `sub`/`sup`, un
`colspan`): eso sale en el mail. Al volver al modo visual el editor carga ese HTML con SU esquema, y
la próxima tecla guarda lo que el editor dibuja, o sea la versión simplificada. No se midió con clics:
sale de cómo carga ProseMirror un documento. Si un cliente arma un mail en HTML y después toca una
coma en el visual, pierde lo que el visual no sabe dibujar.

**Vive en:** `app/automations/EditorEmailGmail.tsx` (`alCambiarCrudo`, `salirHtml`) · `app/_ui/EditorRico.tsx`

## Cuarta tanda punto 1 y quinta punto 3 (09/10/2026, parte «editores»): el panel por tipo y el DELAY con segundos

Pedido literal: «No me gusta que el editor del CRON como muchos otros tengan tanto espacio en blanco y
un desplegable chico arriba del todo» y «En Delay, falta la opción de minutos y segundos...». Rama
`wip-v4-editores`; una corrida la empezó y la cuota la cortó, la segunda la verificó contra el pedido
y cerró lo que faltaba.

### «Segundos» que no eran segundos: el diagnóstico obvio (la precisión del cron) era la mitad [motor]

La primera corrida resolvió la precisión como había que resolverla —una espera de hasta 120 s se
cumple DURMIENDO adentro de la corrida (`dormirEsperaCorta`), con su tope y sus tests— y la pantalla
no avisaba nada para ≤ 120 s, o sea prometía exactitud. Medido después, en tres lugares:

- **La ruta del cron nunca le pasaba el tope** (`esperarHastaMs`): `procesarEnvios` sin tope no duerme
  (a propósito), así que el dormir era una capacidad con CERO call sites. Los tests leían el motor y
  daban verde; nadie miraba la ruta.
- **El caso típico no pasa por el cron**: «Nuevo lead → esperar 30 s → WhatsApp» corre por la VÍA
  RÁPIDA del evento (`enrolarPorEvento` / `inscribirEnSecuencia` → `procesarEnvios({ soloLeadId })`),
  adentro de un webhook que tiene que contestar ya. Ahí no se puede dormir, y los 30 s eran «la corrida
  de la hora siguiente». Va con `after()` de Next: contesta y DESPUÉS duerme lo que falta y vuelve a
  correr ese lead con tope (`seguirDespuesDeResponder`), en fila por proceso para no correr 30 motores
  a la vez sobre los topes. Si `after` no está o la función muere, la fila ya tiene la hora exacta y la
  toma el cron: tarde, nunca perdida.
- **La píldora y «Probar» redondeaban a minutos** (`textoEspera`, lib/flujo-grafo.ts): 10 s se
  dibujaba «Esperar 0 min» y 30 s «Esperar 1 min», con el editor diciendo «10 segundos» al lado. El
  commit decía que estaba hecho y el test probaba `textoDuracion`, no a quien la tenía que llamar.

La regla: **una capacidad del motor que depende de un parámetro se verifica en el que lo PASA**, y
«¿quién llega a este nodo?» se contesta enumerando las ejecuciones que lo alcanzan (acá: el cron y la
vía rápida), no la que uno tenía en la cabeza.

**Vive en:** `lib/espera-duracion.ts` (la decisión entera, en la cabecera) · `lib/nutricion.ts` (`procesarEnvios`, `seguirDespuesDeResponder`) · `app/api/cron/nutricion/route.ts` · `lib/flujo-grafo.ts` (`textoEspera`)

### Un DELAY corto entre dos WhatsApp no existe: lo frena el anti-ban de 20 h, no la espera [motor]

El ejemplo con que se pensó la feature («audio y 10 s después el link») no puede pasar con ningún
DELAY: el segundo WhatsApp al mismo lead cae en `frenadoPorAntiBan` (20 h por canal; 3 h con reunión
en menos de 48 h) y no avanza. Un DELAY de segundos sirve entre el CRON y el primer mensaje, o entre un
mensaje y una acción, un email o un aviso al grupo. Dos mensajes seguidos de WhatsApp son UNA tarjeta
con varias burbujas (cuarta tanda, punto 15). La pantalla del DELAY no lo dice: el aviso es de la
espera, no del anti-ban.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`frenadoPorAntiBan`) · `lib/nutricion.ts` (`HS_MIN_ENTRE_MSGS`)

### «Puede salir hasta 1 h después» era falso dos tercios del día: el cron corre de 15 a 23 UTC [motor, ui]

`"0 15-23 * * *"` son nueve corridas, de 9 a 17 en Ciudad de México. Una espera que vence a las
17:30 de ahí sigue a las 9 del día siguiente, y eso vale también para «Esperar 2 horas» y «1 día»,
que no llevaban aviso («una hora de más sobre un día no cambia nada» — de noche son 16). El aviso
pasó a decir CUÁNDO sigue, con las horas de quien mira y para toda espera de más de 120 s: «Sigue a
la hora en punto (9 a 17 h)». Las horas y la cadencia las fija un test leyendo vercel.json.

Y de rebote: entre las 17 y las 21 de Ciudad de México la ventana horaria del motor deja mandar y no
hay ninguna corrida — lo que vence en esa franja espera a la mañana (sólo lo dispara al momento un
evento nuevo, por la vía rápida). Decide Martín: ampliar el cron cambia cuántas veces por día se
aplica el tope «por corrida».

**Vive en:** `vercel.json` · `lib/espera-duracion.ts` (`HORAS_MOTOR_UTC`, `avisoDePrecision`)

### El panel mide por TIPO de tarjeta, y el selector es el campo grande de la casa [lienzo]

Todos los editores medían lo del de WhatsApp (~720 × 420): un DELAY era una frase arriba y el resto
vacío. `editorDeTarjeta` (lib/lienzo-grafo.ts) decide alto y ancho por el TIPO —nunca por el contenido
de cada render: lo que no entra scrollea adentro—: DELAY, TAG y GO TO 140; MAKO 280; CONDITION y CRON
320; ACTION y «Si responde» 400; un mensaje, el grande (840 × 560). `campoGrande` / `botonGrande`
(48 de alto, letra 16) en DELAY, TAG, ACTION y GO TO. Lo que queda raro: el CRON usa su propio
`BOTON_CAMPO_CRON` (44, letra 14,5) —dos «campos grandes» que difieren es el olor de dos piezas
separándose— y con horario mensual o anual su contenido pasa los 320 y scrollea.

**Vive en:** `lib/lienzo-grafo.ts` (`editorDeTarjeta`, `ALTO_EDITOR_CONTROL`) · `app/_components/Lienzo.tsx` (`campoGrande`, `botonGrande`, `altoFijo`) · `app/automations/SecuenciaPerfil.tsx` (`BOTON_CAMPO_CRON`)

## Lo que quedó sin hacer

**De la parte «editores» (cuarta 1 + quinta 3, 09/10/2026):**

- **Medir la espera corta en producción.** Lo que corre después de contestar vive lo que el
  `maxDuration` de la ruta que llamó a la vía rápida (webhooks, server actions): no se midió cuánto es
  en cada una. Si muere, sale con el cron (la hora exacta ya está en la fila). `lib/nutricion.ts`
- **De 2 a 59 min sigue dependiendo del cron**: si Martín quiere minutos exactos, hace falta un tick
  frecuente SÓLO para las filas que salen de una espera (el de `flujo-corridas` corre cada 5 min), sin
  multiplicar el tope «por corrida». Y la franja 15-23 UTC deja sin corrida de 17 a 21 de México.
- `BOTON_CAMPO_CRON` (44 / 14,5) contra `botonGrande` (48 / 16): unificar. `app/automations/SecuenciaPerfil.tsx`
  (lo fija `tests/cron-varias-etapas.test.ts`).
- El selector de la CONDITION sigue siendo el `Dropdown` de fila. `app/automations/EditorCondicion.tsx`
- Verlo con clics: el panel por tipo, el DELAY con «10 segundos» y su aviso, y una espera de 30 s de
  un lead nuevo de verdad.

## Cuarta tanda, punto 15, y quinta, punto 1 (09/10/2026): varios mensajes por tarjeta y «Probar» como un lead nuevo

### «Probar» por el «Sí» también escondía los mensajes: la causa no era la espera [probar]

Síntoma (quinta tanda, punto 1): «al darle probar en la automatización de bienvenida, no salió el
mensaje que debería salir… si es por el delay, evidentemente no debe tardar nada». El diagnóstico
obvio era la espera de 1 h, y era el equivocado: la prueba ya no espera (la píldora se dice y se
sigue). MEDIDO con la Bienvenida del ws1 (`docs/relevo/chatbot-secuencias.json`, M2) y la regla de la
cuarta tanda: «Esperar 1 h» → el «Sí» de «Agendó» → «↪ Sigue en «Agendó: confirmar y preparar»», y
ningún mensaje. El arreglo de la entrada de arriba («sigue sola por el Sí») cambió el freno por un
desvío: toda condición del tipo «si ya agendó, mandalo a otra automatización» se comía el flujo.

La regla: **una prueba que decide sola decide como el MOTOR, con un lead que acaba de entrar por ese
CRON** (sin agenda, sin pago, sin respuestas, llegado ahora, con la etapa o la etiqueta por la que
entró), y lo que la prueba misma produjo también cuenta (después de un mensaje, «ya le escribimos»).
Con la MISMA función que el motor (`elegirSalida`). Y el bloque `catalogo` de ese lead va con CEROS,
no ausente: ausente, una condición negada del catálogo («No reprodujo el VSL») nunca se cumple, y la
prueba seguiría por el «Si no» de algo que un lead nuevo sí cumple.

**Vive en:** `lib/simulador-grafo.ts` (`hechosDeLeadNuevo`, `leadNuevoDelCron`, `elegirComoLead`) · `app/automations/PanelProbar.tsx` (el `case 'condicion'`) · `tests/probar-lead-nuevo.test.ts`

### Un dato que pasa a vivir en DOS lugares rompe a quien pregunta «¿quién usa esto?» [modelo]

Un mensaje de varias partes guarda la primera en los campos de siempre (`cuerpo`, `audio_id`,
`media_id`: el espejo) y el resto en `partes`. El barrido de AGENTS.md («antes de sumar un tipo de
paso, `grep` de `.pasos` y de `setSecuenciaPasos`») encontró a los que leían sólo el espejo, y el caso
caro no recorre pasos: PREGUNTA por un id. `pasosUsanAdjunto` (biblioteca) y `borrar_audio` (API)
miraban `media_id` / `audio_id` del paso, así que el archivo o el audio de la SEGUNDA parte se podía
borrar y el motor fallaba en cada lead cada 24 h, sin que nadie lo viera (`enviarPartesDelPaso` baja
todo antes de mandar y no manda nada). Los otros: el generador de copy le pedía texto al modelo para
el espejo (un audio con cuerpo vacío) y ese texto entraba como una parte MÁS; las variantes se
generaban —y se pagaban— para que el guardado las tirara; la prueba de la API mandaba sólo la primera
parte (y un audio sin su pie, que el motor sí manda); la ficha de la API y el contexto de MaKo leían
sólo el espejo.

La regla: **al partir un dato en espejo + resto, se buscan también los lectores del ID (`audio_id ===`,
`media_id ===`), no sólo los que recorren la lista**, y la pregunta «¿lo usa?» va en UNA función
(`pasoUsaAudio`, `pasoUsaArchivo`).

**Vive en:** `lib/mensaje-partes.ts` · `lib/setting-adjuntos-reglas.ts` (`pasosUsanAdjunto`) · `lib/api-mako/areas/chatbot.run.ts` (`borrar_audio`, la ficha) · `lib/nutricion-generator.ts` · `lib/secuencias-variantes.ts` · `lib/setting-secuencias.ts` (`probarSecuencia`) · `lib/mako-context.ts` · `tests/partes-recorren.test.ts`

### Los destinos de «Probar» se guardan, y son de la PERSONA [probar]

Pedido: «primero el desplegable me debe ofrecer los números que ya tiene guardado, y abajo un botón de
"Nuevo número"». Hasta acá la regla era «el destino NO se guarda» (lienzo-3: precargar el contacto de
reportes del NEGOCIO le mandaba la prueba al cliente). Lo que se guarda ahora es de QUIEN PRUEBA: su
teléfono y su email de siempre, y los que fue escribiendo como «Nuevo número», en `usuarios.perfil.
destinosPrueba` de SU fila (por el email de su sesión, nunca «viendo como cliente»), reescribiendo el
jsonb desde lo que ya tenía (ahí viven el formulario y `notifInApp`). Nunca los destinatarios del
workspace: con el super admin mirando a un cliente, ofrecer los números del cliente es un clic de
distancia de mandarle la prueba a él.

**Vive en:** `lib/simulador-grafo.ts` (`destinosGuardados`, `perfilConDestino`) · `lib/prueba-paso.ts` (`guardarDestinoDeQuienPrueba`) · `app/api/chat-agent/simulador/route.ts` (`guardar-destino`) · `app/automations/PanelProbar.tsx` (`MenuDestinos`)

## Quinta tanda punto 2 (09/10/2026, parte «lienzo»): el ＋ en toda la flecha y las tarjetas que se mueven

### `vector-effect: non-scaling-stroke` NO corrige un zoom de CSS: el diagnóstico obvio era el equivocado [lienzo]

El ＋ de una flecha sólo aparecía en un cuadrado invisible de 28 px en el medio. La cura que proponía
el relevo —una franja invisible a lo largo del trazo con `non-scaling-stroke`— medida en Chrome al 40%
daba **6,5 px**, igual que sin el efecto: Chromium calcula el trazo «que no escala» sólo con las
transformaciones de ADENTRO del `<svg>`, y el zoom del lienzo es un `scale()` sobre la capa HTML. Lo que
anda es dividir el ancho por el zoom (16,5 px a cualquier escala). El ＋ además tarda 350 ms en apagarse,
para poder llegar a él en línea recta aunque la curva se salga de la franja. Ya está en AGENTS.md, en la
regla de las capas con `scale(k)`.

**Vive en:** `app/_components/Lienzo.tsx` (`TOQUE_FLECHA`)

### Mover una tarjeta: tres trampas que no se ven en el handler [lienzo]

- **Soltar deshacía el paneo.** Al mover una tarjeta el dibujo cambia de tamaño, cambia la firma del
  encuadre y la vista se re-centraba sola. Afectaba también a /mensajes. `trasMover` lo evita.
- **Mover sólo la tarjeta dejaba atrás sus salidas y sus ＋**, y las flechas se despegaban. Se arrastra el
  ENVOLTORIO de la tarjeta y las flechas se recalculan con la misma curva.
- **«No pude leer las posiciones» no es «no hay ninguna».** Un mapa que arrancó vacío por una lectura
  caída y se guarda al soltar pisa todo lo que la persona ya había acomodado: con la lectura fallida no se
  guarda nada. Y si falta la columna (la 0233 sin aplicar), las tarjetas se mueven y no se guardan, sin
  error (42703 / PGRST204 se distinguen de otros fallos).

Las posiciones son DESPLAZAMIENTOS desde donde el árbol pone el CRON (lo que no se movió se dibuja como
antes), viven en `nutricion_secuencias.posiciones` —nunca en `pasos`, que pasan por un saneo campo por
campo— y se guardan por su propia acción, sin pasar por Publicar ni por la pila de deshacer.

**Vive en:** `lib/lienzo-posiciones.ts` · `lib/secuencia-posiciones.ts` · `app/automations/usePosicionesLienzo.ts` ·
`app/_components/Lienzo.tsx` (`trasMover`) · `supabase/migrations/0233_secuencia_posiciones.sql`

### Proceso: lo que costó verificarlo con clics en un worktree [proceso]

`next dev --webpack` no compila (`node:crypto`); Turbopack en un worktree sólo anda con `turbopack.root`
apuntando a la carpeta de arriba (se cambia y se restaura sin diff); la primera compilación de /chatbot
tardó 4,6 min; matar un `npm test` en curso deja 218 falsos rojos «The service was stopped»; y el número
de migración se ocupó DOS veces mientras se trabajaba (0231 y 0232): se mira justo antes de commitear.
Y el agente dejó el `next dev` prendido al terminar: quien une la tanda revisa los procesos.

## Sexta tanda, parte «modelo» (09/10/2026, noche): varias flechas a una tarjeta, sueltas, «Si responde» como CONDITION, sin GO TO

Las decisiones y los contratos, en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md) →
«SEXTA TANDA, parte «modelo»». Acá, lo que costó.

### «No puedo abrir 2 flechas después de una condición» era el TOPE DE CAMINOS sumando de más [modelo]

**Síntoma:** Martín, punto 13: «Aún no funciona poner o sacar más de una flecha a una tarjeta... si
quiero luego de una condición abrir 2 flechas. Debería poderse».

**El diagnóstico obvio era el equivocado:** que el lienzo no ofrecía el ＋ en paralelo en un resultado,
o que el motor no corría los paralelos. El motor, «Probar» y `validarGrafo` los corrían bien. La causa
real eran DOS: (1) `validarGrafo` rechazaba «la tarjeta X cuelga de N lugares» y no había ninguna
edición para conectar a una tarjeta que ya existe; (2) el tope de caminos (`TOPE_HILOS` = 6) se medía
con la SUMA de todas las flechas en paralelo, también las de los DOS resultados de cada condición,
aunque para un lead corre uno solo. Con tres condiciones con una flecha en el «Sí» y otra en el «Si
no» eran 1 + 6 = 7 «caminos»: la tercera ya no podía sacar su segunda flecha. Y como el lienzo
pregunta con la misma función qué ofrecer, el botón tampoco aparecía — se leía como un botón que falta.

**La regla:** un tope sobre «lo que corre a la vez» se calcula sobre lo que CORRE: en ramas que se
excluyen es el MÁXIMO, nunca la suma (`contarParalelos`, la suma quedó en `totalDeParalelos`). Y cuando
un número decide a la vez lo que se OFRECE y lo que se RECHAZA, un número inflado se ve como un botón
que no está, no como un error.

**Vive en:** `lib/flujo-grafo.ts` (`contarParalelos`, `reglasDeHilos`)

### Sacar «un padre por tarjeta» rompía en silencio a cuatro lectores que subían por `padreDe` [modelo]

**Síntoma (en la revisión, no en pantalla):** con varios padres permitidos, tres ayudantes del motor
seguían subiendo por UN padre: `esPrimerPaso` (¿es la bienvenida? — decide si se vuelve a mirar el tope
de antigüedad), `minutosAntesDeReunion` (¿es un recordatorio? — sin eso sale «Mañana es tu reunión» sin
reunión) y `mensajeAnteriorDe` (qué borrador espera una acción). Y `borrarNodo` reconectaba sólo al
primer padre: los demás quedaban apuntando a la nada.

**Causa real:** relajar un invariante estructural (de árbol a grafo con ciclos) no rompe a quien lo
declaró; rompe a quien lo ASUMÍA, que es otro archivo y no falla: elige un padre y sigue.

**La regla:** al aflojar un invariante, `grep` de cada lector del supuesto (`padreDe`) y una decisión
por lector: «por TODOS los padres» (`padresDe`) o «sin la flecha que vuelve» (`padresSinVuelta`, con
`aristasDeVuelta`: la flecha de un «volver al principio» no es «lo de antes» — sin sacarla, la
bienvenida de un bucle dejaba de ser la primera). Lo fijan `tests/flujo-sexta-modelo.test.ts` (M6, M9,
M10, M13 de sus roturas).

**Vive en:** `lib/nutricion-grafo-motor.ts` · `lib/nutricion-hilos.ts` · `lib/flujo-grafo.ts` (`borrarNodo`, `soloDe`)

### Una tarjeta suelta conectada a la primera se volvía la ENTRADA [modelo]

**Síntoma (medido con el modelo, antes de dibujar):** conectar una suelta a la primera tarjeta dejaba
a la suelta como raíz: el CRON le iba a escribir al lead lo que la persona dejó a un costado.

**El diagnóstico obvio era el equivocado:** «que `normalizar` fije la raíz». `normalizar` no sabe
cuál era la raíz ANTES de la edición; cuando corre, la primera ya está apuntada. **Causa real:** sin el
nodo `inicio` en el dato, la raíz se DEDUCE («la primera tarjeta que nadie apunta»), y con tarjetas
sueltas esa deducción deja de alcanzar.

**La regla:** toda edición de flechas fija la raíz ANTES (`fijarRaiz`: el CRON como dato, al final del
array para no correr ningún `paso_actual`). Y «volver al principio» con una flecha dejaba la primera
apuntada y `raizSalida` sin raíz: si todo lo que la apunta cuelga de ella misma, sigue siendo la raíz.

**Vive en:** `lib/flujo-grafo.ts` (`fijarRaiz`, `raizSalida`, `conectar`, `desconectar`, `crearSuelta`)

### Un ciclo ya no lo arma sólo un «Ir a»; y el «Ir a» que retoma desde «Si responde» no es un cruce [modelo]

**Síntoma:** con flechas que vuelven, la regla «el «Ir a» X vuelve atrás sin espera» no veía un ciclo
armado con flechas. Y la primera versión de `cruces` marcaba como «dos caminos a la vez» el «Ir a» que
retoma la salida desde «Si responde» (5 rojos en tests viejos).

**Causa real:** el retome no es un camino más: el motor descarta los congelados y sigue UNO. Y los
resultados de una condición se excluyen: dos llegadas sólo chocan si no tomaron resultados distintos
en ninguna condición que compartan (`ctx`).

**La regla:** los ciclos se buscan en el grafo de EJECUCIÓN sin las esperas (`ciclosSinEspera`); un
cruce se juzga con el contexto de qué resultado tomó cada llegada. El texto viejo «…de «Ir a»» queda
sólo si el bucle tiene un «Ir a»: `tests/lienzo-capas.test.ts` mira el texto exacto, y nombrar algo que
ya no existe no dice qué pasó.

**Vive en:** `lib/flujo-grafo.ts` (`ciclosSinEspera`, `cruces`, `llegadasPorTarjeta`)

### No había borrador: una automatización a medias no sobrevivía a una recarga [modelo]

**Medido:** lo único que escribía los pasos era Publicar (PATCH /api/whatsapp/secuencias →
`setSecuenciaPasos` → `validarGrafo`). El lienzo editaba en memoria. «Que quede flotando» era imposible
de guardar.

**La trampa al hacer el borrador:** se abre sólo si se armó sobre lo publicado de hoy, y la huella
(`firmaPublicado`) tiene que ser el MISMO cálculo de los dos lados —ordenado por `orden`, normalizado y
renumerado, como lo publica `setSecuenciaPasos` y lo carga el lienzo—. Con una diferencia en el orden,
ningún borrador se abriría nunca, sin un error (rotura B3).

**La regla:** lo incompleto se GUARDA con `validarParaGuardar` y se PUBLICA con `validarGrafo`; el
motor no lee `pasos_borrador` nunca (lo fija un guard que barre los tres módulos del motor).

**Vive en:** `lib/secuencia-borrador.ts` · `supabase/migrations/0240_secuencia_borrador.sql`

### «Si responde» como CONDITION: convertir el dato era el camino caro [modelo]

**El diagnóstico obvio:** pasar el nodo `respuesta` a `nodo: 'condicion'` con una fila nueva. **Por qué
no:** #212 y #213 (ws1, un cliente) corren en vivo con ese nodo, y una respuesta nunca PASA por una
tarjeta de la salida: la pausa y entra por `responderConGrafo`. Convertir obligaba a reescribir ese
camino y reubicar inscripciones. Se dibuja y se edita como condición sobre el mismo motor (la familia
«Respuesta» del catálogo con `evento: 'respuesta'`, que no se ofrece en la salida y cuyo `evaluar` dice
«no sé»). Una fila «Su respuesta trata de» puesta a mano en una condición de la salida no se guarda.

**Vive en:** `lib/condiciones-catalogo.ts` (`respuesta_trata_de`, `seOfrece`) · `lib/flujo-grafo.ts` (`condicionARespuesta`) · `app/automations/EditorCondicion.tsx` (`EditorCondicionDeRespuesta`)

### GO TO: lo medido en producción y la red de `abrirFlujo` [modelo]

**Medido (09/10/2026, `scripts/quitar-ir-a.mts --simular --con-archivadas`, sólo lectura):** de 69
automatizaciones, tres con «Ir a»: #198 (activa, dos «Sigue en #212»; a #212 la dispara su CRON), #221
(pausada, un salto que vuelve a la espera de arriba → flecha) y #222 (archivada, tres «Sigue en #221»,
que está pausada: por el salto tampoco entraba nadie). Cero inscripciones paradas en un «Ir a»; cero
riesgos. `--aplicar` no se corrió.

**La trampa:** `erroresNuevos` compara TEXTOS de error, y sacar un «Ir a» cambia el texto de un error
que ya estaba («…dentro de un bucle de «Ir a»» → «…dentro de un bucle»): una automatización que ya no
se podía publicar contaba como «la conversión la rompe» y el lienzo la habría abierto CON el GO TO. Lo
de antes vuelve sólo si se podía publicar y convertido no (no pasa en ninguna de las tres: es la red).

**Vive en:** `lib/flujo-legado.ts` (`quitarIrA`, `abrirFlujo`) · `scripts/quitar-ir-a.mts`

### Trampas del entorno de esta corrida [modelo]

- **El scratchpad de la sesión es COMPARTIDO por las ocho partes en paralelo** (había `parte-lienzo/`,
  `editores-v6/`, un `romper.mjs` ajeno): es la regla de `/tmp` un nivel más adentro. Cada parte usa
  una subcarpeta propia, o el `commit -F` de una lee el mensaje de otra.
- **Python en Windows escribe CRLF en modo texto**: un `.ts` creado en LF y editado con `open().write()`
  queda CRLF entero (parejo, no mezclado). Y un arnés de roturas cuyo «de» viene de un JSON con `\n` no
  encuentra nada en un archivo CRLF: el arnés tiene que pasar sus anclas al salto del archivo.
- **Un script no puede importar el catálogo de CRON** (`TRIGGERS`, `lib/email-marketing.ts`): arrastra
  `lib/workspace.ts`, que es `server-only`. El script imprime el `trigger_tipo` crudo; copiar la lista
  sería un segundo catálogo.

### Lo que quedó sin hacer (parte «modelo»)

- **El cableado, que es de otras partes** (las líneas exactas van en el reporte de la corrida):
  `SecuenciaPerfil` abre con `abrirFlujo` y guarda el borrador; la ruta POST
  `/api/chat-agent/secuencias` con `action: 'borrador'`; el GET lee `leerBorradoresSecuencias`; el
  `EditorDeNodo` pasa `onPasarARespuesta`; `lib/flujo-conversacion.ts` dibuja `respuesta` como
  CONDITION; `lib/flujo-edicion.ts` edita por `conectar` / `desconectar` / `crearSuelta`.
- **Aplicar la 0240 ANTES del deploy** (tolera su ausencia: sin columna no hay borrador).
- **`scripts/quitar-ir-a.mts --aplicar`**: lo decide Martín. Sin correrlo, el lienzo abre igual sin GO TO
  y Publicar guarda lo convertido.
- **El plazo de una respuesta** («si responde en N horas») no existe en el motor. `lib/nutricion.ts`
- **Verlo con clics**: nada de esta parte se vio en un navegador.
## Sexta tanda (09/10/2026, parte «lienzo»): «Entonces», arrastrar flechas, sueltas, el DELAY en la flecha y el click derecho

Pedido literal en la bitácora (9 oct 18:37), General 2-8, 13 y 14, CRON 10 y DELAY 1. Las ediciones
del mouse viven en `lib/flujo-edicion.ts` (puro, con test); el lienzo las dibuja.

### El CRON implícito convierte «queda flotando» en «pasa a colgar del CRON» [lienzo]

**Síntoma (en los tests, antes de la pantalla):** borrar la primera tarjeta hacía que la de después
quedara conectada al CRON sola; y conectar una suelta a la primera hacía que la SUELTA pasara a ser la
salida (CRON → suelta → primera).

**Causa:** sin nodo de inicio, la salida es «la primera tarjeta que nadie apunta, en el orden del array»
(`raizSalida`). Toda edición que cambia quién no tiene padre puede cambiar la raíz sin que nadie la toque.
⚠️ El diagnóstico obvio («la suelta tiene que ir al final del array») es la mitad: un hijo que pierde a su
padre puede estar ANTES de la raíz en el array, y se la gana igual.

**Regla:** una edición que puede cambiar «la primera» deja la flecha del CRON EXPLÍCITA (`conRaiz`: el
inicio `'entrada'` con la raíz de antes) — sólo cuando hace falta, así un flujo que nadie desconectó
queda igual byte a byte. Romperlo tumba 4 de 16 tests.

**Vive en:** `lib/flujo-edicion.ts` (`conRaiz`) · `tests/flujo-edicion.test.ts`

### Sacar la regla de «dos padres» abre una puerta que no es de dibujo: dos hilos que se juntan [modelo, lienzo]

**Síntoma:** CRON → m1 → m2 con e1 en paralelo; conectar e1 a m2 «se puede» y el lead recibe m2 DOS veces.

**Causa:** ⚠️ la regla «una tarjeta cuelga de un solo lugar» de `validarGrafo` parecía una restricción
del layout (un árbol) y era además la que impedía que dos hilos en paralelo alcanzaran la misma tarjeta:
el motor corre cada hilo por su cuenta (`aplicarAHilo`). Con varios padres (punto 13), juntar ramas de
una CONDICIÓN está bien (se excluyen: corre una) y juntar dos hilos en paralelo duplica envíos.

**Regla:** `conectar` rechaza juntar dos caminos en paralelo (`tarjetasDondeSeJuntan`; «Si responde» no
cuenta: retoma UN hilo). ⚠️ Pero `validarGrafo` también lo tiene que rechazar, o Crear con IA, la API o un
flujo viejo lo producen sin pasar por el lienzo: lo pedí a la parte del modelo.

**Vive en:** `lib/flujo-edicion.ts` (`tarjetasDondeSeJuntan`) · `lib/flujo-grafo.ts` (`validarGrafo`)

### Una espera sobre la flecha sigue siendo un NODO: la flecha del dato llega a ella, no a `hasta` [lienzo]

El DELAY del medio se dibuja como pastilla sobre la flecha padre → lo de después (`AristaFlujo.esperas`) y
no ocupa columna; en el dato sigue siendo un `esperar` con su `siguiente`. Quien borra o inserta sobre esa
flecha mira `esperas[0]`, no `hasta`: borrar la flecha se lleva sus esperas (eran de ella) y deja suelto lo
de después; eliminar la pastilla la SACA de la cadena (`borrarNodo`) y la flecha queda. Se aplasta sólo si
es un lugar de la flecha: un padre, una salida que sigue en algo y nada en paralelo; la del final, con dos
padres o que reparte sigue siendo su píldora. Lo que se pierde: una espera del medio ya no ofrece «＋ en
paralelo» desde ella (no tiene círculo).

**Vive en:** `lib/flujo-conversacion.ts` (`colapsable`, `tramo`) · `lib/lienzo-grafo.ts` (`posicionDePildora`, `puntoDeCurva`) · `app/automations/FlujoLienzo.tsx` (`quitarFlecha`, `borrarTarjeta`)

### El botón derecho armaba un gesto y SELECCIONABA la tarjeta debajo de su menú [lienzo]

`onPointerDown` no miraba el botón: con el click derecho capturaba el puntero y el `pointerup` lo
resolvía como un clic (abría el panel). El gesto de un lienzo se arma sólo con `e.button === 0`.

**Vive en:** `app/_components/Lienzo.tsx` (`onPointerDown`, `bajarCirculo`)

### El scratchpad NO es de la parte: es de la SESIÓN, y las ocho partes son la misma [proceso]

A mitad de la corrida, `msg1.txt` del scratchpad pasó a tener el mensaje de commit de OTRA parte («tiempo»).
Se salvó porque el commit ya había salido (verificado con `git log -1 --format=%B`). ⚠️ El diagnóstico
obvio —«el scratchpad es mío, la regla de `/tmp` no me toca»— es el equivocado: los subagentes de un
workflow comparten el directorio de su sesión, y los nombres que se le ocurren a uno (`msg1.txt`, `tc.txt`,
`correr-tests.mjs`) se le ocurren a todos. Cada parte trabaja en su subcarpeta (`scratchpad/parte-<nombre>/`).

### Verificado con clics (dev server del worktree, ws1, sólo lectura) [lienzo]

Playwright contra `next dev`, con una automatización de mentira inyectada en el GET de secuencias
(m1 → espera 1 h → m2, y m3 suelta) y TODO lo que no es GET contestado por el arnés: 0 llegaron al server.
Medido: el fondo con botón derecho ofrece 10 filas (los 7 tipos, Publicar, Acomodar, Centrar) y cierra con
Escape; la tarjeta, 3 (Duplicar, Desconectar, Eliminar) sin abrir el panel; un clic en el ＋ de m2 abre el
menú de 7 tipos en la punta (pegado al borde derecho de la ventana); arrastrando de m2 a m3 queda todo en
0,28 menos origen y destino (1) con la flecha siguiendo al cursor, y al soltar las flechas pasan de 2 a 3 y
m3 deja de estar suelta; la papelera de m1 se lleva la flecha y su espera (píldoras 1 → 0) y deja sueltas
m2 y m3 (m3 cuelga de una suelta, así que tampoco se alcanza).

⚠️ El ws3 no sirve para esto: rebota al onboarding GLOBAL (`/onboarding?ws=3`), y el arnés esperó el
lienzo 10 minutos en vez de fallar al ver la URL. Un arnés que espera un selector mira también `p.url()`.

### Lo que quedó sin hacer (parte «lienzo»)

- **Verlo con clics con datos reales** de un cliente: lo de arriba corrió sobre una automatización
  inyectada. Sin clic quedaron: editar la píldora del DELAY, crear una tarjeta con el botón derecho en un
  punto, Duplicar, la lista «⚡ Cuando…» del CRON y el botón Acomodar.
- La lista: el reparto la ubicaba en `ChatAgentApp.tsx` y vive en `app/automations/SimuladorWhatsApp.tsx`
  (las divisiones y los íconos del «⋯» son dos hunks ahí). Los íconos del desplegable del FILTRO salen de
  `lib/chatbot-lista-filtro.ts`, que no es de esta parte.
- Las posiciones (lo movido, la suelta, «Acomodar») siguen afuera de Ctrl+Z: «Acomodar» trae su deshacer
  en un aviso; mover una tarjeta, no.
- La papelera del círculo aparece al pasar el cursor por la tarjeta (o con la tarjeta elegida), no siempre.
## Sexta tanda (09/10/2026, parte «disparadores»): varios CRON por automatización

Una automatización tiene ahora una LISTA de CRON (`nutricion_secuencias.disparadores`, mig 0241) y
arranca por CUALQUIERA. El primero sigue viviendo también en las columnas de siempre (`trigger_tipo`,
`etapa`, `cron`…), que leen unos quince lugares; los demás, sólo en la lista. **La regla para código
nuevo: quien pregunta «¿esto dispara esta automatización?» recorre `vistasPorDisparador(sec)`
(`lib/disparadores.ts`), nunca `sec.trigger_tipo` solo** — eso es el primer CRON, no la automatización.

### Un Recurrente con «A quién» arrancaba TAMBIÉN por el evento [motor]

Con el CRON único, una secuencia con `cron` y `trigger_tipo: 'etapa_actual'` era «cada lunes a las 9, a
los que están en Agendado» — y `enrolarPorEvento` la inscribía además en el momento en que alguien
entraba a Agendado, porque sólo miraba `trigger_tipo`. Con varios CRON eso deja de ser un detalle: un
«Recurrente» y un «Producto» sobre la misma etapa son dos cosas distintas. El evento saltea los CRON con
horario (`!s.cron`) y `disparaPorEvento` devuelve false para un horario. Medido en prod el 09/10: **cero
secuencias con `cron`**, así que el cambio no le mueve nada a nadie hoy.

**Vive en:** `lib/nutricion.ts` (`enrolarPorEvento`) · `lib/disparadores.ts` (`disparaPorEvento`)

### Guardar la lista entera corría el ancla de los horarios a «ahora» [motor]

Cada toque del panel (un «A quién», el evento de OTRO CRON) guarda la lista completa, y la primera
versión recalculaba la próxima ocurrencia de todos los horarios: un «todos los lunes a las 9» guardado
un lunes a las 10 saltaba al lunes siguiente y perdía la de hoy, o la que el motor ya había reclamado.
`conProximas` conserva la de antes si la firma del horario de ESE CRON no cambió. Es la regla de
AGENTS.md («un horario se ancla en la ocurrencia anterior») aplicada a un guardado que no es del horario.

**Vive en:** `lib/disparadores.ts` (`conProximas`) · `lib/disparadores-guardar.ts`

### Un CRON extra con horario necesita su propio compare-and-set, y sin la 0241 no existe [motor]

El CAS de siempre (`.eq('cron_proxima_at', …)`) cubre sólo la columna, o sea el primero. Los horarios
de los demás viven en el JSON: se reclaman con un CAS sobre `disparadores_rev`, que sube en cada
escritura (`reclamarOcurrenciaExtra`). Con la 0241 sin aplicar no hay `rev`: el motor no reclama ningún
extra y el guardado rechaza una lista de más de uno («Aún no se pueden varios CRON.») en vez de guardar
la mitad.

**Vive en:** `lib/nutricion.ts` (`comprometerInscripciones`, `reclamarOcurrenciaExtra`) · `lib/disparadores-guardar.ts`

### «El grupo de MaKo» como destinatario: cómo corre un Recurrente sin lead [motor]

Un Recurrente con el grupo marcado, en cada ocurrencia RECLAMADA (no en el dry-run), le manda al grupo
de MaKo los TEXTOS de los mensajes del flujo (`textosParaElGrupo`) por `emitirAviso` (tipo
`chatbot-aviso-equipo`, `dedupKey` por ocurrencia). No corre condiciones, esperas ni acciones: sin lead
no hay de quién preguntar nada. Dos trampas:

- **`emitirAviso` sin workspace cae al `OWNER_WS`**, que es el ws1, un CLIENTE: un Recurrente de otro
  negocio le hablaría al grupo de Mauricio. `mandarRecurrenteAlGrupo` lee `wsEnContexto()` y sin él no
  manda nada.
- **El barrido sólo corre si el negocio tiene un canal prendido**: `app/api/cron/nutricion` llama a
  `comprometerInscripciones` dentro de esa condición. Un Recurrente que sólo le habla al grupo, en un
  negocio sin WhatsApp ni email, no sale. Es de la ruta del cron (otra parte): está en «sin hacer».

**Vive en:** `lib/nutricion.ts` (`mandarRecurrenteAlGrupo`) · `lib/disparadores.ts` (`textosParaElGrupo`)

### Sacar una etiqueta no avisaba nada, y la etapa no puede disparar «Se elimina» [etiquetas]

`sacarEtiquetaCon` no emitía ningún evento: «Se elimina etiqueta a un lead» no tenía de dónde salir.
Ahora emite `etiqueta_quitada` (con su clave de reclamo `etiqueta-quitada:<id>`), salvo cuando la saca
el cambio de ETAPA: mover a un lead de columna le saca la etiqueta de la columna vieja, y eso dispararía
«Se elimina…» en cada movimiento del kanban.

**Vive en:** `lib/etiquetas-motor.ts` · `lib/etiquetas.ts`

### El contrato con «canales» y «probar»: los eventos nuevos y su `subtipo` [motor]

`EventoNutricion` suma `etiqueta_quitada`, `instagram`, `messenger` y `email_recibido`, y `CtxEvento`
suma `subtipo` (Instagram: `comentario | historia | dm | anuncio | en_vivo | ref`; Messenger: `anuncio |
comentario | dm | ref | qr | tienda`). Hoy no los emite nadie: los webhooks son de la parte «canales».
Los eventos de anuncios se OFRECEN apagados («Todavía no»), como en ManyChat, y con el canal sin
conectar se apagan todos con su motivo (`GET /api/chat-agent/secuencias?canales=1`). «No pude
comprobarlo» también apaga: un evento que no puede llegar es una automatización que no arranca nunca.

**Vive en:** `lib/nutricion.ts` (`EventoNutricion`, `TRIGGERS_POR_EVENTO`) · `lib/disparadores.ts` (`EVENTOS_*`) · `lib/disparadores-canales.ts`

### El catálogo `TRIGGERS` no conoce los tipos nuevos [motor]

`lib/email-marketing.ts` (`TRIGGERS`) es el catálogo con el que `setTriggerSecuencia` valida y con el
que la API de MaKo nombra un disparador. Los seis tipos nuevos no están: el guardado de la lista los
acepta (`TRIGGERS_NUEVOS`), pero `setTriggerSecuencia` los rechaza y `labelDe(TRIGGERS, …)` devuelve el
slug crudo. Sumarlos ahí es de otra parte; mientras tanto, «Crear con IA» y la API sólo editan el
primer CRON con los tipos de siempre.

**Vive en:** `lib/email-marketing.ts` (`TRIGGERS`) · `lib/disparadores-guardar.ts`

### Un test de coherencia en verde con la rotura: el saneo ya hacía el trabajo [proceso]

La regla «`ignorar` sólo vale en las dos etiquetas genéricas» se probó quitándola de
`problemaDeDisparador`, y el test siguió verde: `higiene` (el saneo) ya borraba el campo antes de
validar. El diagnóstico obvio —«el test está flojo»— era el equivocado: la rotura no era observable por
ese camino. Hizo falta un caso que el saneo no limpia (un `subtipo` de Messenger en un CRON de
Instagram). Cuando un guard de validación pasa con la validación quitada, mirá primero si un saneo de
más arriba ya la cumple.

### Proceso: el scratchpad de una corrida es UNO para todas las partes [proceso]

Las ocho partes de esta tanda compartían el directorio de scratchpad: un `msg1.txt` con el mensaje de
un commit lo pisó otra parte antes del `git commit -F`. Se verificó el cuerpo después de commitear
(`git log -1 --format=%B`) y cada parte pasó a su propia subcarpeta. Es la regla de `/tmp` de AGENTS.md,
un nivel más adentro: un scratchpad por SESIÓN no es uno por AGENTE.

### Lo que quedó sin hacer (parte «disparadores»)

- **La tarjeta CRON del lienzo todavía no dibuja la lista**: `FlujoLienzo` ya tiene las props
  (`disparadores`, `onNuevoDisparador`, `onAbrirDisparador`) y SecuenciaPerfil las llena; dibujar una
  fila por CRON con su ícono y «＋ Nuevo CRON», y abrir el panel con ESE CRON, es de la parte «lienzo».
  `app/automations/FlujoLienzo.tsx`
- **El panel del Recurrente pide más alto**: `ALTO_EDITOR_CONTROL` de la entrada es 320 y el Recurrente
  con «A quién» mide ~440. `lib/lienzo-grafo.ts`
- **El barrido no corre sin un canal prendido** (ver arriba): un Recurrente sólo al grupo no sale.
  `app/api/cron/nutricion/route.ts`
- **Ninguna operación de la API cambia los CRON**: la ficha (`ficha_secuencia_mensajes`) los LEE;
  `setTriggerSecuencia` y las tools de antes siguen editando sólo el primero. Y «Crear con IA» elige uno
  solo. `lib/api-mako/areas/chatbot.def.ts` · `lib/flujo-ia.ts`
- **Los webhooks de Instagram, Messenger y Email no emiten los eventos** (parte «canales»), y «Probar»
  no simula un Recurrente ni un evento de canal (parte «probar»).
- **Aplicar la 0241 ANTES del deploy** (el código la tolera ausente: dispara sólo el primer CRON).
  Lo decide Martín. `supabase/migrations/0241_secuencia_disparadores.sql`
- **Nada se vio con clics**: los seis botones, el Recurrente (días, calendario, reloj, huso), «A
  quién», «Ignorar», los eventos apagados y las pastillas de dos CRON se probaron dibujando
  (`tests/editor-disparadores.test.ts`), no en un navegador.
## Sexta tanda (09/10/2026, parte «editores»): el desplegable de la casa, TAG con varias, ACTION en árbol, DELAY sin aviso

Pedido literal en la bitácora (9 oct 18:37): general 9, 10 y 11, CONDITION 2 a 4 («para todos lados»),
TAG 1 y 2, ACTION 1 y 2, DELAY 2 y CRON 1. Rama `wip-v6-editores`.

### Una tarjeta TAG con varias etiquetas: la acción acepta UNA y el validador tira el resto SIN ERROR [editores]

Lo obvio era guardar la lista en el paso (`etiquetaIds: [7, 8, 9]`) y dejar que el motor la corra. Medido el
09/10: `poner_etiqueta_lead` / `sacar_etiqueta_lead` declaran UN `etiquetaId: number`, y `validarInput`
(lib/api-mako/validar.ts) recorre sólo los `parametros` de la def: lo que la def no declara NO LLEGA y nadie
lo dice (`faltanEnPaso` tampoco lo ve). Una tarjeta con tres corría la primera —o ninguna— con la pantalla
mostrando tres. Lo hecho: la primera sigue en `etiquetaId` (así la leen sin cambios la tarjeta, el conteo de
uso, Crear con IA y el freno de Publicar) y TODAS van en `etiquetaIds` sólo si son más de una; con una, el
paso queda exacto como antes. Correr una por etiqueta es `unaPorEtiqueta` + `juntarPorEtiqueta`, para el
ejecutor. ⚠️ **Ese enchufe vive en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts), que no es de esta parte:
sin él corre sólo la primera.** Lo dice un test `todo` en tests/editor-etiqueta.test.ts.

La regla: un dato de MÁS DE UN VALOR en un paso de un flujo lo declara la def o lo parte el ejecutor;
guardarlo y confiar en que viaja es un éxito parcial callado. Los que leen la forma vieja (`params.etiquetaId`
solo), medidos: `etiquetaDeAccion` (lib/flujo-conversacion.ts), `usoDeEtiqueta` (lib/etiquetas-reglas.ts) y
lib/flujo-ia.ts (la vuelta a JSON de «Editar con IA», la resolución de las nuevas, `validarIA`).

**Vive en:** `lib/editor-acciones.ts` (`etiquetasDelPaso`, `paramsConEtiquetas`, `unaPorEtiqueta`, `juntarPorEtiqueta`) · `app/automations/EditorEtiqueta.tsx` · `app/automations/FlujoLienzo.tsx` (`EditorEtiquetaLienzo`)

### «Mover de etapa» y «Mover en otro producto»: cuál sirve lo decide el LEAD, no el flujo [acciones]

Para «faltan muchas acciones», lo obvio era sumar `mover_lead_en_producto`: «Mover de etapa»
(`proponer_cambio_etapa`) mueve SÓLO en el producto principal del lead —el producto que se elige en el editor
es una pista—. Medido en los `preparar` (lib/api-mako/areas/crm.run.ts): `mover_lead_en_producto` rechaza el
producto que es el principal del lead y el producto que el lead no tiene, sin `yaEstaba`. En un flujo pasan
leads con principales distintos, así que con las dos en el menú la equivocada falla en cada lead con una alarma
al dueño. Se dejó afuera, con su porqué en `ACCIONES_DEL_FLUJO`. Lo que falta es UNA «Mover de etapa» que, por
lead, corra una u otra según el producto elegido sea su principal o uno agregado (en el ejecutor, o una acción
nueva del registro).

**Vive en:** `lib/editor-acciones.ts` (`ACCIONES_DEL_FLUJO`) · `lib/api-mako/areas/crm.run.ts` · `app/_components/CamposAccion.tsx` (`SelectorEtapa`)

### Un campo `icono`, tres formas; y lo que cada negocio nombra no lleva ícono [ui]

El `icono` de un renglón del `Dropdown` acepta el NOMBRE de uno del set de la casa (app/_ui/iconos-menu.tsx,
para que lo pida una lista armada en un `.ts`), una URL o `data:` (los logos del ＋), o un dibujo. Un nombre
no trae `:`, `/` ni `.`, así que no se confunde con una URL. ⚠️ `esIconoMenu` va con `hasOwnProperty`: con
`s in TRAZOS`, «toString» era un ícono (lo cazó la rotura B10) y el renglón dibujaba nada con cara de algo.
Lo que nombra cada negocio (etapas, productos, etiquetas) va con su `color`, no con un ícono repetido. Y
«borrar» es UN dibujo (`TRAZOS_BORRAR`) en rojo que no se puede cambiar desde afuera: el rojo no es un prop.

**Vive en:** `app/_ui/iconos-menu.tsx` · `app/_ui/BotonBorrar.tsx` · `app/components/Dropdown.tsx` (`IconoOpcion`) · `app/components/dropdown-reglas.ts`

### Git Bash se come una barra de un argumento que empieza con `//`, y el scratchpad es de las ocho partes [proceso]

- `node reemplazar.mjs archivo nuevo "// ── Marca"` llegó como `/ ── Marca` (MSYS convierte lo que arranca con
  `//` como si fuera una ruta). El reemplazo por anclas calzó un carácter corrido: «///» arriba y «/ ──»
  abajo, y el typecheck lo dijo como «Unterminated regular expression literal» en una línea que no nombra
  la causa. Las anclas de texto van en un archivo (un JSON), nunca por la línea de comandos.
- El scratchpad de la sesión lo comparten las partes de la corrida: un `eol.mjs` de esta parte lo pisó otra
  con el mismo nombre en minutos, y `editores/` traía archivos de la cuarta tanda. Cada parte trabaja en una
  carpeta con su nombre y su tanda (`editores-v6/`).

### Lo que quedó sin hacer (parte «editores»)

- **Los enchufes en archivos ajenos** (el detalle exacto, en el informe de la parte): correr una por etiqueta
  en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts); «Agregar Cualificado y 2 más» en la tarjeta
  (`etiquetaDeAccion` / `textoEtiqueta`, lib/flujo-conversacion.ts); `usoDeEtiqueta` con todas
  (lib/etiquetas-reglas.ts); el ✕ del chip dice «Sacar» (`ChipEtiqueta`, app/_components/etiquetas-cliente.tsx);
  «Poner»/«Sacar» en app/crm/AccionesLoteLeads.tsx, app/crm/lead-view/EtiquetasDelLead.tsx, lib/etiquetas-motor.ts
  (el historial del lead), lib/api-mako/areas/crm.run.ts, crm.def.ts y whatsapp.run.ts, lib/flujo-ia.ts; y el alto
  del panel del TAG (`ALTO_EDITOR_CONTROL.etiqueta`, lib/lienzo-grafo.ts: con varias, 140 scrollea).
- **El barrido del tacho por toda la app** (general 9): `BotonBorrar` / `IconoBorrar` existen y no los usa
  todavía ninguna pantalla. Los lugares: el 🗑 del panel del lienzo (`app/_components/Lienzo.tsx:1060`, el que
  Martín ve); `Icon name="trash"` (app/admin/ui/CatalogoUI.tsx:193, app/_components/PanelAgencia.tsx:66/363/387,
  app/automations/GrabadorAudioPaso.tsx:168, app/automations/OnboardingChatAgent.tsx:1176,
  app/integraciones/NombrarVideos.tsx:245, app/integraciones/ProbarTracking.tsx:298/677,
  app/integraciones/ServicioConfigForm.tsx:806, app/video-generator/EditorAnuncio.tsx:516,
  app/video-generator/ElegirFoto.tsx:240, app/video-generator/PasoTomas.tsx:411,
  app/ads-manager/BarraAcciones.tsx:369); `IconTrash` del composer (app/whatsapp/_shared/composer-icons.tsx:26,
  usado en app/automations/EditorMensajeWhatsApp.tsx:560, app/whatsapp/_shared/ComposerWhatsApp.tsx:342,
  app/whatsapp/_shared/VoiceRecorder.tsx:179); el 🗑 de app/experimentos/RetroTab.tsx:113/188; los trazos sueltos
  de app/crm/AccionesLoteLeads.tsx:147, app/crm/CrmBoard.tsx:263, app/onboarding/Archivero.tsx:79 y
  app/_ui/EditorRico.tsx:542. Las ✕ que BORRAN (no las que cierran) quedan por contar aparte.
- **Los íconos en los ~71 desplegables de la app** (general 10): el `Dropdown` los dibuja y el set existe; los
  pusieron sólo ACTION, TAG y DELAY.
- **Las acciones de Customer Success de la rama de la API** (`wip/api-acciones-0910`: mover en la entrega,
  invitar al curso, mandar el link, cortar el acceso, abrir un módulo): entran a `ACCIONES_DEL_FLUJO` cuando
  la rama llegue a main, y piden controles nuevos (el servicio y la etapa de la ENTREGA, no las del CRM).
- Los campos de abajo del selector de ACTION siguen a 40 de alto (`Select` de app/_ui): «botones gigantes»
  quedó en el principal. `app/_components/CamposAccion.tsx`
- Verlo con clics: el árbol de ACTION, el TAG con tres chips y «＋ Otra», el DELAY a 56 y un desplegable de 8
  opciones con su buscador.
## Sexta tanda (09/10/2026, parte «canales»): Instagram y Messenger por Zernio

Medido contra la doc de Zernio (`docs.zernio.com/llms-full.txt` y `zernio.com/openapi.json` v1.249.1,
bajados el 09/10/2026) y contra producción en sólo lectura. **No se mandó un solo mensaje ni se recibió
un evento real**: todo lo de abajo que dice «doc» es lo que Zernio documenta, no lo que se vio pasar.

### Los disparadores de ManyChat contra lo que Zernio entrega [canales]

| ManyChat | Canal | Qué lo trae en Zernio | ¿Va? |
|---|---|---|---|
| Comenta tu publicación o Reel | Instagram | `comment.received` (`comment.isLive` ausente) | sí: se contesta por privado, UNA vez y en 7 días; a quien no sigue la cuenta, sólo texto |
| Responde a tu historia | Instagram | `message.received` con `metadata.storyReply` | sí |
| Te envía un mensaje | Instagram | `message.received` | sí |
| Hace clic en tu anuncio | Instagram | `message.received` con `metadata.referral.ad_id` | sí: Meta suele mandar primero el post del anuncio SIN referral y el referral en el mensaje que sigue |
| Comenta en tu En vivo | Instagram | `comment.received` con `comment.isLive: true` | sí: la respuesta privada sale mientras el En vivo está al aire |
| Clic en tu enlace de referencia | Instagram | `metadata.referral.ref` (o `referral.received` en un chat que ya existía) | sí, con trampa: en un chat NUEVO Instagram manda el `ref` sólo si la cuenta tiene un Ice Breaker |
| Hace clic en tu anuncio | Messenger | `metadata.referral.ad_id` / `referral.received` (clic de vuelta) | sí |
| Comenta tu publicación | Messenger | `comment.received` (platform `facebook`) | sí, con una duda NO medida: el id del autor de un comentario de Facebook puede no ser su PSID de Messenger, y entonces quien comenta y quien contesta la respuesta privada serían dos filas (en Instagram los dos son el IGSID) |
| Te envía un mensaje | Messenger | `message.received` | sí |
| Clic en tu enlace de referencia | Messenger | `referral.received` / `metadata.referral.ref` | sí |
| Escanea un código QR | Messenger | el mismo `referral`, con un `ref` que empieza con `qr-` | sí, por convención: Meta no distingue escanear de tocar (el QR es el link `m.me/…?ref=qr-…`) |
| Mensajes de tu tienda de Facebook | Messenger | — | **NO: apagado**, «Zernio no avisa los mensajes que llegan desde la tienda» |

La tabla vive en código (`DISPARADORES_SOCIALES`) y `tests/canal-social.test.ts` exige que cada fila
«disponible» la produzca un cuerpo del webhook. Una mención en una historia SÍ llega
(`metadata.isStoryMention`) y no la escucha ningún disparador: no es «te envía un mensaje».

**Vive en:** `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `eventoSocialDe`)

### Instagram NO es el WhatsApp no oficial: la ventana de 24 h acá SÍ existe [canales]

AGENTS.md dice «el WhatsApp del chatbot no tiene ventana de 24 h», y el reflejo es copiar el WhatsApp
tal cual. Para Instagram y Messenger es al revés: un DM sale dentro de las 24 h del último mensaje DE LA
PERSONA, o como la única respuesta privada a un comentario (7 días). Fuera de eso Instagram acepta sólo
`HUMAN_AGENT`, que por política de Meta es para una persona que contesta, nunca para una automatización.

- Un paso social fuera de la ventana NO sale y es **terminal** (cierra el hilo con su motivo): reintentar no
  la abre; sólo la abre la persona escribiendo.
- El reloj de acá es la pre-guarda; lo que manda es la respuesta de Zernio (`PLATFORM_LIMITATION`,
  `privateReplyConsumed`, `not_thread_owner`: `esLimiteDeMeta`).
- **El freno de 20 h del WhatsApp NO aplica**: protege a la línea no oficial de un baneo, y frenar 20 h un
  segundo DM lo dejaría fuera de la ventana.
- Un DELAY de más de 24 h antes de una tarjeta de Instagram la deja siempre afuera: el editor todavía no lo avisa.

**Vive en:** `lib/canal-social.ts` (`decidirSalida`) · `lib/canal-zernio.ts` · `lib/nutricion.ts` (la rama social)

### Un paso de Instagram le habría salido al lead POR WHATSAPP, sin un error [canales]

El diagnóstico obvio era «falta la rama de envío». La causa real eran dos lugares que convierten en
WhatsApp todo lo que no reconocen:

- `setSecuenciaPasos` guardaba `canal: email ? 'email' : 'whatsapp'`: la tarjeta de Instagram se publicaba
  como WhatsApp. Ahora `canalAGuardar` la conserva.
- La respuesta de «Si responde» (`responderConGrafo`) preguntaba `proveedorDelPaso(p) !== 'no_oficial'`, y un
  paso de Instagram «es» no oficial porque no tiene plantilla: salía por la línea. Ahora se frena antes.

La regla está en AGENTS.md: un camino que manda lo que dice un paso pregunta `esCanalSocial` ANTES de
decidir que es WhatsApp.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaPasos`, `procesarEnvios`, `responderConGrafo`)

### Sin WhatsApp ni email, el cron decía 'off' y el DM que sigue a una espera no salía nunca [canales, motor]

(Revisión de la sexta tanda, 10/10/2026.) Lo engañoso es que **el primer DM sale**: va por la vía
rápida del evento, que no mira los interruptores del negocio, y el motor trata Instagram y Messenger
como siempre prendidos (`canalOn`). Una prueba con un mensaje inmediato da verde. Lo que no salía era
lo que viene después de «Esperar 1 día»: eso lo despierta el cron, y sus DOS puertas (el tick y la
corrida de cada hora) devolvían `modo: 'off'` en un negocio sin `envio_whatsapp_enabled` ni
`envio_email_enabled` —el caso de un negocio que usa sólo Instagram, como el ws13— porque la única
excepción que conocían eran los pasos «⚡ Acción». Sin un error, y con la ventana de Meta corriendo.

Es la tercera puerta de la misma familia que la entrada de arriba: un lugar que decide «¿hay algo que
mandar?» con la lista de canales de ANTES. Ahora las dos puertas preguntan con `correSinCanales`
(`lib/motor-tick.ts`, pura y ejecutada en `tests/motor-tick.test.ts`): una acción, o un MENSAJE (por la
clase del nodo, no por el campo `canal`) por Instagram o Messenger. La regla: **al sumar un canal sin
interruptor del negocio, grepeá las puertas que deciden si el motor corre**, no sólo el motor.

**Vive en:** `lib/motor-tick.ts` (`correSinCanales`) · `app/api/cron/nutricion-tick/route.ts` · `app/api/cron/nutricion/route.ts`

### El webhook de Zernio nunca entregó un evento: con key propia, el webhook vive en SU cuenta [canales]

Medido en producción (09/10/2026): los dos negocios con Zernio (ws11 y ws13) tienen key PROPIA, fila de
ruteo por profile y `zernio_workspace.webhook_ok = false` desde agosto. No es la firma ni el ruteo: con
key propia el webhook se registra en la cuenta de Zernio DEL NEGOCIO, y nadie lo registró. Lo registra
MaKo (`asegurarWebhook`, idempotente) cuando el editor de la tarjeta pide la cuenta (POST `/api/zernio`,
«estado»), con un secreto DE ESE NEGOCIO y no el de la plataforma (ver la entrada siguiente).

Y dos trampas de la forma del evento: **un `comment.received` NO trae el profile** (sólo
`account.accountId`), así que el ruteo por profile no alcanza y cada cuenta conectada se reclama aparte
(`zernio_cuenta`); y **Zernio corta a los 5 s**, así que el webhook guarda rápido y dispara la
automatización en `after`. El dedup es por el id del EVENTO (`zernio_eventos`, mig 0242), que es el mismo
en cada uno de los 7 reintentos.

**Vive en:** `lib/zernio.ts` (`asegurarWebhook`, `cuentasConectadas`) · `app/api/webhooks/zernio/route.ts` · `app/api/zernio/route.ts`

### Con key propia, lo que MaKo le da a Zernio lo lee el cliente: el secreto del webhook es por negocio [canales]

Revisión adversarial del 10/10/2026 (hallazgo #4). `asegurarWebhook` escribía el secreto ÚNICO del webhook
(`ZERNIO_WEBHOOK_SECRET`, el que verifica los eventos de TODOS los negocios) en la cuenta de Zernio del
cliente. Medido en producción con un GET: **`GET /v1/webhooks/settings` devuelve el `secret` en claro**
(en la cuenta de la plataforma vino el maestro). O sea que el cliente con su key lo leía y firmaba eventos
de cualquier otro negocio. No llegó a salir: ws13 tenía 0 webhooks y la cuenta de ws11 contesta 402.

- **Cuenta propia: `secretoDeWorkspace(maestro, ws)` y la URL `?w=<ws>`**; la de la plataforma, el
  maestro y la URL pelada. El webhook verifica con el que nombra el `?w=` y, ANTES de reclamar el evento,
  exige que el evento ruteado sea de ese negocio (`aceptaElWorkspace`). El maestro vale sólo para negocios
  sin cuenta propia, preguntado con la lectura estricta.
- ⚠️ **El arreglo obvio (`ws === w`) no alcanzaba.** Con SU propio secreto, el dueño de una cuenta propia
  firma en su `?w=` un `account.connected` con el `accountId` de otro negocio, y el ruteo de una cuenta es
  del primero que la reclama. `account.connected` ya no le cree al cuerpo: reclama las cuentas que lista
  la cuenta de Zernio de ese negocio (`cuentasConectadas`).
- **El parámetro es `w` y no `ws`**: `?ws=` lo lee `proxy.ts`.
- **Se re-apunta sólo el webhook de la URL exacta.** Si un negocio cargara como «propia» la key de la
  plataforma, el de la URL pelada es el webhook que comparten todos los negocios sin cuenta propia.
- Si algún día hay que rotar el maestro, cambian también los secretos de cada negocio: el de la plataforma
  se re-registra a mano, y el de cada cuenta propia en el próximo «estado» de su editor (hasta entonces,
  sus eventos dan 401).

**Vive en:** `lib/zernio-firma.ts` (`secretoDeWorkspace`, `webhookDeLaCuenta`, `aceptaElWorkspace`) · `lib/zernio.ts` (`asegurarWebhook`, `usaCuentaPropia`) · `app/api/webhooks/zernio/route.ts` · `tests/zernio-secreto-por-negocio.test.ts`

### El profile guardado puede ser de OTRA cuenta de Zernio: la key cambia después [canales]

Revisión adversarial del 10/10/2026 (hallazgo #3). ws11 nunca podía usar Instagram ni Messenger, y la
pantalla no decía por qué (decía «Conectar», y conectar contestaba «Zernio no contestó»). La causa no era
la conexión: `zernio_workspace.profile_id` de ws11 es el `mako_ws_11` que acuñó la rama SIN key propia el
15/08, en la cuenta de la AGENCIA, y la key propia llegó el 28/08. `profileIdEfectivo` devolvía el guardado
sin mirar de qué cuenta era, y cada pedido iba a la cuenta de ella con un profile ajeno. ws13 andaba sólo
porque su fila tenía `null`.

- **Con key propia, el guardado vale si está en el `GET /profiles` de ESA key**; si no, se suelta y se usa
  el Default de su cuenta (`profileDeLaCuenta`, puro). La fila de ws11 se corrige sola en el primer pedido
  que conteste su cuenta: no hay que escribirla a mano.
- **Y al revés:** con la key de la plataforma, un `null` guardado (lo que deja una key propia borrada) se
  acuña. Antes el negocio quedaba sin profile para siempre.
- Hoy la cuenta de Zernio de ws11 contesta **402 «Account paused: payment required»** a todo: aunque esto
  esté arreglado, su canal no anda hasta que pague (ver «Lo que quedó sin hacer»).

**Vive en:** `lib/zernio-profile.ts` · `lib/zernio.ts` (`ensureProfile`, `profileIdEfectivo`) · `tests/zernio-profile-propio.test.ts`

### Trampas chicas que se pagan caro [canales]

- **`createLead` tira `meta_ad_id` sin avisar**: lo tiene en `LeadCreateInput` y no en el insert (sí lo
  escribe el alta del instant form). Pasarlo no da error y no guarda nada. `lib/leads.ts`
- **Instagram rechaza el MP3 y el OGG/Opus** (doc de Zernio): las notas de voz de la biblioteca de WhatsApp
  no salen por ahí, y por eso el editor social no graba audio.
- **Un test no puede importar un módulo `server-only`** (el paquete tira fuera de `react-server`): el webhook y
  el motor se fijan sobre el FUENTE, y lo que decide va en módulos puros (`lib/canal-social.ts`,
  `lib/zernio-firma.ts`) que sí se ejecutan.
- **Un ancla de rotura tiene que poder fallar**: dos de las roturas del arnés pasaron en verde la primera vez
  porque el reemplazo no tocaba lo que el assert miraba (un `JSON.parse(raw || …)` contra un assert que busca
  `JSON.parse(raw)`). Se rehicieron; el número que vale es el de la segunda corrida.

### Lo que quedó sin hacer (parte «canales») [canales]

- **Una respuesta por Instagram NO pausa la salida**: `pausarPorRespuesta` pausa y además contesta (asistido,
  «Si responde», la charla) POR WHATSAPP. Hace falta que el motor conteste por el canal donde le escribieron.
  `lib/nutricion.ts` · `lib/zernio-entrante.ts`
- **El tinte de la tarjeta** (`CanalTarjeta` e `identidadDeTarjeta`, de la parte «lienzo») y el rótulo de
  «Probar» con varios canales (`SecuenciaPerfil`). Los colores están en `IDENTIDAD_SOCIAL`.
  `lib/lienzo-grafo.ts` · `app/_components/Lienzo.tsx` · `app/automations/SecuenciaPerfil.tsx`
- **El editor del CRON con los doce disparadores** (parte «disparadores»), el QR dibujado y los Ice Breakers
  que pide el `ref` de Instagram. `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `linkDeReferencia`)
- **Medir en Messenger si quien comenta y quien contesta son la misma fila** (ver la tabla). Si no, la unión
  sale del eco de la respuesta privada (`message.sent`), que hoy no se escucha. `lib/zernio-entrante.ts`
- **Verlo con clics y un evento real**: nada de esto recibió un webhook de verdad.
- **Sin WhatsApp ni email, nadie se INSCRIBE por cohorte** (revisión del 10/10/2026): la rama 'off' de
  la corrida de cada hora corre el motor para lo social pero no llama a `comprometerInscripciones()`
  (sólo `{ soloGrupo: true }`). Una automatización social disparada por un EVENTO anda; una por cohorte
  (antigüedad, residuo) en un negocio que usa sólo Instagram no inscribe a nadie. Decidir si esa rama
  inscribe es de Martín. `app/api/cron/nutricion/route.ts`
- **Un 402 de Zernio llega a la pantalla como «Zernio no contestó»**: `app/api/zernio/route.ts` convierte
  todo 4xx en ese texto. A ws11 (cuenta pausada por falta de pago, medido el 10/10/2026) le tendría que
  decir que es SU cuenta de Zernio la que está pausada y que se arregla pagando ahí
  (`code: 'PAYMENT_REQUIRED'`, `billingUrl` en el cuerpo), como pide AGENTS.md para el error de un tercero.
## Sexta tanda (09/10/2026, parte «whatsapp»): el audio, la grabación, el número y el ✦ por mensaje

### El audio «que no se escucha» no era el audio: un porcentaje cíclico dejaba el reproductor en 0 px [whatsapp]

Síntoma (WhatsApp 1 y 8): en el editor del lienzo la burbuja de un audio salía vacía («no aparece nada») y
en /whatsapp un audio propio mostraba sólo «—» y «⋮», sin play ni duración. Es la familia de la #350.

El diagnóstico obvio —el MP3 de lamejs sin cabecera Xing que la tarjeta #350 apuntaba— era el equivocado.
Medido en orden: **datos** (`wa_mensajes` 89057 del ws1, el audio que Martín se mandó: `media_path` puesto,
MP3 válido, cabecera `fffb`, 30.528 bytes); **server** (la URL firmada contesta 206 `audio/mpeg`);
**navegador** (el mismo archivo en un `<audio controls>` de 240 px dura 2,544 s y suena). Con la burbuja
REAL renderizada y medida en Chrome: el `<audio>` medía **43 px** en /whatsapp y **0 px** en el editor.
La burbuja se ajusta a su contenido (`max-width: 78%` en un flex) y el reproductor tenía
`width: min(240px, 100%)`: ese 100% es cíclico, y para un elemento REEMPLAZADO el navegador lo resuelve
contra cero al calcular el ancho de la burbuja. En /whatsapp sólo la hora y las palomitas le daban 45 px;
los controles nativos de Chrome se esconden de a uno cuando no entran, y el play es el primero que se va.

La regla: **un reemplazado (`audio`, `video`, `img`) adentro de una caja que se ajusta a su contenido lleva
un ancho en px, nunca un % ni un `min(px, %)`**: el % se resuelve contra la caja que mide lo que mide él. El
reproductor pasó a ser propio (▶, avance y tiempo) con ancho en px; adentro de una caja de ancho conocido
(la tarjeta), `100%`. Y para diagnosticar «no se ve», se mide el ancho del elemento antes que el archivo.

**Vive en:** `app/whatsapp/_shared/AudioPlay.tsx` · `app/whatsapp/_shared/BurbujaHilo.tsx` (`ANCHO_AUDIO`) · `tests/whatsapp-sexta-tanda.test.ts`

### Un 78% de una caja que se ajusta a su hijo es un hueco del 22% [whatsapp]

Síntoma (WhatsApp 4): el lápiz y la papelera de la segunda burbuja quedaban lejos del mensaje. La burbuja
llevaba su `max-width: 78%` adentro de un envoltorio que se ajusta a ella: el envoltorio crecía hasta el
ancho del texto y la burbuja ocupaba el 78% de eso, alineada a la derecha. Con un texto largo, un cuarto de
la fila vacío entre los botones y el mensaje. **El tope de ancho lo pone la FILA** (el envoltorio con
`max-width: calc(100% - 70px)`), y la burbuja va al 100% de él (`BurbujaHilo` `maxAncho`). Medido en
Chrome después: 6 px entre la papelera y la burbuja.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`vista`) · `app/whatsapp/_shared/BurbujaHilo.tsx` (`maxAncho`)

### «Terminar» no es «mandar», y un MediaRecorder parado no se reanuda [whatsapp]

Pedido (WhatsApp 7): «al darle enviar, en cualquier lado, no se debe enviar, se debe "terminar"… y donde
aparece el punto rojo, el botón de reproducir… Y si apreto el botón de enviar otra vez, ahí sí se envía».
La sesión (`crearSesionVoz`) va sobre el grabador de siempre: cada ✓ es un `stop` cuyo blob NO se entrega,
se guarda como TRAMO; la ➤ une los tramos y recién ahí entrega. Tres cosas que no se ven en el código:

- **«Seguir grabando» después de terminar no existe en MediaRecorder**: parado, no se reanuda. Pausarlo en
  vez de pararlo dejaba el micrófono prendido mientras la persona escucha. Se graba otro tramo y se unen
  decodificando (Web Audio) en un WAV; quien manda lo pasa a MP3 igual que a un tramo solo (`blobToMp3`
  decodifica cualquier cosa que el navegador entienda), así el camino de envío no cambia.
- **`audioAlSoltar` (EmpresaInbox) ya no decide nada** y el archivo que la pasa no se tocó: la regla vive en
  el composer, que es por donde pasan los tres que graban («en todos lados»). Lo mismo para los grabadores
  del onboarding (`GrabadorAudioPaso`) y `PasoAudioControl`.
- **El composer de ChatHilo va por conversación** (`key`): una escucha a medias ya no viaja al chat de al
  lado. El borrador de AUDIO por chat que guardaba ChatHilo se fue con esto, a sabiendas.

Probado en Chrome con micrófono FALSO (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
y `permissions: ['microphone']`): grabar → ✓ → la barra de escuchar (sin ➤ mientras graba) → 🎤 → ✓ → el
WAV unido dura 2,76 s y suena → ➤ entrega UNA vez.

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearSesionVoz`, `useGrabacionVoz`, `BarraGrabacion`, `unirAudios`) · `app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/ChatHilo.tsx`

### La línea de UN mensaje: en el paso, `null` no es «la de por default» [whatsapp]

WhatsApp 2: el número es de cada tarjeta (`linea` del paso; el motor manda con `lineaDelPaso(paso) ??
sec.instance_name`). El selector de siempre guardaba la de por default como `null`, que en la SECUENCIA es
«la de por default» y en el PASO es «la de la automatización» —que puede ser otra—: elegir la principal en un
mensaje lo dejaba siguiendo a la automatización. Con `explicita` se guarda su nombre (`lineaElegida`).
Y `setSecuenciaPasos` la reconstruye con la regla de las variantes: con la clave manda lo que llega, sin la
clave (la API, /email, el generador) se conserva la del mismo paso por su id (`lineaAlGuardar`). Una línea
pedida que no es del negocio no está en `lineasEvo`: `canalDeLinea` frena el envío con su motivo, sin caer
a otra (AGENTS.md, «Un negocio tiene VARIAS líneas»).

**Vive en:** `lib/mensaje-partes.ts` (`lineaDelPaso`, `lineaAlGuardar`) · `lib/nutricion.ts` (la línea del envío y `setSecuenciaPasos`) · `app/automations/SalidaWhatsApp.tsx` (`lineaElegida`) · `app/automations/EditorMensajeWhatsApp.tsx` (`CabeceraWhatsApp`)

### La pausa entre los mensajes de una tarjeta duerme ADENTRO de la corrida: por eso es corta [whatsapp]

WhatsApp 11. Las partes salen una detrás de otra en la MISMA ejecución (`enviarPartesDelPaso`): una pausa es
el motor durmiendo. El cron (`maxDuration` 300) manda hasta 6 leads y además duerme hasta 150 s por las
esperas cortas; con pausas de minutos, seis leads se comen la función, y una función cortada a la mitad no
escribe cuántas partes salieron: el reintento le repite al lead lo que ya leyó. Topes: 10 s por pausa y 20 s
por tarjeta (`problemaDePartes` al guardar, `pausaAntesDe` en el motor); para más, la tarjeta DELAY, que
programa en vez de dormir. Dos trampas: el audio con pie de siempre (`formaGuardada`) colapsaba
[audio, texto] a los campos de antes y la pausa del texto no tenía dónde guardarse (con pausa, se guarda
como dos partes); y la pausa por default era 1,2 s y la pantalla decía «1 s» (pasó a 1 s redondo).

**Vive en:** `lib/mensaje-partes.ts` (`pausaAntesDe`, `pausasPosibles`, `PAUSA_TOTAL_MAX_S`, `formaGuardada`) · `lib/nutricion.ts` (`enviarPartesDelPaso`)

### El ✦ de MaKo: el contexto por el REGISTRO, y lo que el registro no deja ver desde la app [whatsapp]

WhatsApp 3. La ruta lee el negocio, los productos, el embudo, el curso y la voz con `ejecutarOperacion`
(canal `app`, alcance lectura): las mismas lecturas de MaKo por WhatsApp, con su gating. **`listar_cursos`
contesta 404 desde la app**: el área `curso` declara `canales: ['http']`. Se pide igual y se saltea; el día
que el área sume `'app'`, entra sola (está en «bloqueantes» del reparto). Dos más:

- **El detector de voseo marca «acá»** (`marcasDeVoseo`, lib/puestas-data.ts): un mensaje del modelo con
  «agenda acá» se descarta como voseo. Para el neutro es «aquí»; lo dice el prompt.
- **El «demasiado corto» de WhatsApp 6** (`GUION_PALABRAS.min` 25, lib/guion-audio.ts) no pasa por el ✦: el
  filtro del panel no tiene piso (un audio corto es un audio) y sí el techo. El botón «✦ guion» que lo
  disparaba salió de la grabación; el piso sigue vivo para «Escríbeme el guion» del onboarding.

- **`sinVoz` se decide con la lectura ESTRICTA** (revisión, 10/10/2026): con `sinVoz: true` el panel
  ofrece «Que la aprenda MaKo» y «Escribirla yo», y los dos terminan en `setVozGuia` sin comparar. Leído
  con `getVozGuia` (vía `getSetting`, que vuelve null un error de Supabase), una lectura caída ofrecía
  pisar una guía escrita a mano. Va `hayVozGuiaEstricto().catch(() => null)` y `sinVoz: hayVoz === false`.

**Vive en:** `lib/mako-redacta.ts` · `app/api/chat-agent/redactar/route.ts` · `app/automations/MakoRedacta.tsx`

### Revisión (10/10/2026): lo que se graba es del chat donde se grabó — el composer que MANDA lleva `key` [whatsapp]

Síntoma (hallazgo 7, el más grave de la parte «pantalla»): en /whatsapp, grabar en el chat de A, ✓, tocar
a B y ➤ mandaba la nota a A con la pantalla mostrando a B. La sesión guarda el `onSend` del render en que
se apretó el 🎤, y ése lee el `sel` de ESE render. ChatHilo ya llevaba `key={draftKey}`; EmpresaInbox no.

⚠️ **Lo que engañó: «el archivo que la pasa no se tocó» (la entrada de arriba) se leyó como inocuo**,
porque `audioAlSoltar` ya no hacía nada. Lo que la bandeja necesitaba no era perder esa prop sino la `key`:
el contrato del composer CAMBIÓ (antes no había un rato entre grabar y mandar; ahora el ✓ abre justo el
momento de mirar y cambiar de chat). Cuando un componente compartido cambia de contrato, quien lo monta
se revisa aunque «siga compilando». Va `key={selConv.chatJid}`; `audioAlSoltar` se borró del tipo.

**Vive en:** `app/whatsapp/EmpresaInbox.tsx` · `app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/VoiceRecorder.tsx` (`useGrabacionVoz`) · `tests/whatsapp-sexta-tanda.test.ts`

### Revisión (10/10/2026): la barra de grabar aparece ANTES de que el navegador entregue el micrófono [whatsapp]

Hallazgo 8. `crearSesionVoz.start` pone «grabando» y dibuja 🗑 ⏸ ✓ antes del `await` que pide el permiso.
Con el cartel del navegador puesto, `stop`/`soltar` no encontraban grabador y al dar Permitir el
MediaRecorder arrancaba igual: 🗑 dejaba el micrófono grabando sin barra; ✓ dejaba la barra en `uniendo`
con todo apagado. **La regla:** un pedido de un recurso del navegador que puede tardar (micrófono, cámara,
pantalla) lleva un número de intento y se cancela; y la UI que se dibuja antes sabe que el recurso no
llegó (`pidiendoMic`: ⏸ y ✓ apagados, 🗑 prendido porque es lo que cancela). Afecta a todo lo que monta
`useGrabacionVoz`. Se prueba con un `pedirMicrofono` que se contesta A MANO.

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearGrabadorVoz`, `crearSesionVoz`, `BarraGrabacion`) · `tests/whatsapp-sexta-tanda.test.ts` (`armarMicPendiente`)

### Proceso: un arnés de roturas que restaura en `finally` no restaura si lo matan, y un test con un timer vivo no termina [proceso, tests]

La primera corrida de las roturas del hallazgo 8 se colgó: un recorder falso que quedó «grabando» (porque la
rotura lo dejaba arrancar) mantiene vivo el `setInterval` del grabador, y `node --test` espera para siempre.
Peor: la salida del arnés iba por un pipe y la línea de la rotura anterior no había llegado, así que parecía
colgada la R8a cuando en el disco estaba aplicada la R8b. Matar el arnés no corre su `finally`: el archivo
quedó roto y se restauró a mano, contando cuántas veces aparecía cada `buscar` y cada `reemplazo`.

- **El arnés corre cada test con `timeout` y `--test-force-exit`** (Node 24 lo tiene).
- **Un test que arranca algo con timer lo suelta en un `finally`**, pase o falle: la rotura que el test
  caza es justo la que deja el timer vivo.
- **Después de matar un arnés, la última línea impresa no dice qué rotura quedó en el disco**: se cuenta.

**Vive en:** `tests/whatsapp-sexta-tanda.test.ts` (los tests con `armarMicPendiente`)

### Proceso: el `sinComentarios` de los tests se come el JSX que sigue a un `accept="image/*"` [tests]

El helper que usan decenas de tests (`/\/\*[\s\S]*?\*\//g` después de sacar las líneas `//`) toma el `/*`
de un MIME con comodín ADENTRO DE UN STRING como el inicio de un comentario. Medido en
app/whatsapp/EmpresaInbox.tsx: el `acceptArchivo="image/*,…"` del composer se come 11 líneas (509
caracteres, hasta el próximo `*/` del archivo), con el `/>` del `<ComposerWhatsApp>` adentro. Un guard que
corte el bloque del composer con `sinComentarios` mira otro texto. Es distinto de lo de AGENTS.md (un `text/*`
en un comentario `//`): acá está en el código. Sobre un archivo con un `accept=` se sacan sólo las líneas
`//`, y la regex pide la FORMA del código para que la prosa no la dispare.

**Vive en:** `tests/whatsapp-sexta-tanda.test.ts` (el test de la `key` de /whatsapp) · `tests/pantalla-links-ws.test.ts`

### Proceso: un componente del lienzo se verifica sin `next dev`, con esbuild y Chrome [proceso]

`renderToStaticMarkup` sirve para medir anchos (el HTML real en Chrome headless) pero no ata eventos: un ▶
no suena. Para probar un gesto, esbuild (el del clon) arma el componente con React vivo en un `.js` suelto
(`alias` al worktree, `nodePaths` al `node_modules`) y Playwright lo abre por `file://` con
`--allow-file-access-from-files`. Necesita un `banner` con `var process = { env: {...} }`: `next/link`, que
entra por `app/_ui/Link`, lee `process.env` al importar y sin eso la página queda en blanco. Para grabar,
los flags del micrófono falso de arriba. Ni un POST a producción, y sin el `turbopack.root`.

### Dos guards de OTRAS áreas leían lo que esta parte tocó, y sólo los vio el `npm test` completo [proceso]

Los tests de los archivos tocados daban 124/0; la suite entera, 6400/2. Los dos rojos eran guards que leen
fuente de otra área:

- **Un prompt que CITA el voseo para prohibirlo cae en el guard del voseo** (`tests/puente-panel-copy.test.ts`
  barre `lib/` entero): «Nada de voseo («tenés», «querés»)» en `lib/mako-redacta.ts` lo frenó. Se nombran
  las formas neutras («tienes», «quieres»), nunca las prohibidas.
- **La línea por mensaje rompía un guard de Comunicación**: `tests/lineas-whatsapp.test.ts` exigía
  `const lineaSec = sec.instance_name;` literal en la rama del no oficial de `lib/nutricion.ts`. Se mudó a
  la forma nueva (`lineaDelPaso(paso) ?? sec.instance_name`), probado rompiéndolo (15/1).

La regla: antes de dar por cerrada una parte que toca `lib/nutricion.ts` o un prompt, `grep` de la ruta en
`tests/` (`leer('lib/nutricion.ts')`) dice qué otros guards la miran; correr sólo los propios no los ve.

**Vive en:** `tests/lineas-whatsapp.test.ts` · `tests/puente-panel-copy.test.ts` · `lib/mako-redacta.ts`

### Lo que quedó sin hacer (parte «whatsapp»)

- **Las Notificaciones con la tarjeta MAKO y el editor nuevo (MaKo en WhatsApp 3)**: su lienzo es
  `app/agencia/FlujoAviso.tsx` + `lib/flujo-aviso.ts` (la tarjeta «WHATSAPP» sale de `grafoDeAviso`, del
  CÓDIGO: no hay datos que convertir) y el editor viejo es `app/agencia/EditorMensaje.tsx`. Quedó listo
  `EditorMensajeGrupo` para montarlo; los cambios exactos están en «bloqueantes» del reparto.
- **El título de la TARJETA MAKO** en el lienzo sigue «MAKO» (`TITULO.mako`, `lib/flujo-conversacion.ts`); la
  cabecera del panel ya dice «MaKo en WhatsApp».
- ~~**El onboarding del Video Generator** sigue con el grabador que entrega al soltar y la tarea del alumno
  tiene su propio MediaRecorder~~: cerrado en la segunda pasada (parte «datos»), y desde la revisión del
  10/10 la muestra rechazada vuelve a la barra (ver «La sesión de voz suelta la grabación ANTES…»).
- **El disparador no le llega al ✦** (el `disparador` del lienzo a `EditorDeNodo`, `app/automations/FlujoLienzo.tsx`).
- **El clon de configuración se lleva la línea POR MENSAJE** (`secuenciaParaElDestino`, `lib/clonar-config.ts`):
  vacía `audio_id` y `media_id` y deja la `linea` del paso, que nombra un número del DUEÑO. En el destino
  `elegirLinea` la rechaza (no es del negocio) y ese mensaje no sale, sin caer a la de por default. Va
  `linea` en la misma lista, con su aviso («vuelve a la línea de la automatización»). Duplicar
  (`lib/secuencia-duplicar.ts`) es del mismo workspace y está bien que la conserve.
- **Verlo con clics en producción**: el ✦ con las keys reales de un cliente (sólo se probó la pantalla) y
  la grabación en Safari (el WAV unido se probó en Chrome).
## Sexta tanda (09/10/2026, parte «tiempo»): las esperas a la hora exacta, el horario de envío y el «{ }»

Pedido literal: DELAY 2 («No entiendo el texto "Sigue a la hora en punto"... Eso se hace en todo caso
en configuraciones, no aquí. No pongas esa limitación»), la respuesta del mismo día («Sin límite,
editable»), WhatsApp 10 y MaKo en WhatsApp 4 (el «{ }» en árbol, con muchos más datos, sin «Tu
negocio», igual en todos lados). Rama `wip-v6-tiempo`.

### Un tick cada minuto NO es la corrida de cada hora cada minuto: lo frenado sigue vencido [motor]

La salida obvia —pasar `/api/cron/nutricion` a `* * * * *`— corre el motor entero de cada negocio
cada minuto, todo el día, por una razón que no se ve en el código del cron: una fila frenada por el
anti-ban («msg <20h»), por el tope o por la lectura de la condición NO SE TOCA, sigue vencida, y un
motor que mira «todo lo vencido» la encuentra en cada vuelta. El tick nuevo
(`app/api/cron/nutricion-tick`, `1-59 * * * *`) mira sólo lo que venció en los últimos
`VENTANA_FRESCA_MIN` (10) minutos y, sin nada, termina con dos consultas para todos los negocios; lo
viejo lo sigue barriendo la corrida de cada hora (`0 * * * *`, las 24 h). Medido en prod el 09/10: 0
inscripciones activas, o sea que hoy el tick cuesta 2 consultas por minuto. Vercel Pro: 100 crons por
proyecto y cada minuto (docs del 15/07/2026); con éste son 38.

Lo que el corte no cubre: un hilo en paralelo frenado deja la fila con su hora vieja (la fila resume
el hilo que vence primero, lib/nutricion-hilos.ts), y otro hilo que vence después sale con la corrida
de la hora, no con el tick.

**Vive en:** `app/api/cron/nutricion-tick/route.ts` · `lib/espera-duracion.ts` (`VENTANA_FRESCA_MIN`, `desdeFresco`) · `lib/nutricion.ts` (`vencidasDesde`) · `lib/motor-tick.ts`

### Un tope «por corrida» es un tope por HORA disfrazado: al cambiar la cadencia se multiplica [motor]

`MAX_POR_CORRIDA` (6 WhatsApp) y `RESIDUO_POR_CORRIDA` (1) valían como ritmo anti-ban porque había 9
corridas por día. Con 60 por hora, una cohorte de 30 leads inscriptos juntos saldría en cinco minutos.
Lo cazó un test que ya existía (`tests/nutricion-residuo.test.ts` cruzaba el techo con vercel.json):
el cron nuevo no se dejaba contar. Ahora las corridas del cron comparten el cupo de la HORA DE RELOJ
(`enviosEnLaHora`, opción `cupoPorHora`) y el residuo arranca su contador en lo ya usado (1 por hora,
10 en 24 h, `residuoYaUsado`). ⚠️ De reloj y no 60 minutos móviles: con la ventana móvil, la corrida
de las 11:00 encontraba los 6 que mandó la de las 10:00:05 y no mandaba nada — y es la única que barre
lo viejo. La vía rápida de un evento sigue con su cupo de siempre (un lead).

**Vive en:** `lib/nutricion.ts` (`enviosEnLaHora`, `residuoYaUsado`, `procesarEnvios`) · `lib/nutricion-residuo.ts`

### Un mensaje del motor no se RECLAMA antes de salir: el compare-and-set no lo cubre [motor]

El diagnóstico obvio era «el motor ya tiene compare-and-set, dos corridas no pueden pisarse». Es cierto
para las condiciones, las esperas y las acciones (`modo: 'cas'`); el avance DESPUÉS de mandar un
mensaje es `modo: 'fila'` y el freno anti-ban se lee por lote: dos corridas que leen la misma fila
vencida a la vez mandan las dos. Con una corrida por hora casi no pasaba; con un tick por minuto, una
corrida que tarda más de 60 s (varios WhatsApp con su tipeo, una espera corta durmiendo) se pisa con la
siguiente. Va el TURNO del negocio (`conTurnoDelMotor`, compare-and-set sobre `mako.nutricion.turno`,
vence solo a los 6 min); la corrida de la hora lo espera hasta 60 s en total.

⚠️ **Y la vía rápida TAMBIÉN lo toma, sin esperarlo** (corrección del 10/10/2026, revisión de la
sexta tanda). La primera versión la dejó afuera diciendo «lo de antes, sin cambios», y era falso:
la carrera es entre DOS lectores de la misma fila, y uno de los dos pasó de 9 a 1.440 corridas por
día. La vía rápida (el primer paso de un evento, una inscripción a mano, lo que sigue a una espera
corta) manda un WhatsApp no oficial con el HTTP abierto 1 a 11 s por el tipeo, y recién después
escribe `nutricion_envios` y avanza la fila. Si el tick leía la cola en esa ventana, veía la fila
fresca en el mismo paso, tomaba el turno (nadie lo tenía) y la mandaba otra vez: el lead recibía el
mismo mensaje dos veces, una de cada pocas veces. Instagram y Messenger los frenaba la clave de
Zernio; el WhatsApp, nada. Ahora las tres pasan por `viaRapidaConTurno` (`lib/nutricion.ts`): con el
turno tomado no manda nada y la fila, vencida y fresca, la manda el tick al minuto siguiente. De paso
cubre a la vía rápida que se dispara ADENTRO de una corrida que ya tiene el turno: el motor no se
corre adentro de sí mismo. El guard (`tests/motor-tick.test.ts`) cuenta los llamadores de
`procesarEnvios(` en todo `lib/` y `app/`.

La regla que queda: **cambiar la CADENCIA de un proceso cambia la exposición de todo lo que corre al
lado, aunque ese código no se toque.** «Sin cambios» sobre un código que no cambió es una afirmación
sobre el código; sobre una carrera, es una afirmación sobre los DOS lados, y hay que medirla.

**Vive en:** `lib/motor-turno.ts` · `lib/motor-tick.ts` · `app/api/cron/nutricion/route.ts` (`conTurno`) · `lib/nutricion.ts` (`viaRapidaConTurno`)

### «No pude leer el horario» no es «sin horario» [motor]

El horario de envío (lib/horario-envio.ts, Configuraciones › Horario, apagado por defecto) se lee con
`getSettingEstricto`: con `getSetting`, una base caída devuelve `null`, y `null` ES «sin límite» — un
negocio que puso «de 9 a 18» recibía sus WhatsApps a las 3 de la mañana el día que Supabase tosía. Con
la lectura caída la corrida no manda (`saltado: 'horario-ilegible'`) y lo vencido queda para el minuto
siguiente. Y «sale al abrir» lo cumple el tick: en los primeros minutos del horario barre ENTERO lo
vencido de ese negocio (`acabaDeAbrir`), no sólo lo fresco.

**Vive en:** `lib/horario-envio.ts` · `lib/nutricion.ts` (`horarioDeEnvio`, `dentroDeVentana`) · `app/configuraciones/HorarioEnvioPanel.tsx`

### Revisión (10/10/2026): el server no puede rechazar lo que la pantalla ESCONDE — apagado se guarda siempre [motor, ui]

Hallazgo 11. Prender, sacar todos los días (o cerrar antes de abrir) y apagar: la pantalla valida sólo
prendido (`invalido` mira `activo`) y el «Guardar» quedaba habilitado, pero `horarioParaGuardar` sanea con
las reglas de lectura, que no miran `activo`, y contestaba «Elige al menos un día» con los días ocultos. Lo
guardado prendido seguía limitando. El arreglo obvio —validar en la pantalla sin mirar `activo`— pinta el
error rojo con los controles escondidos. Va en el server: con un `false` LITERAL y lo elegido que no
cierra, se guarda apagado con `HORARIO_SUGERIDO`; un pedido roto sigue siendo error. **La regla:** si la
pantalla esconde un campo en un estado, el server no rechaza ese estado por ese campo.

**Vive en:** `lib/horario-envio.ts` (`horarioParaGuardar`) · `app/configuraciones/HorarioEnvioPanel.tsx` · `tests/horario-envio.test.ts`

### El motor dejaba CRUDO todo token con dígitos: el «{ }» no podía ofrecer más de cinco datos [motor, ui]

`aplicarVariables` (lib/template-vars.ts) matcheaba `[a-z_]+`: `{{lead_fecha_r1}}` salía literal al
lead. Y el motor resolvía sólo nombre, nombre completo, apellido, empresa y negocio, así que el selector
de WhatsApp no podía ofrecer la etapa ni la reunión (AGENTS.md: «La previsualización de un editor no
puede resolver un token que el motor NO resuelve»). Ahora hay UN catálogo (lib/variables-aviso.ts, 75
datos en 10 ramas) con la FUENTE de cada dato y su DESTINO, y el motor lo resuelve con
`datosParaElLead` en sus tres envíos (una lectura por entidad que el texto nombra). Con una llave sola
la regex sigue sin dígitos: un `{1}` de un copy de Meta no es una variable. Las plantillas OFICIALES
(`bodyParams`) siguen con los cinco: sus parámetros los registra Meta.

La regla: **antes de ofrecer un token en un editor, pasalo por la función del MOTOR**, no por la de la
vista previa. Y `lead_nombre` (el completo, de los avisos) y `nombre` (el primero, del motor) eran el
mismo nombre con dos significados: quedan los dos resueltos y sólo `nombre` / `nombre_completo` en el
árbol.

**Vive en:** `lib/variables-aviso.ts` · `lib/variables-del-lead.ts` · `lib/variables-resolver.ts` (`datosParaElLead`) · `lib/template-vars.ts` · `app/_components/SelectorDatos.tsx`

### `v_funnel_productos` no está en `TENANT_TABLES`: `getTenantDb` no la acota [entorno]

Una vista que no está en el `Set` de lib/workspace.ts pasa sin filtro de workspace. Se acota sola sólo
si se filtra por un id que ya es de un negocio (el `funnel_id`, que es global): eso hace el resolvedor
del curso. Una lectura de esa vista sin ese filtro devuelve los productos de todos los clientes.

**Vive en:** `lib/variables-resolver.ts` (`valoresDeSuCurso`) · `lib/workspace.ts`

### El scratchpad es COMPARTIDO entre las partes de una tanda [proceso]

Las 8 partes corren en worktrees distintos pero con el MISMO scratchpad. El mensaje de commit de esta
parte (`msg1.txt`) lo pisó, minutos después de usarlo, el de la parte «canales». Salió bien porque se
commiteó antes; al revés, esta rama llevaba el mensaje de otra. Cada parte escribe en su subcarpeta
(`scratchpad/<parte>/`) y verifica `git log -1 --format=%B` después de commitear.
## Sexta tanda (09/10/2026, parte «probar»): el email de «Probar», el emisor de la prueba real y el email que llega

### «Probar en Email» vacío: no era la bandeja, era el CONTACTO del lead de la prueba [probar]

**Síntoma:** «está configurado el email y en PROBAR no salió nada» — «Sin correos» y «Fin» abajo, en
la «Felicitación al terminar clase» (#226 del ws1: CRON → «Tiene WhatsApp» → Sí: WhatsApp + TAG; Si no:
EMAIL).

⚠️ **El diagnóstico obvio era el equivocado**: la bandeja, la animación y el envío andaban. Medido con
el flujo leído de la base: `hechosDeLeadNuevo` le daba al lead de la prueba teléfono Y email SIEMPRE,
así que «Tiene WhatsApp» salía por el «Sí» y el email del «Si no» no llegaba nunca. Es la misma familia
que «Agendó» en la quinta tanda: decidir como el motor está bien; el DATO estaba mal.

**Regla:** de un lead que acaba de entrar, lo único que NO se sabe es si tiene teléfono y si tiene
email. Esos dos se ELIGEN para el canal que se prueba (`contactoParaProbar`: los dos → sólo el canal
probado → sólo el otro → ninguno; el primero con el que llega algo de ese canal), corriendo el MISMO
recorrido de una vez (`mensajesDelRecorrido`). Lo que sí se sabe (sin agenda, sin pago) no se elige:
un email detrás de «Agendó» sigue sin llegar, y eso es lo que pasa de verdad.

**Vive en:** `lib/simulador-grafo.ts` (`contactoParaProbar`, `mensajesDelRecorrido`, `hechosDeLeadNuevo`) ·
`app/automations/PanelProbar.tsx` (`arrancarRefs`, el `case 'condicion'`) · `tests/probar-email-canal.test.ts`

### El email que llega (Resend): lo que hay que saber antes de tocarlo [email-entrante]

Medido el 09/10/2026 (doc oficial y la cuenta, sólo lectura):

- **El webhook `email.received` trae sólo el SOBRE** (`from`, `to`, `cc`, `received_for`, `subject`,
  `message_id`, los adjuntos sin contenido). El cuerpo se pide aparte: `GET /emails/receiving/{id}`.
  Para disparar alcanza; para una condición sobre el texto, hace falta esa llamada.
- **La cuenta de MaKo tiene UN dominio (hola-mako.com) con `receiving: disabled`, y su único webhook
  (a /api/webhooks/resend) YA está suscripto a `email.received`** y lo tira al `default`. O sea: el día
  que alguien prenda la recepción, los mails llegan a esa ruta y se pierden sin un error.
- ⚠️ **«Opción A: una cuenta de Resend para todos» no es del todo cierto**: los ws 1, 4, 10 y 11 tienen
  su propia `RESEND_API_KEY`, y el único `resend_domain` cargado (ws11, leilafittipaldi.com) NO está en
  la cuenta de MaKo. Un cliente con cuenta propia recibe en SU cuenta: haría falta un webhook allá con su
  secreto.
- **Se rutea por `resend_domain` (se reclama con titularidad), NUNCA por `resend_from`**: el del ws1 es
  «MaKo <equipo@hola-mako.com>», el dominio de la PLATAFORMA. Un subdominio cuenta (el MX recomendado va
  en uno), el reclamo exacto gana, dos workspaces → de ninguno.
- **La fila de `email_entrantes` es la deduplicación Y el rastro**: `email_id` único corta los reintentos
  de Svix; lo descartado queda con su motivo. Un mail de ningún negocio también queda escrito
  (`workspace_id` null), nunca asignado «por default».

**Vive en:** `lib/email-entrante-reglas.ts` · `lib/email-entrante.ts` · `app/api/webhooks/email-entrante/route.ts` ·
`supabase/migrations/0245_email_entrantes.sql` · `tests/email-entrante.test.ts`

### El emisor de la prueba real es un PEDIDO; lo autoriza el envío [probar]

«Probar en WhatsApp / Email» pide «De» (las líneas o el remitente del negocio, con «Vincular nuevo») y
«Para». El emisor viaja del navegador, así que el server no lo cree: la línea la resuelve `elegirLinea`
en el envío (una ajena no manda y NO cae a la de por default) y el remitente, `remitenteDelPaso` (mismo
dominio que el del negocio). Uno que no sirve corta con su motivo ANTES del tope, para no gastar un
lugar. Y hoy hay UN remitente por negocio: «Vincular nuevo» del email REEMPLAZA y lo dice.

**Vive en:** `lib/simulador-grafo.ts` (`sanearEmisorPrueba`, `lineaDePrueba`) · `lib/prueba-paso.ts` ·
`app/automations/PanelProbar.tsx` (`MenuDestinos`, `VincularEmisor`, `CANALES_PROBAR`)

### Lo que quedó sin hacer (parte «probar»)

- **Que llegue un mail de verdad**: prender «Receiving» en el dominio en Resend + el MX del cliente, y
  sumar `email.received` a la ruta nueva (un webhook con `RESEND_INBOUND_WEBHOOK_SECRET`) o delegarlo
  desde /api/webhooks/resend (`case 'email.received'` → `recibirEmailEntrante`). Lo decide Martín.
- **Un email del lead no PAUSA la automatización que le está escribiendo** (una respuesta de WhatsApp
  sí). Es del motor: `lib/nutricion.ts` (`pausarPorRespuesta` del lado del webhook).
- `email_entrantes` tiene que entrar a `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`) y el
  servicio `'email'` a `ServicioRuteo` (`lib/webhook-ruteo-huella.ts`) para anotar los fallos de ruteo
  en el super admin como los demás webhooks.
- `app/automations/SimuladorEmail.tsx` tiene CERO call sites (lo reemplazó la bandeja de `PanelProbar`).
  *(Borrado en la segunda pasada, parte «datos».)*
- Nada de esto se vio con clics: el desplegable «De / Para», «Vincular nuevo» en su modal y la bandeja
  con la #226.

## Sexta tanda, segunda pasada, parte «flujo» (09/10/2026): UNA puerta para las flechas, el borrador y «Si responde» como CONDITION

### Dos puertas para las flechas, y cada una tenía la mitad de las reglas [edicion]

**Síntoma:** el lienzo editaba flechas por DOS módulos: `conectar` / `desconectar` / `crearSuelta` /
`destinosConectables` de `lib/flujo-grafo.ts`, y los de `lib/flujo-edicion.ts`. El primero no miraba si
dos caminos se juntaban; el segundo sí, pero FILTRANDO EL TEXTO de `validarGrafo` (`errorPropio` buscaba
«cuelga de» y el id de la tarjeta en cada error) y con su propia copia de la regla
(`tarjetasDondeSeJuntan`), distinta de `cruces`, que es la que usa Publicar.

⚠️ **El filtro de texto es la parte cara**: el día que alguien reescribe la frase de un error de
`validarGrafo`, la regla del lienzo se apaga sin un rojo. Y la copia de la regla no la pasaban Crear con
IA, la API ni un flujo de antes: lo que el lienzo prohibía entraba por las otras puertas.

**Regla:** toda edición de flechas pasa por `lib/flujo-edicion.ts` (`paraEditar` fija la raíz con
`fijarRaiz` SIEMPRE, antes de tocar nada). Lo que decide es la DIFERENCIA de antes a después, por función
y no por texto: `cruces` (dos caminos que se juntan; con «Si responde», `MOTIVO.conRespuesta`),
`ciclosSinEspera` (`MOTIVO.circulo`) y `validarParaGuardar` (lo que rompe el dato). Un error que ya estaba
no frena la edición de al lado. El guard «UNA PUERTA» de `tests/flujo-edicion.test.ts` falla si
`lib/flujo-grafo.ts` vuelve a exportar una edición de flechas, o si `lib/flujo-edicion.ts` vuelve a leer
el texto de `validarGrafo`.

**Y el círculo:** la regla vieja rechazaba TODO círculo, y `abrirFlujo` (`quitarIrA`) convierte un «Ir a»
hacia atrás en una flecha que cierra uno: la automatización abría con un círculo que la misma pantalla no
dejaba volver a dibujar. Lo que el motor no puede correr es un círculo SIN espera; con espera, se dibuja.

**Vive en:** `lib/flujo-edicion.ts` · `lib/flujo-grafo.ts` (`fijarRaiz`, `cruces`, `ciclosSinEspera`,
`validarParaGuardar`) · `tests/flujo-edicion.test.ts`

### El borrador: «no lo pude leer» y «no hay» son dos respuestas [borrador]

Una automatización a medio armar (una suelta, una condición vacía) no se puede publicar, y hasta acá
tampoco se guardaba: se perdía al recargar. Ahora va a `nutricion_secuencias.pasos_borrador` (mig 0240)
por su propia acción (`action: 'borrador'`), con un respiro, y el motor no la lee nunca.

- **`secuencia.borrador` AUSENTE = no se pudo leer** (falta la columna o falló la consulta); `null` = no
  hay. Con ausente la pantalla abre lo publicado y NO guarda: tratarlo como «no hay» haría que el primer
  cambio pisara un borrador que la pantalla no vio. La ruta contesta `sinColumna` y el lienzo deja de
  mandar sin cartel.
- **Publicar descarta el borrador** y anota lo publicado como ya guardado (sin eso, el respiro lo volvía
  a mandar como borrador). Un borrador cuya base cambió no se abre (`borradorVigente`).
- **La lógica de un hook con relojes no se prueba leyendo el fuente**: vivía en refs y el único test
  posible era un regex. Pasó a `crearBorrador` (sin React) y se ejecuta con `mock.timers` — ocho
  roturas de comportamiento (respiro, `sinColumna`, rechazo, despachar al irse, descartar) que un guard
  de cableado no habría visto.

**Vive en:** `app/automations/useBorradorSecuencia.ts` · `app/automations/SecuenciaPerfil.tsx` ·
`app/api/chat-agent/secuencias/route.ts` · `lib/setting-secuencias.ts` (`getSettingData`) ·
`lib/secuencia-borrador.ts` · `tests/chatbot-v6b-flujo.test.ts`

### La base del borrador la pone la pestaña que LEYÓ, no el momento de guardar [borrador, revisión 10/10]

**Síntoma (revisión adversarial, reproducido con las funciones reales):** la pestaña A abre X; MaKo por
WhatsApp, otra pestaña o un hand-off (que le suma un caso a «Si responde») publican Y; A toca una tarjeta y
guarda X+cambio. El server anotaba como base lo publicado AL GUARDAR (Y), así que al recargar —en todas las
pestañas, también la que publicó Y— se abría el borrador viejo encima de Y, sin aviso, y Publicar revertía Y.
`borradorVigente` comparaba bien, sobre el dato equivocado.

**Regla:** un token de «sobre qué versión trabajo» lo pone QUIEN LEYÓ y viaja con cada escritura; el server
compara y, si no coincide, no escribe y lo dice (409 `desactualizado` → «Cambió lo publicado: recarga»).
Guardar con la base del cliente y dejar que `borradorVigente` lo descarte es peor: queda guardado y no se
abre nunca, o sea perdido sin aviso.

⚠️ **El arreglo obvio era el equivocado: calcular la huella en el navegador.** `firmaPublicado` es pura,
pero `setSecuenciaPasos` reconstruye cada paso campo por campo y le mergea variantes, partes y remitentes:
la firma de lo que el lienzo mandó a publicar no es la de lo que quedó en la fila (leído en el código, no
medido). Con la huella del navegador, cada borrador después de publicar se rechazaría como «otro publicó».
La calcula el server en el GET (`getSettingData`, sobre la MISMA columna cruda que lee
`guardarBorradorSecuencia`) y, después de publicar, la devuelve `descartar-borrador`.

**Lo que eso arrastra (`crearBorrador`):** publicar cierra una compuerta (lo que sale de su respiro espera
la base nueva, o el cartel acusaría a otro de lo que publicó esta pestaña) y las respuestas de antes del
PATCH no se escuchan. «Descartar» y «Volver a lo publicado» NO adoptan la base que contesta el server (no
publicaron nada), y el borrado sale DETRÁS de lo que ya salió: al revés, un guardado lento lo resucitaba.

**Y «Descartar cambios» guardaba lo descartado:** la pregunta vive en SimuladorWhatsApp, cambiar de
automatización desmonta el lienzo, y el desmonte despacha lo que esperaba su respiro. Va por una ref que
llena SecuenciaPerfil (`descartarBorrador`) y la tab llama ANTES de cambiar. Al irse se relee la lista
(`cerrar` → `onSalir`) cuando el server quedó distinto: la lista se lee al entrar, y volver a la misma
automatización en la visita abría lo de la entrada. ⚠️ Releerla en el acto, como pedía el verificador,
compite con el borrado en vuelo: el GET puede ver el borrador todavía. Va después de que el borrado volvió.

⚠️ **Un test de «descartar no guarda lo pendiente» que llama `yaGuardado` antes del desmonte da verde con
el bug puesto** (`yaGuardado` suelta lo pendiente por su cuenta): roturas M8 y M9 en 22 / 0 hasta partirlo.

**Vive en:** `lib/secuencia-borrador.ts` · `app/automations/useBorradorSecuencia.ts` ·
`app/automations/SecuenciaPerfil.tsx` · `app/api/chat-agent/secuencias/route.ts` ·
`lib/setting-secuencias.ts` · `tests/secuencia-borrador.test.ts` · `tests/chatbot-v6b-flujo.test.ts`

**Sin hacer:** el enchufe en `app/automations/SimuladorWhatsApp.tsx` (`descartarBorrador.current?.()` en
`descartar()`, antes de cambiar) y `base?: string` en `SecuenciaDto` (`app/automations/ChatAgentApp.tsx`;
hoy SecuenciaPerfil lo lee con `SecuenciaConBase`). Quedan dos ventanas de milisegundos: otro que publica
entre el PATCH y la respuesta de `descartar-borrador` (la pestaña tomaría su base), y un guardado que espera
la compuerta cuando se cierra la pestaña.

### «Si responde» se DIBUJA como la CONDITION que escucha; el dato sigue siendo `respuesta` [respuesta]

Punto 12: «Reply ya te dije que tiene que estar dentro de CONDITION». Se cambió el DIBUJO, no el nodo:
`nodo: 'respuesta'` lo leen el motor, «Probar» y la API, y renombrarlo era una migración de datos sin
ganancia. La tarjeta se titula CONDITION, una fila por caso (`textoCasoRespuesta`) y la última «Si no»;
el CRON pierde su fila «Si responde» y su flecha; el ＋ ya no la ofrece. Se crea eligiendo «Su respuesta
trata de» en una CONDITION vacía (`condicionARespuesta`, desde `EditorDeNodo`), una por automatización.

⚠️ **Sin flecha de entrada, el layout la ponía donde cayera en el array**: se crea al final, así que
una suelta creada antes quedaba entre el CRON y ella. Va PRIMERA entre lo que no cuelga del CRON
(`libres` en `grafoDeSecuencia`), y no se marca suelta.

**Vive en:** `lib/flujo-conversacion.ts` (`grafoDeSecuencia`, `tituloDeTarjeta`) · `app/automations/FlujoLienzo.tsx`
(`case 'condicion'`) · `lib/flujo-grafo.ts` (`condicionARespuesta`)

### El aviso de las 24 h es una aproximación, y lo dice [ventana-meta]

Un DELAY de más de 24 h justo antes de Instagram o Messenger marca la tarjeta «Tras 24 h no sale»: Meta
deja escribir sólo dentro de las 24 h del último mensaje DEL LEAD (`VENTANA_META_MS`) y el motor cierra
el paso sin mandar. `esperaAntesDe` suma las esperas pegadas (dos seguidas son una), toma el padre que
más espera y no cuenta «antes de la reunión» (depende de la fecha).

⚠️ **Lo que mide no es la ventana**: mide la espera de ANTES de la tarjeta. Un DM tras 2 h de espera
también cae fuera si el lead escribió hace tres días; eso sólo lo sabe el motor al mandar. El aviso caza
el caso que se puede ver dibujando, nada más.

**Vive en:** `lib/flujo-conversacion.ts` (`esperaAntesDe`, `AVISO_VENTANA_META`) · `lib/canal-social.ts`

### Lo demás, medido

- **`ALTO_EDITOR_CONTROL`** sale de medir los paneles, no de un número a ojo: el CRON con el Recurrente
  (seis filas de 36 + 5 huecos de 8, «＋ Nuevo CRON», el pie y la cabecera de 62) pide ~460; la etiqueta
  en columna, ~200. `lib/lienzo-grafo.ts` · `tests/lienzo-muelles.test.ts`
- **La tarjeta MAKO ofrece los datos del EQUIPO con lead** (`datosOfrecidos({ destino: 'equipo', conLead:
  true })`), pero PLANOS con el grupo de prefijo: montar el árbol (`SelectorDatos`) dentro de su panel
  dibujaba un segundo «{ }» al lado del de `EditorMensajeGrupo`, que no es de esta parte.
  `app/automations/FlujoLienzo.tsx` (`GRUPOS_MAKO`, `DATOS_MAKO`)
- **Quitar dos tests de un archivo deja viejos los números de sus roturas**: la cabecera de
  `tests/flujo-bucle-paralelos.test.ts` decía «4 / 2» y «2 / 4» sobre seis tests que ya eran cuatro. Al
  borrar tests, se re-miden las roturas que quedan.

### Lo que quedó sin hacer (parte «flujo»)

- **Nada se vio con clics**: el borrador al recargar, la condición que pasa a escuchar, las filas del
  CRON abriendo cada una su CRON, el aviso de las 24 h, la papelera roja en el panel y en las condiciones.
- **El árbol de datos en la tarjeta MAKO**: `EditorMensajeGrupo` (app/automations/EditorMensajeWhatsApp.tsx)
  tiene que aceptar `grupos?: GrupoDatos[]` y dibujar `ArbolDeDatos` en su «{ }»; después `EditorMako`
  le pasa `grupos={GRUPOS_MAKO}` y `DATOS_MAKO` se borra.
- **`IconoBorrar` de app/automations/IconosDisparador.tsx** quedó sin call site (todos usan el de
  app/_ui/BotonBorrar.tsx): se borra.
- **`PasoConLinea`** (app/automations/EditorMensajeWhatsApp.tsx) sobra desde que `PasoSecuenciaDto` trae `linea`.
- **La mig 0240 sin aplicar no rompe nada** (el GET no trae el borrador y el lienzo no guarda), pero sin
  ella el punto 7 no existe: va antes o junto con el deploy. `supabase/migrations/0240_secuencia_borrador.sql`
- **Sin ícono a propósito**: los días, meses, ordinales y zonas de `EditorRecurrente`, el operador ≥/≤ de
  la condición y las líneas de WhatsApp (son del negocio, con su punto de color). Si Martín los quiere,
  es una fila por desplegable.
- `repartenEnBucle` sigue exportada sólo para sus tests y `admiteParalelo`. `lib/flujo-grafo.ts`
## Sexta tanda, segunda pasada, parte «motor» (09/10/2026): los enchufes del motor, los webhooks y la API

Las ocho partes dejaron salidas con cero call sites; esta pasada las enchufó (rama `wip-v6b-motor`).
De las listas «sin hacer» de arriba quedaron CERRADOS: la pausa por una respuesta de Instagram o
Messenger, el email que llega por el webhook de siempre de Resend, `email_entrantes` en
`TABLAS_DE_INQUILINO` y `'email'` en `ServicioRuteo`, el Recurrente al grupo con los canales apagados,
una operación de la API para cambiar los CRON (`cambiar_crons_secuencia`), los seis tipos en
`TRIGGERS`, la tarjeta MAKO con el catálogo entero del «{ }», «Probar» con los datos nuevos y los
textos de la API con «de 9 a 21». Lo que sigue es lo que ahorra tiempo después.

### Sacar un cast de «INTEGRACIÓN» no integra: el webhook y el CRON hablaban dos idiomas [canales, motor]

El diagnóstico obvio del bloqueante era «falta el evento en `EventoNutricion`; cuando esté, se saca el
cast». Se sacó, compiló perfecto, y un CRON «El usuario envía un mensaje» no iba a arrancar NUNCA: el
lector del webhook (`eventoSocialDe`, parte «canales») dice `mensaje`, `comentario_vivo`, `referencia`,
y el CRON (`EVENTOS_INSTAGRAM` / `EVENTOS_MESSENGER`, parte «disparadores») guarda `dm`, `en_vivo`,
`ref`. `disparaPorEvento` compara exacto. 3 de los 11 eventos que llegan no coincidían, y la tienda de
Facebook se ofrecía encendida en el CRON con Zernio sin avisarla.

**La regla:** cuando un productor y un consumidor se escriben en paralelo, el cast que los une esconde
también los VALORES, no sólo el tipo. Al sacarlo, un test que CRUCE las dos tablas en las dos
direcciones (todo lo que llega cae en algo del CRON; todo lo que el CRON ofrece encendido llega). La
traducción vive en UN lugar (`subtipoDelEvento`).

**Vive en:** `lib/disparadores.ts` (`subtipoDelEvento`, `EVENTOS_MESSENGER`) · `lib/zernio-entrante.ts` · `tests/disparadores-canal-social.test.ts`

### «¿Hay quién escuche?» preguntaba otra cosa que «¿a quién inscribo?»: un lead por cada DM [canales]

`hayQuienEscuche` decide si se CREA un lead para alguien que escribió por Instagram, y preguntaba
`trigger_tipo.includes(canal)`: el PRIMER CRON y cualquier evento del canal. Con un CRON «comenta tu
publicación», cada persona que mandaba un DM quedaba como lead del CRM, y un segundo CRON de Instagram
no contaba. Ahora es la MISMA pregunta que al inscribir (`escuchaElEvento`: `disparaPorEvento` sobre
`vistasPorDisparador`). Dos funciones que contestan «¿esto arranca algo?» con dos criterios terminan
creando leads que nada inscribe.

**Vive en:** `lib/disparadores.ts` (`escuchaElEvento`) · `lib/zernio-entrante.ts` (`hayQuienEscuche`)

### Una respuesta por Instagram pausa SIN contestar, y la pausa va ANTES del disparo [motor]

Llamar a `pausarPorRespuesta` desde el webhook de Zernio, tal cual, le contestaba por WhatsApp a quien
escribió por Instagram (el destrabe, el asistido y la charla contestan). Con `origen: canal` corta
después de pausar lo activo y lo terminado, y antes de todo lo que contesta. Y el orden en el `after`
importa: el mismo DM puede arrancar una automatización de «Te envía un mensaje», así que pausar DESPUÉS
del disparo pausaba la que ese mensaje acababa de arrancar. El negocio ve la respuesta en su Instagram
(MaKo no tiene bandeja de Instagram desde el 06/10).

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`, `soloPausa`) · `app/api/webhooks/zernio/route.ts` · `lib/zernio-entrante.ts` (`pausarRespuestaSocial`)

### Con los canales apagados, el Recurrente al grupo NO puede ser «correr el barrido» [motor]

El bloqueante pedía llamar `comprometerInscripciones()` cuando alguna automatización tuviera un
Recurrente al grupo. Hecho así, un negocio con los dos canales apagados (modo 'off') pasaba a inscribir
a TODAS sus cohortes, y el día que prendiera un canal le salían semanas de mensajes juntos. Va
`soloGrupo`: reclama la ocurrencia y le manda al grupo (que sale por la línea de MaKo, no por la del
negocio) sin inscribir a nadie. Un Recurrente mixto (cohorte + grupo) pierde esa ocurrencia para la
cohorte, que es lo que ya pasaba con los canales apagados.

**Vive en:** `lib/nutricion.ts` (`comprometerInscripciones({ soloGrupo })`) · `app/api/cron/nutricion/route.ts` · `lib/disparadores.ts` (`tieneRecurrenteAlGrupo`)

### Nombrar un disparador no es poder elegirlo por cualquier puerta [motor]

Sumar los seis tipos a `TRIGGERS` (para que la API no diga el slug crudo) los ofrece también en el
selector de /email y en la API de email, que escriben SÓLO `trigger_tipo`: un «instagram» sin su evento,
un «email_recibido» sin subtipo o un «grupo_mako» sin horario quedaban como una automatización que no
arranca nunca. `SOLO_DESDE_EL_CRON` los rechaza en esas puertas; las dos de etiqueta («Se agrega / se
elimina») sí pasan (su «Ignorar» es opcional). ⚠️ Queda abierta la de `setTriggerSecuencia`
(lib/setting-secuencias.ts, de otra parte): ver «sin hacer».

**Vive en:** `lib/disparadores.ts` (`SOLO_DESDE_EL_CRON`) · `lib/email-marketing.ts` · `lib/api-mako/areas/email.run.ts`

### Un campo que pasa de UNO a una LISTA: los lectores no fallan, miran la primera [etiquetas]

La tarjeta TAG guarda la primera en `etiquetaId` y todas en `etiquetaIds`. Un `grep` de `etiquetaId`
dio cinco lectores que miraban sólo la primera, cada uno con su síntoma mudo: el ejecutor corría UNA
(el validador del registro tira lo no declarado), archivar la 2.ª contaba «nada la usa», la copia a un
workspace de prueba llevaba la 2.ª con el id del DUEÑO, y Crear con IA guardaba NEGATIVO el ref de una
etiqueta nueva en la 2.ª posición. ⚠️ Medido: «Editar con IA» NO perdía las demás (sólo agrega,
`deIAEdicion`), pero su contexto (`aIA`) decía una sola. Y `etiquetasDelPaso` no sirve en flujo-ia: tira
los ids negativos, que ahí son etiquetas por crear (`etiquetasDeAccion`).

**Vive en:** `lib/api-mako/flujo.ts` (`ejecutarDesdeFlujo`) · `lib/etiquetas-reglas.ts` (`usoEnPasos`, `traducirEtiquetasEnSecuencia`) · `lib/flujo-ia.ts` · `tests/etiquetas-varias-lectores.test.ts`

### La copia a un workspace de prueba llevaba la línea por mensaje y los archivos de las partes [motor]

`secuenciaParaElDestino` vaciaba el audio y el archivo del PASO, no los de sus partes (cuarta tanda), y
no conocía la `linea` por mensaje (sexta): en el destino `elegirLinea` no encuentra la línea del dueño y
ese mensaje no sale, sin caer a la de por default. Ahora es una función pura con test
(`pasosParaElDestino`). ⚠️ `lib/datos-mau.ts` copia secuencias por otro camino y no la usa.

**Vive en:** `lib/clonar-pasos.ts` · `lib/clonar-config.ts`

### Los datos «{ }»: lo que se ofrece se resuelve, en la tarjeta MAKO y en «Probar» [motor]

La tarjeta MAKO EN WHATSAPP resolvía los cinco del motor y la parte «flujo» le monta el árbol del equipo:
ahora `conVariables` con destino 'equipo' y el workspace del ctx, con lo del motor como `datos` (gana) y
`aplicarVariables` después para lo de antes con UNA llave (`{nombre}`), que el catálogo no lee.
«Probar» y la prueba real resuelven con los ejemplos del catálogo (`datosDeEjemplo`), salvo el nombre
del negocio: es el real o queda crudo, como en el motor (uno inventado se leería como el del cliente).

**Vive en:** `lib/api-mako/areas/chatbot.run.ts` (`textoDelAviso`) · `lib/simulador-grafo.ts` (`datosDeEjemplo`) · `lib/setting-secuencias.ts` (`probarSecuencia`)

### La API: cambiar los CRON, y las dos lecturas del curso por la app [api]

`cambiar_crons_secuencia` es de PANTALLA y SIN http (cambia a quién le escribe; exponerlo a un token es
la decisión del snapshot), y se guarda por la MISMA puerta que la pantalla. `prepararDisparadores`
chequea contra el negocio sin escribir: un rechazo al confirmar consumiría la pendiente. `ignorar` y
`cron.dias` viajan como TEXTOS (el validador no tiene listas de números) y el saneador del CRON ya los
convierte. ⚠️ En un `preparar()` no va `tzDeWorkspace`: si la zona falta, la averigua y la ESCRIBE.
`listar_cursos` y `ver_curso` salen también por la app (el ✦ las pedía y contestaban 404): son la
estructura del curso, sin una sola persona.

**Vive en:** `lib/api-mako/areas/chatbot.def.ts` / `.run.ts` · `lib/disparadores-guardar.ts` · `lib/api-mako/areas/curso.def.ts` · `tests/api-mako-crons.test.ts`

### Medido en producción (sólo lectura, 09/10/2026) [entorno]

Sin aplicar: `email_entrantes` (0245), `zernio_eventos` (0242), `nutricion_secuencias.disparadores`
(0241) y `.pasos_borrador` (0240). `ig_conversaciones` e `ig_mensajes` SÍ existen (no medí si con las
columnas nuevas). Hasta aplicar la 0242 el webhook de Zernio contesta 500 en cada evento (el reclamo del
dedup no tiene tabla): fail-closed, pero ⚠️ con el webhook ya registrado (lo registra el editor al pedir
la cuenta, `asegurarWebhook`) Zernio apaga el endpoint a los 3 días sin una entrega buena. La 0242 va
ANTES del deploy. La tabla que falta contesta `PGRST205`, no `42P01`: ver
[hallazgos-infra.md](hallazgos-infra.md) → «Borrar un inquilino entero».

### Lo que quedó sin hacer (parte «motor»)

- **`setTriggerSecuencia` acepta los seis por `TRIGGERS`**: hay que rechazar `SOLO_DESDE_EL_CRON` ahí
  también (`lib/setting-secuencias.ts`, otra parte). Hoy lo llaman /email (cerrado en su puerta), la API
  de email (cerrada) y la ruta del CRON de antes (`action: 'trigger'`).
- **Un email del lead no pausa** lo que le escriben (una respuesta de WhatsApp sí). Es una decisión de
  producto: con `origen: 'email'` sería una línea en `recibirEmailEntrante`. `lib/email-entrante.ts`
- **`cambiar_crons_secuencia` por HTTP**: es una decisión (el snapshot y su fila en `lib/api-mako/rest.ts`).
- **La copia de `lib/datos-mau.ts`** no usa `pasosParaElDestino`.
- **El clon no copia `disparadores`** (la lista de CRON): una automatización con varios llega con uno, y
  un primer CRON de Instagram llega sin su evento. `lib/clonar-config.ts` (`TABLAS`, la fila de
  `nutricion_secuencias`).
- **`noExiste` de `lib/reset-workspace.ts` mira sólo `42P01`** (ver infra).
- **Verlo con clics y con un evento real**: nada de esto recibió un webhook de verdad.
## Sexta tanda, segunda pasada, parte «datos» (09/10/2026, noche): el «{ }» montado, MaKo en WhatsApp en Notificaciones, los grabadores

Rama `wip-v6b-datos`. Enchufó lo que la primera pasada dejó escrito y sin llamar: el árbol del «{ }»
en los editores, la tarjeta y el editor de MaKo en Configuraciones › Notificaciones, la sesión de voz en
los dos grabadores que faltaban, el modal de «Vincular nuevo» de «Probar».

### «El mismo «{ }» en todos lados» NO es el mismo árbol en todos lados: lo que se ofrece lo decide el CANAL [ui, motor]

El bloqueante decía «`ArbolDeDatos` con `datosOfrecidos({ destino: 'lead', conLead: true })` en el
editor de WhatsApp», y montarlo así en los tres editores era el diagnóstico obvio. Medido contra el motor
(lib/nutricion.ts), el catálogo entero sólo se resuelve por DOS caminos: el WhatsApp no oficial y el
email, que pasan el texto por `datosParaElLead`. La vía OFICIAL manda la plantilla de Meta con
`bodyParams: valoresVariablesLead(...)` (cuatro datos), e Instagram / Messenger llaman a
`enviarPasoSocial` con `vars: valoresVariablesLead(...)` (los mismos cuatro). Con el árbol entero ahí,
`{{lead_fecha_r1}}` le llegaba CRUDO al lead.

**Regla:** el «{ }» de un mensaje al lead sale de `datosDelLead(todos)`
(app/automations/EditorMensajeWhatsApp.tsx): el árbol de la casa recortado a lo que el motor resuelve POR ESE
CANAL. Antes de ofrecerle el árbol entero a un canal nuevo, se busca en lib/nutricion.ts con qué `vars`
sale su envío. Y el test que fija «el editor ofrece sólo lo que el motor resuelve» lee al MOTOR, no al
editor: el de tests/editor-email-gmail exigía importar de lib/template-vars.ts «porque el envío de
nutrición no resuelve las de /mensajes», una premisa que la parte «tiempo» volvió falsa el mismo día —
ahora cruza el editor con el `datosParaElLead` del envío del email.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`datosDelLead`, `arbolDeVariables`) · `app/automations/EditorEmailGmail.tsx` · `app/automations/EditorMensajeSocial.tsx` · `lib/nutricion.ts` (los `vars` de cada envío)

### Cambiarle el `tipo` a un nodo para que herede la identidad de otro: grepear quién decide por `tipo` [lienzo]

La tarjeta del mensaje al grupo de Notificaciones tenía que verse como «MaKo en WhatsApp» sin tocar
`Lienzo.tsx`. `identidadDeTarjeta` pinta por `canal` y por `tipo`, así que alcanza con `tipo: 'mako'` (y
`ICONO_MAKO`, el logo) en `grafoDeAviso`. Lo que cuesta no está en el lienzo: FlujoAviso decidía el cuerpo
de la tarjeta con `n.tipo === 'mensaje' && n.id === 'mensaje'` y los tests contaban `tipo === 'mensaje'`;
los dos pasaron a preguntar por el ID, que no cambia porque las posiciones guardadas se podan por id.
⚠️ Y `editorDeTarjeta` (lib/lienzo-grafo.ts) mide el panel por `tipo`: un `mako` tiene 280 de alto. Hoy
/mensajes no pasa `muelles` y no le afecta; el día que los pase, el editor del aviso queda en 280.

**Vive en:** `lib/flujo-aviso.ts` (`grafoDeAviso`, `TITULO_MAKO_EN_WHATSAPP`) · `app/agencia/FlujoAviso.tsx` · `app/_components/Lienzo.tsx` (`identidadDeTarjeta`, no se tocó)

### La sesión de voz suelta la grabación ANTES de entregarla: quien sube y puede fallar la tiene que devolver [whatsapp, curso]

`crearSesionVoz.enviar` vacía la revisión y vuelve a `quieta` antes de llamar a `onSend`, a propósito
(un doble clic no la manda dos veces). Para un consumidor cuya subida puede fallar —la tarea de audio del
alumno— eso es perder la grabación en el primer 5xx: antes, su grabador propio volvía a «grabado». Se
devuelve con `revisarExistente({ blob, secs })`. Y varios tramos se unen en un WAV (`unirAudios`): ~5,6 MB
por minuto, 57 MB con el tope de 10 minutos de una tarea; quien sube un archivo lo pasa a MP3 antes
(`blobToMp3`, ~1 MB por minuto). El composer de WhatsApp ya lo hacía; la tarea del alumno no tenía por qué
saberlo.

**Regla:** al montar `useGrabacionVoz` donde lo que se hace con el audio puede fallar, el fallo vuelve a
la barra de escuchar; y si se SUBE, el WAV no viaja.

⚠️ **La regla nombraba OnboardingVideoGen y sólo TareaAlumno la cumplía** (revisión, 10/10/2026, hallazgo
10). Ahí se perdía hasta 90 s leídos en voz alta, y el caso común no es una subida que falla sino el piso
de 20 s: con 15 s grabados la sesión ya se había vaciado y no quedaba ni el 🎤 para sumar el tramo. Y el
diagnóstico del revisor culpaba a ElevenLabs, que no está en este camino: la rama multipart de
/api/onboarding/voz sube a Storage (`subirMuestra`); ElevenLabs falla en `clonar`, sin grabación en juego.
`subirGrabacion` devuelve si sirvió y `GrabadorVoz` llama a `revisarExistente` con el blob de la sesión.
Siguen sin cumplirla `GrabadorAudioPaso.subir` y `EditorMensajeWhatsApp.usarAudio` (app/automations) y el
`enviarAudioBlob` de /whatsapp (una nota cuyo envío falla se pierde).

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearSesionVoz`, `unirAudios`) · `app/compartido/curso/[token]/TareaAlumno.tsx` (`CampoGrabacionAudio`) · `app/video-generator/OnboardingVideoGen.tsx` (`GrabadorVoz`, `subirGrabacion`)

### Borrar un archivo sin llamadores pone en rojo tests/dev-areas, y `areas.ts` no es de ninguna parte [proceso]

app/agencia/EditorMensaje.tsx quedó con cero llamadores al pasar los avisos al editor de WhatsApp, y se
borró. tests/dev-areas.test.ts exige que cada ruta del `vive[]` de app/admin/dev/areas.ts exista, y
`app/agencia/EditorMensaje.tsx` está en el del área de configuraciones. Con el reparto por archivo,
`areas.ts` no es de ninguna parte: todo borrado de un archivo declarado ahí deja un rojo que sólo arregla
quien integra. Es la regla de AGENTS.md («al mover o renombrar un archivo, grepeá su ruta vieja en … 
app/admin/dev/areas.ts») vista desde el reparto: el bloqueante se escribe con la línea exacta.

**Vive en:** `app/admin/dev/areas.ts` (el `vive` de configuraciones) · `tests/dev-areas.test.ts`

### «El trailer PEGADO sin línea en blanco» es entre los dos trailers, no con el cuerpo [proceso]

El primer commit de esta parte llevó `Claude-Cuenta:` pegado al último párrafo del cuerpo, y
`git log -1 --format='%(trailers:key=Claude-Cuenta,valueonly)'` devolvió VACÍO: git sólo toma como
trailers el último párrafo si es TODO trailers. Lo correcto: una línea en blanco antes del bloque, y
`Claude-Cuenta:` y `Co-Authored-By:` pegados entre sí. Se verifica con ese comando, no leyendo el mensaje
(se ve perfecto). Se corrigió con un `--amend` sobre el commit propio.

### Lo que quedó sin hacer (parte «datos»)

- **El ✦ / la tarjeta MAKO del Chatbot sigue con la lista plana**: `EditorMako` (app/automations/FlujoLienzo.tsx)
  le pasa `variables={DATOS_MAKO}` a `EditorMensajeGrupo`; con `datos={datosOfrecidos({ destino: 'equipo',
  conLead: true })}` recibe el árbol, DESPUÉS de que `textoDelAviso` (lib/api-mako/areas/chatbot.run.ts)
  resuelva el catálogo. Es de la parte «flujo».
- **Instagram y Messenger ofrecen sólo los cuatro datos** hasta que `enviarPasoSocial` (lib/nutricion.ts)
  reciba `datosParaElLead`; ahí `EditorMensajeSocial` pasa a `datosDelLead(true)`.
- **`VARIABLES_NEGOCIO` (vacía) no se pudo borrar**: la importa lib/mako-redacta.ts (`variablesParaPrompt`).
- **`app/agencia/EditorMensaje.tsx` se borró**: falta sacarlo del `vive` de configuraciones en
  app/admin/dev/areas.ts (tests/dev-areas en rojo hasta entonces).
- **Sin llamadores**: `PasoAudioControl` (app/automations/PasoAudioControl.tsx; lo leen tests/guion-audio y
  tests/whatsapp-sexta-tanda) y el botón suelto `SelectorDatos` (app/_components/SelectorDatos.tsx).
- **El selector de acento del onboarding del Video Generator** (`Select` de app/_ui) no tiene íconos: son
  regiones, y `Select` no pasa `icono`.
- **Nada se vio con clics**: el árbol en los tres editores, la tarjeta y el editor de MaKo en
  Notificaciones (el alto del panel con el editor de WhatsApp adentro), la grabación nueva del Video
  Generator y la tarea de audio del alumno.
## Sexta tanda, segunda pasada, parte «barrido» (09/10/2026): el tacho y los íconos en toda la app

General 9 (el tacho rojo «en TODOS lados»), 10 (íconos en todos los desplegables) y 11 (el buscador),
fuera de /chatbot. Las reglas que valen para código nuevo quedaron en AGENTS.md («Borrar es UN tacho…»).

### El tacho se cambia en el SET, no en cada pantalla: `Icon name="trash"` arrastra a las de otras partes [ui]

La salida obvia era reemplazar cada `<Icon name="trash">` por `IconoBorrar`, y no alcanzaba: lo piden
también `IconBtn name="trash"` (/integraciones), `BotonLote icono="trash"` (Ads Manager, con un test que
exige ese texto) y archivos de otras partes (el lienzo, el chatbot). Lo que cerró los diez de una vez
fue que la entrada `trash` de `app/_components/icons.tsx` sea `TRAZOS_BORRAR` y que `Icon` la pinte
roja ÉL (`const borrar = name === 'trash'`). Lo mismo con los nombres propios que ya tenían su lugar:
`IconoTacho` del Plan delega en `IconoBorrar`, y `basura` del editor rico pasó a `borrar`.

**La regla:** cuando un set tiene un NOMBRE que significa una acción, el dibujo y el color se arreglan
en el set; los call sites con nombre siguen andando. Lo que queda prohibido es el trazo propio.

**Vive en:** `app/_components/icons.tsx` · `app/plan/board/piezas.tsx` · `tests/borrar-tacho-casa.test.ts`

### La firma de un tacho a mano: la tapa ARRANCA la cadena y el subpath siguiente sube a la manija [tests]

Para el guard hacía falta reconocer un tacho dibujado a mano sin reconocer cualquier ícono. «Una raya
de 10 a 19 y una `V` a y=2..5 en la misma cadena» dio CUATRO falsos positivos (dos íconos de alinear del
editor rico, la `nota` del set, el reloj de arena del flujo y un rectángulo de ServicioVisual). La que
caza los seis que había y ninguno de esos: la cadena EMPIEZA con la tapa (`"M x y h1N`) y el subpath que
sigue arranca subiendo a la manija (`M x y V2..5`). El test lleva las dos listas adentro y se prueba a sí
mismo.

**Vive en:** `tests/borrar-tacho-casa.test.ts`

### Cuándo una ✕ es un tacho: si la cosa deja de EXISTIR [ui]

No se puede barrer por texto (las ✕ que cierran son la mayoría). El criterio, el de Google Forms: la ✕
que BORRA algo que deja de existir (un guion, un producto, una nota, una pregunta de un formulario, un
campo, un borrador del historial) pasa al tacho; la que QUITA de una selección o de un vínculo (un chip,
un público elegido, un archivo todavía no subido, «desasociar», una opción de una lista que se tipea, una
cuota) se queda. Y un renglón `sutil` del Dropdown («Quitar deadline») sigue siendo sólo texto: lo pidió
así («debe ser un texto»).

### Un `<select>` adentro de un menú propio NO se puede pasar al Dropdown sin romperlo [ui]

El pedido decía «pasalos al de la casa si se puede sin cambiar comportamiento», y en los menús «⋯» del
curso (`MenuCurso.tsx`, `EditorConocimientos.tsx`) no se puede: el menú del Dropdown vive en un PORTAL
sobre el `body`, y el menú del curso se cierra con cualquier `mousedown` fuera de SU nodo
(`MenuUgc`, `afuera` en `app/_cursos/CursoUgc.tsx`). Elegir una opción cerraría el menú de atrás antes
de que la opción llegue. Para pasarlos, el menú de atrás tiene que reconocer el portal como suyo.

### Pasar un `<select>` al Dropdown: elegir el MISMO valor ahora dispara `onChange` [ui]

El nativo no avisa si se elige lo que ya estaba; el Dropdown sí. En el Quarter del Plan eso habría escrito
un cambio que no fue (historial y deshacer de algo que no cambió): va `if (v !== actual)`.

### Una aserción que lee el renglón exacto se rompe con el ícono, y está bien [tests]

`>Eliminar módulo</button>` (tests/curso-menu-estructura) y `label: 'Campañas de Meta' }` (tests/
campana-producto) fallaron apenas el renglón llevó su ícono. Se admite el ícono sin exigirlo
(`(?:<svg…</svg>)?`) y la aserción sigue cazando lo que cazaba: 9/1 y 34/1 rompiendo lo de antes.

### Proceso: «PEGADO sin línea en blanco» es entre los dos trailers, no contra el cuerpo [proceso]

El primer commit de esta parte puso `Claude-Cuenta:` pegado a la última viñeta del cuerpo. Git sólo lee
como trailers el ÚLTIMO PÁRRAFO si es todo de trailers: `%(trailers:key=Claude-Cuenta)` devolvió VACÍO.
Va una línea en blanco antes del bloque, y los dos trailers juntos. Se verifica con
`git log -1 --format='%(trailers:key=Claude-Cuenta,valueonly)'`, no leyendo el mensaje.

### Lo que quedó sin hacer (parte «barrido»)

- **Los tachos de archivos de otras partes** (la lista vive en `PENDIENTES` del test, que falla cuando
  una se arregla para que se saque): el 🗑 del panel del lienzo (`app/_components/Lienzo.tsx:1355`), el
  tacho propio de `app/automations/IconosDisparador.tsx:101`, `IconTrash` del composer
  (`app/whatsapp/_shared/composer-icons.tsx:26`, usado en `VoiceRecorder.tsx:477/496/523`,
  `app/automations/EditorMensajeWhatsApp.tsx:677` y `EditorMensajeSocial.tsx:297`) y el de la barra de lote
  del CRM (`app/crm/AccionesLoteLeads.tsx:147`).
- **Desplegables de archivos de otras partes, sin íconos:** `app/_components/CamposAccion.tsx:85/105/108/
  122/137/158`, `app/_components/etiquetas-cliente.tsx:251`, `app/agencia/FlujoAviso.tsx:863`,
  `app/agencia/EditorMensaje.tsx:427`, `app/crm/AccionesLoteLeads.tsx:310/320/332`,
  `app/video-generator/OnboardingVideoGen.tsx:1097` y los de `app/automations/**`.
- **Selects nativos que se quedan:** los del menú del curso (`app/customer-success/curso/MenuCurso.tsx:
  327/352/368`, `app/conocimientos/EditorConocimientos.tsx:245`, ver arriba), el rol de
  `app/customer-success/FichaCliente.tsx:870` (tres opciones) y los de `app/api-mako/*` (copian GitHub
  tal cual, decisión de Martín).
- **Sin ícono a propósito, y lo puede querer distinto:** la barra del editor rico («Párrafo / Título /
  Subtítulo», `app/_ui/EditorRico.tsx:1214`: el botón es de ancho fijo y el ícono del elegido se dibuja
  adentro), los públicos de Meta (`app/ads-manager/NuevaCampanaModal.tsx:1244`: Facebook e Instagram
  piden su logo, que el set no tiene), los disparadores del email (`lib/email-marketing.ts:299`, una
  situación por renglón) y los roles.
- No se vio con clics: ni el tacho rojo en cada pantalla, ni los menús con su ícono, ni el buscador del
  Quarter.

## Sexta tanda, parte «renombre» (09/10/2026): la tab pasa a llamarse Automations

General 1, textual: «Cambia el nombre de la tab "Chatbot" por "Automations", el nombre en la sidebar, la
ruta, todo.» La carpeta pasó con `git mv` de `app/chatbot` a `app/automations`, la ruta es
`/automations` y `/chatbot` quedó como redirect (`app/chatbot/page.tsx`, lo único de esa carpeta).

### «/chatbot» en el repo son TRES cosas, y un reemplazo de texto rompe dos [renombre]

593 líneas en 169 archivos nombraban la carpeta o la ruta, y no todas significan lo mismo:

- **La carpeta** (`app/chatbot/` en imports, en los `readFileSync` de ~60 tests, en los «Vive en:»):
  se cambia entera. ⚠️ Pero `./chatbot/bitacora` en `app/admin/dev/registros.ts` es el REGISTRO del área
  (`app/admin/dev/chatbot/`), no la carpeta: un import relativo se cambia sólo si RESUELVE a `app/chatbot`.
- **La ruta de la pantalla** (`'/chatbot'`, `` `/chatbot?sec=` ``, `linkApp('/chatbot', ws)`): se cambia.
  ⚠️ Pero `'/chatbot/secuencias'` y las otras 27 de `lib/api-mako/rest.ts` son las rutas REST de
  `/api/v1` del ÁREA `chatbot` de la API de MaKo: renombrarlas cambia la API pública y su snapshot. El
  patrón que separa las dos: `/chatbot` que no siga con `/` más ruta.
- **El nombre de algo que no es la tab**: la división «Chatbot» de la lista (`ROTULO_CHATBOT`, decisión
  de Martín del mismo día), el interruptor «Chatbot: ON/OFF» de la tab WhatsApp, `chatbot` como concepto
  en la prosa. Se queda.

**Vive en:** `lib/ruta-automations.ts` · `app/chatbot/page.tsx` · `tests/ruta-automations.test.ts`

### Los alias viejos redirigían SIN la query, y el link de un aviso abría otra automatización [renombre]

`/setting`, `/chat-bot`, `/chat-agent` e `/instagram` hacían `redirect(await rutaConWs('/chatbot'))`
pelado: el `?ws=` sobrevivía (lo pega `rutaConWs` desde el header) y el resto no. Los avisos de WhatsApp
ya mandados llevan `/chatbot?sec=<id>` (el hand-off, `lib/chat-agent-handoff.ts`) y `?aviso=<id>` (el link
de Notificaciones), así que un redirect así abre la tab en la PRIMERA automatización, sin decir nada.
Ahora todos pasan por `destinoConQuery` (la query entera, valores repetidos incluidos) y van DIRECTO a
`/automations`; `/instagram` no traduce nada a propósito (su `?conectado=1` era de un OAuth muerto).

### La lista de alias no puede nombrar `/instagram`: la prohíbe otro guard [tests]

`tests/sin-instagram.test.ts` falla con la CADENA `'/instagram'` en cualquier archivo de `app/` y `lib/`.
Por eso `RUTAS_VIEJAS_AUTOMATIONS` tiene sólo `/chatbot`, `/chat-bot` y `/chat-agent` (las que el nav ya
marcaba), y `/setting` sigue con su título en `lib/titulo-tab.ts`. Una lista «completa» de alias habría
roto un guard ajeno por un string correcto.

### Cambiar `AREA_INFO` o una `descripcion` de la API regenera `docs/api-mako.md` [api-mako]

La tab y la ruta del área (`lib/api-mako/tipos.ts`) y cuatro descripciones que decían «/chatbot» salen en
la referencia generada: sin `node --import tsx scripts/generar-api-doc.mjs`, falla
`tests/api-mako-registro.test.ts` («la referencia generada está al día»). El snapshot de HTTP no cambia
(sólo lista ids). El `titulo` del área («Chatbot y secuencias») se quedó: es el nombre del permiso que
ven los tokens detallados.

### Lo que NO se renombró, a propósito: son CLAVES o historia [renombre]

- La key `setting` del nav (capas, roles por workspace, `onboarding.tab.setting`, la key del catálogo de
  onboarding y las de sus pasos) y el ícono `chatbot`. Cambiar una reabre el onboarding o apaga la tab.
- El área `chatbot` de la API de MaKo: ids de operaciones, permisos de los tokens, `/api/v1/chatbot/*`.
- `/api/chat-agent/*`, los nombres de tablas y settings, las features `chatbot-crear-ia` y
  `setting-guion-audio` del catálogo de modelos (cambió sólo su `label`).
- El registro de /admin/dev: slug `chatbot`, carpeta `app/admin/dev/chatbot` y su bitácora (cambió el
  título del área y el rótulo del sidebar de Dev). El proyecto «Agente: Chatbot» del plan
  (`lib/plan-proyectos-catalogo.ts`, `proyectos` del área, `loHabilita` del pricing): es una clave del tablero.
- Los archivos `lib/chatbot-*.ts`, `tests/chatbot-*.test.ts`, `docs/hallazgos-chatbot.md` y
  `docs/chatbot-*.md` (nombres de archivo, no de la pantalla), las props `puedeChatbot` /
  `mensajesEnChatbot` / `editarEnChatbot` y el atributo `data-editar-en-chatbot`.
- La historia: las bitácoras de /admin/dev, `_historial.generado.ts`, las migraciones, `docs/relevo*`,
  `docs/chats/`, `docs/superpowers/` y `docs/dev-areas.mjs` nombran la ruta como era.

### `git log` de un archivo movido empieza en el renombre [proceso]

`git log -- app/automations/FlujoLienzo.tsx` muestra un solo commit. La historia sale con
`git log --follow -- app/automations/FlujoLienzo.tsx`, de a un archivo. `scripts/gen-dev-historial.mjs`
no usa `--follow`; afecta poco porque toma los últimos 12 commits de todo el `vive[]` del área.

### Mover una ruta pide `npx next typegen`, y el build de un worktree de `.claude/` su propia raíz [proceso]

Después del `git mv` va `npx next typegen` antes del typecheck (AGENTS.md): sin eso `.next/types` no
conoce `app/automations/page.tsx`. Y el `npm run build` del worktree corrió con
`turbopack.root = resolve(__dirname, '..', '..', '..')` —el clon, que contiene al worktree y al
`node_modules` del junction—, no con el `'..'` que sirve para un worktree hermano del clon: verde, con
`/automations` y `/chatbot` las dos como rutas dinámicas. `next.config.ts` restaurado y su diff vacío.

### Revisión (10/10/2026): el renombre TOCÓ las líneas que perdían el `?ws=` y no las arregló [renombre]

Hallazgos 12 y 13. Al pasar `/chatbot` a `/automations` se reescribieron dos navegaciones que ya estaban
mal en main: el rebote de `/whatsapp?stab=plantillas` (WhatsAppApp, con el `useRouter` de
`next/navigation`) y los `<a href>` crudos del wizard compartido (OnboardingChatAgent, R099 en el `git mv`).
Las dos dejaban al super admin mirando SU cuenta. Un reemplazo de ruta es el momento barato de pasar la
línea por `app/_ui/Link`, y nadie lo miró porque el diff era de una palabra. **La regla:** al tocar una
línea que navega (aunque sea para cambiarle la ruta), se mira por cuál de las cinco formas sale.
`tests/pantalla-links-ws.test.ts` barre las pantallas de la parte «pantalla»; en `app/` quedan 40
`<a href="/…">` crudos en 25 archivos (medido el 10/10/2026: un `<a` cuyo `href` arranca en `/`), y
`app/video-generator/VideoGeneratorApp.tsx` sigue con el `useRouter` de Next.

**Vive en:** `app/whatsapp/WhatsAppApp.tsx` · `app/automations/OnboardingChatAgent.tsx` · `app/video-generator/OnboardingVideoGen.tsx` (`/extension/instalar`) · `tests/pantalla-links-ws.test.ts`

### Lo que quedó sin hacer (parte «renombre»)

- **Comentarios con «/chatbot» en archivos de la parte «plantillas»** (no se tocaron):
  `lib/avisos-catalogo.ts:752` y `:759`, `lib/flujo-aviso.ts:37`. Son prosa; el guard no los mira.
- **`app/admin/runway/datos.ts:280` y `:303`** dicen «/chatbot» en prosa (carpeta fuera de esta parte).
- **Datos en producción** (medido el 09/10/2026, sólo lectura): 4 tareas de `plan_tareas` citan
  `app/chatbot/<archivo>:<línea>` en su detalle (ChatAgentApp, GrabadorAudioPaso, OnboardingChatAgent ×2):
  el archivo está en `app/automations/`. No hay links a `/chatbot` guardados en `app_settings`.
- **No se vio con clics**: ni el redirect con un `?sec=` en el navegador, ni el título de la pestaña.
## Sexta tanda, parte «plantillas» (09/10/2026, noche): las plantillas que quedaron viejas

General 15, literal: «Hay plantillas que quedaron viejas con todos los cambios, incluso que no tienen
sentido porque quedaron con configuraciones viejas obsoletas... Cuando termines de implementar todo,
revisalas». Rama `wip-v6c-plantillas`. Lo guardado se mira con `scripts/plantillas-viejas.mts`
(simulacro por default); lo que lo mantiene al día, `tests/plantillas-viejas.test.ts`.

### «Las plantillas» son dos cosas, y en el código se llaman igual sólo una [plantillas]

En el código, una plantilla es un mensaje de MaKo en WhatsApp: el catálogo (`lib/avisos-catalogo.ts`),
el store por negocio (`mako.plantillas.store`, `lib/plantillas.ts`) y su ruta (`/api/perfil/plantillas`),
que la tab dibuja como la división «MaKo en WhatsApp». En boca de Martín es eso y además lo que la
plataforma trae hecho: «la plantilla por defecto» de la cobranza (04/10) y las automatizaciones que
siembra (las tres del onboarding y el esqueleto de la API). Se revisaron las dos, y las dos tenían lo
mismo: estaban escritas para un modelo que la tanda cambió y nada falla cuando eso pasa.

**Vive en:** `lib/avisos-catalogo.ts` · `lib/plantillas.ts` · `lib/setting-semillas.ts`

### Siete de los ocho mensajes que edita un cliente no mandaban lo que se editaba [plantillas]

**Síntoma:** el editor de MaKo en WhatsApp (el mismo del WhatsApp, MaKo en WhatsApp 2) dejaba escribir
el texto del reporte semanal, del recordatorio de reunión, de «Terminó la reunión», del mensaje
entrante y de la línea caída/volvió. Se publicaba, decía «Publicado ✓», y lo que llegaba no cambiaba.

**Causa:** cada emisor le pasa a `emitirDelCatalogo` un `texto` armado con lo que midió (o lo manda
`despacharReporte`), y entonces la plantilla no se lee. Sólo `cuota-vencida` usa la suya. Ya estaba
anotado como «cola» para el reporte («El texto de un REPORTE no llega al mail», /admin/dev/configuraciones)
y eran siete. En ws1 eso dejó un `texto` y un borrador de prueba («…$12.800 ZZZ QQQ») que no salen nunca.

⚠️ **El diagnóstico obvio —«hacerlos editables de verdad»— es el caro:** cada emisor arma su texto con
datos exactos (montos, links, la línea) y pasarlo por la plantilla es cambiar lo que le llega a cada
negocio. Lo que se hizo es lo seguro: el catálogo DECLARA `textoDelCodigo` y la ruta y el editor
preguntan lo mismo (`seEditaElTexto`). Lo decide Martín si alguno pasa a usar el texto del cliente.

⚠️ **Y `editable` eran dos preguntas en un booleano:** apagar el texto apagaba también el ＋ del
lienzo. El flujo de esos mensajes (su CRON por evento, sus pasos) sigue siendo del cliente:
`FlujoAviso` recibe `textoEditable` aparte. El guard cruza la marca contra los EMISORES en las dos
direcciones: un emisor que pase a mandar su texto obliga a poner la marca, y uno que pase a usar la
plantilla, a sacarla.

**Vive en:** `lib/avisos-catalogo.ts` (`textoDelCodigo`, `seEditaElTexto`) · `app/api/perfil/plantillas/route.ts` · `app/agencia/TemplateDetalleModal.tsx` · `app/agencia/FlujoAviso.tsx` (`textoEditable`)

### La plantilla de fábrica de la cobranza: dibujada rota, sin editor, y sus textos no salían [plantillas]

Tres capas, y ninguna daba error:

1. **Rota:** sus cuatro pasos —que el cron de cobranza corre con `correrFlujoDe`— llevaban «Este paso
   sólo corre cuando el mensaje lo dispara un evento», y una tarjeta con advertencia se pinta como rota.
   El grafo no sabía qué avisos corre el código: `correSuFlujo` en el catálogo, cruzado en el test contra
   el único llamador.
2. **Sin editor:** la espera, la condición y el mensaje al grupo caían al `return` del final de
   `EditorDelAviso`: una línea de texto, ni un campo ni «Quitar este paso». Un DELAY o un CONDITION
   agregados con el ＋ quedaban para siempre. Ahora tienen editor, con el mismo guardado diferido que la
   acción (`usePasoDiferido`: `panelPendiente`, desmonte, pestaña oculta).
3. **No salían:** la rama del mensaje al grupo (`lib/flujos.ts`) le pedía a la IA que reescribiera la
   plantilla PRINCIPAL (`generarMensajeAviso` lee `referenciaPlantilla(flujoId)`), no el paso. O sea que
   a las 48 h salía otra vez el mismo aviso, con `{{cuota_dias}}` crudo, en vez de «Sigue sin
   cobrarse…». Ahora sale el texto del paso con los datos por código y sin IA, como el mensaje de
   entrada. Medido: `flujo_corridas` vacía, no le cambió un mensaje a nadie.

Y los títulos de los pasos eran los de antes («Hace algo», «Espera», «Si pasa esto», «Te lo recuerda»):
son los de la casa (`TITULO`), y el mensaje al grupo es la tarjeta de MaKo con su texto.

**Vive en:** `lib/flujo-aviso.ts` (`corren`, `recorteDeTarjeta`) · `lib/flujos.ts` (rama `aviso_dueno`) · `app/agencia/FlujoAviso.tsx` (`EditorPasoEspera`, `EditorPasoCondicion`, `EditorPasoAlGrupo`)

### Las semillas escribían el modelo de antes, y el lienzo las abría «Sin publicar» [semillas]

`armarSecuenciasDeAudios` y `crearSecuenciaDesdeEtapa` escribían una LISTA (la espera en
`delay_horas`, la condición en `requiere`, el modo asistido, un «sigue con» que es un GO TO, y un
relleno que mandaba al «paso de redacción» de un wizard que no existe). Nacen por la MISMA conversión
que hace el lienzo al abrirlas (`abrirFlujo`) y con la limpieza que pone Publicar
(`estrategiaConLimpieza`): lo que nace es lo que se habría publicado, y el motor manda lo mismo.

⚠️ **La trampa de al lado:** sobre un flujo de tarjetas sin estrategia, re-grabar un audio sembraba la
estrategia de la LISTA (modo asistido, fallo por silencio), y el motor viejo volvía a hacer por su lado
lo que ya hacen las tarjetas. Una estrategia sembrada va con la forma de los pasos.

**Vive en:** `lib/setting-semillas.ts` (`planosDeAudios`, `comoNace`, `pasosDeEsqueleto`) · `lib/secuencias-audios.ts` · `lib/setting-secuencias.ts`

### Un evento sin emisor se ofrecía, y un mensaje propio con un evento no sale nunca [motor]

«Un lead escribe por WhatsApp» quedó sin emisor el 09/10 y seguía en el desplegable del CRON de los
mensajes: salió de `EVENTOS` y vive en `EVENTOS_SIN_EMISOR` para nombrar lo guardado. Y algo que no se
arregló: `dispararEvento` corre los PASOS del flujo de un aviso, nunca su mensaje. Un mensaje propio del
negocio (`custom`) con un evento —el ws13 tiene uno, apagado— no sale nunca, aunque el lienzo dibuje
CRON → MaKo en WhatsApp. Mandarlo también duplicaría los del catálogo que su código ya emite en ese
evento: lo decide Martín.

**Vive en:** `lib/flujos-tipos.ts` · `lib/flujos.ts` (`dispararEvento`)

### Medido en producción (09/10/2026, sólo lectura) [entorno]

- Store de mensajes en ws1 (6 entradas), ws3 (1), ws4 (2) y ws13 (5); el de la plataforma, vacío. Cero
  overrides de prompts (`mako.prompt-overrides` no existe): el prompt de Crear con IA es el del código.
- 69 automatizaciones, 10 no archivadas. #212 y #213 (ws1, en vivo): nada viejo, no se tocaron.
- Lo idéntico que el script escribiría: 4 flujos vacíos y un paso «⚡ Acción» de antes en ws1, 2 flujos
  vacíos en ws4. Lo que es de Martín: el texto «ZZZ» del reporte de ws1, el mensaje propio con evento de
  ws13, #221 (ws1: «Agendó pero no confirmó» al lado de la post-agenda nueva, o sea dos audios si se
  activa, y un GO TO), #210 (ws4, la post-agenda vieja del onboarding) y #224 (ws13, manual: no la
  arranca nada).

### Proceso [proceso]

- `tests/sin-chatwoot.test.ts` barre `scripts/` también: un script nuevo que nombre la integración
  borrada lo pone en rojo. Se escribe «la línea oficial».
- En un worktree aislado, un `node -e` con el programa en la línea lo puede rechazar el aislamiento del
  agente: las ediciones van por la herramienta de editar o por un archivo.

### Lo que quedó sin hacer (parte «plantillas»)

- **El DELAY de un mensaje de MaKo sigue siendo tarjeta** en su lienzo (DELAY 1 se hizo en el de las
  automatizaciones). `lib/flujo-aviso.ts` (`grafoDeAviso` → `AristaFlujo.esperas`) · `app/agencia/FlujoAviso.tsx`
- **El CRON de un mensaje sigue con «Por tiempo / Por una acción»** (CRON 2 era del de las
  automatizaciones). `app/_components/EditorCron.tsx` (`SelectorDisparo`)
- **Los textos que arma el código dicen «secuencia» y «Si responde»**: «Secuencia: X» y «súmalo como
  caso en «Si responde»» (`lib/chat-agent-handoff.ts`), «respondió a la secuencia de mensajes»
  (`lib/nutricion.ts`, rama protegida), «la secuencia está pausada» (`lib/setter-conversacion.ts`).
- **La API dice que re-armar las del onboarding «pierde sus cambios de texto y variantes»**: desde el
  08/10 una de tarjetas sólo cambia el audio. `lib/api-mako/areas/chatbot.run.ts` (`armar_secuencias_de_audios`)
- **El onboarding de la tab arrastra los pasos de la línea oficial** (y «la sub-tab Plantillas»), que el
  catálogo ya no tiene: código muerto. `app/chatbot/OnboardingChatAgent.tsx`
- **En /mensajes (agencia) se siguen editando los textos que arma el código**: lo decide Martín.
- **`usePasoDiferido` y `EditorPasoAccion` repiten el mismo guardado diferido**: pasar la acción al hook.
  `app/agencia/FlujoAviso.tsx`
- **Correr `scripts/plantillas-viejas.mts --aplicar`**: lo decide Martín (escribe sólo lo idéntico).
- **Verlo con clics**: el lienzo de la cobranza con sus editores, un mensaje que arma el código
  (sin editor y con ＋), y las semillas abriendo sin «Sin publicar».

## Sexta tanda, parte «horario» (10/10/2026): el horario de envío ahí mismo en Automations

Pedido literal: «El horario de oficina si se configura en la tab de configuraciones, pero haz que se
pueda configurar allí mismo, sin redirigir.» Rama `wip-v6e-horario`. Un botón con el reloj en el renglón
de «Chatbot» de la lista abre el MISMO `HorarioEnvioPanel` en un panel anclado, con las mismas acciones;
Configuraciones › Horario se queda. Lo fija `tests/automations-horario.test.ts` (10 roturas, las 10 en rojo,
y 18 más de la revisión en `wip-v6f-horario`, las 18 en rojo).

### Lo que usa una acción de Configuraciones no se importa en la lista: entra como nodo [horario]

**Síntoma (medido antes de escribir):** `import('./app/configuraciones/HorarioEnvioPanel.tsx')` bajo
`node --import tsx` tira «This module cannot be imported from a Client Component module»: `horario-actions.ts`
arrastra `server-only` (lib/tab-access, lib/settings). Cinco tests dibujan `SimuladorWhatsApp` con
`renderToStaticMarkup`, así que importado ahí caían los cinco AL IMPORTAR, no en una aserción.
**La regla:** lo que llame a una server action entra a la lista como NODO desde la tab (`horario`, como el
`pie`), y lo monta ChatAgentApp, que ningún test importa en runtime. Lo que se puede dibujar (el botón, la
cuenta de dónde cae el panel) va en un archivo sin las acciones (`HorarioBoton.tsx`), que sí se prueba.

**Vive en:** `app/automations/HorarioLista.tsx` · `app/automations/HorarioBoton.tsx` · `app/automations/SimuladorWhatsApp.tsx` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Un popover con un `Dropdown` de la casa adentro: el clic y el Escape del desplegable caen «afuera» [horario]

**Leído en el código, no visto con clics:** el menú del `Dropdown` va por portal al `body`, AFUERA del
panel, así que un «clic afuera» que mira `panel.contains(target)` cerraría el panel al elegir una hora. Y
los dos Escape viven en `document` y en captura, que corren en orden de REGISTRO: el del panel (al abrir)
corre antes que el del desplegable (al desplegar), y con `stopImmediatePropagation` el desplegable no se
entera. **La regla:** con un `[aria-expanded="true"]` adentro del panel, el panel no contesta ni el clic
ni el Escape (`hayMenuAbiertoEn`). Y `capa.visible` de `useCapaModal` es false en el PRIMER render (la
capa se registra en un efecto): un `display` atado a eso deja el panel en `display:none` justo cuando se
lo mide y se le da el foco.

**Vive en:** `app/automations/HorarioBoton.tsx` · `app/components/Dropdown.tsx` · `app/_components/pila-modales.ts` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Revisión: el panel anclado tiraba lo no guardado, y el borde en línea anulaba el hover [horario]

La revisión adversarial (sólo lectura) dejó dos reglas. Se arreglaron en la rama `wip-v6f-horario`.

- **Un panel anclado con «Guardar» que se cierra con un clic afuera pierde lo no guardado.** El editor se
  desmonta al cerrar, así que cambiar «De 9» a «De 8» y tocar el lienzo lo tiraba sin avisar. En
  Configuraciones eso sólo pasa al salir de la pantalla; acá alcanzaba un clic suelto. Arreglo: el panel
  avisa `onSucio` (con un efecto ANTES del return temprano) y `onGuardado`. Con cambios sin guardar no
  cierran ni el clic afuera, ni el Escape, ni el scroll (`retener`). ⚠️ **El Escape retenido se FRENA
  igual** (`stopImmediatePropagation`): un `return` antes del freno le pasa la tecla a la capa de abajo, y
  entonces se cierra lo de atrás con el panel abierto. El botón del reloj cierra siempre: es la salida
  explícita para descartar.
- **Un `border` en el `style` en línea anula el `:hover` de la clase.** El fondo ya estaba en la clase por
  esa razón, y el borde no: no cambiaba al pasar el cursor ni con el panel abierto, y su transición no
  corría nunca. El test dibuja el botón y falla si el `style` pone una propiedad que el hover cambia, o su
  atajo (`border` pisa `border-color`).
- ⚠️ **Y retener el panel DEJANDO PASAR el clic no protegía nada** (segunda revisión, al integrar). El clic
  seguía su camino: «＋ Nueva» del cartel vacío creaba la primera automatización, el cartel se desmontaba
  y con él el panel y lo editado. Con cambios sin guardar se frenan el `pointerdown` y el `click` que lo
  sigue, y el panel se sacude como seña (sin movimiento si la persona lo pidió). La pregunta antes de
  retener algo: **¿el clic que dejo pasar puede desmontar al dueño de lo que retengo?**
- ⚠️ **`stopImmediatePropagation` corta a los listeners que se registraron DESPUÉS**, y ésos son justo los
  de lo que la persona abrió con el panel ya abierto (un «⋯», un renombre): con el panel sucio, el Escape
  quedaba muerto en toda la pantalla. El retenido frena sólo la tecla que nace en el panel, en su botón o
  sin foco. Las dos cosas las fija `tests/automations-horario.test.ts` (roturas C1-C8).

**Vive en:** `app/configuraciones/HorarioEnvioPanel.tsx` · `app/automations/HorarioLista.tsx` · `app/automations/HorarioBoton.tsx` · `tests/automations-horario.test.ts` · desde la décima tanda (11/10/2026) los dos de Horario se borraron: los reemplaza `app/automations/ConfiguracionesBoton.tsx` (`tests/automations-configuraciones.test.ts`)

### Lo que quedó sin hacer (parte «horario»)

- **Verlo con clics**: no se levantó la app (bootear local escribe en prod). Falta ver en un navegador la
  retención con cambios sin guardar, el cierre por scroll, el borde en el hover y el panel colgando del
  botón en el cartel vacío.
- **Una decisión por defecto, avisada a Martín:** con cambios sin guardar el panel no se cierra solo, y el
  clic afuera no muestra ninguna señal (lo de atrás contesta igual). Si prefiere que cierre igual, la otra
  salida es dejar el editor montado y escondido después de la primera apertura.
- En el cartel vacío, «＋ Nueva» con el panel abierto y sucio crea la primera automatización y el cartel se
  desmonta con el panel: lo no guardado se pierde ahí.

## La galería de plantillas (10/10/2026, parte «galeria»): arrancar de una automatización hecha

Martín, al preguntarle si quería las automatizaciones de los clientes como galería o copiadas: «Si,
hagamos la galería de las más comunes...», y después «no estan todas las plantillas de Mauricio».
Rama `wip-v7-galeria`. El catálogo es `lib/plantillas-automatizaciones.ts` (siete plantillas, una por
cada automatización de Mauricio y la de no-show de ws13, generalizadas); lo fija
`tests/plantillas-automatizaciones.test.ts` (27 roturas, las 27 en rojo).

### Una automatización colgada de una ETAPA no hereda «la reunión ya pasó» del motor [plantillas, motor]

**Síntoma (leído en el código, antes de que pase):** las post-agenda de origen (#212, #213, #221)
dicen «¿me confirmas que nos vemos en la reunión?» a las 25 h. Bien colgadas de un evento; colgadas
de la etapa «Agendado», ese mensaje le llega a quien agendó para dentro de 20 h con la reunión ya
pasada, y al prender la automatización el CRON inscribe a TODOS los que están en la etapa, también al
que la tuvo hace un mes.

**Causa:** la guarda del motor que cierra sin mandar («la reunión ya pasó») decide por el
`trigger_tipo` —`preparaUnaReunion`, la familia `agendado_*`, los eventos que la tercera tanda sacó del
CRON— y una etapa es `etapa_actual`. Una espera `antes_reunion` sí se cuida sola (sin reunión por
delante, el motor corta con `sin_reunion`); una espera por tiempo, no.

**La regla:** en un flujo que arranca por una etapa, cada mensaje que habla de la reunión va detrás de
una condición «Próxima reunión en ≤ 720 h» DESPUÉS de cada espera por tiempo (no sólo al entrar). Lo
fija `miraLaReunion` en el test. ⚠️ Vale igual para Crear con IA, que hoy no lo sabe.

**Vive en:** `lib/plantillas-automatizaciones.ts` (`REUNION_POR_DELANTE`) · `lib/nutricion-familias.ts` (`preparaUnaReunion`)

### «Agendó» es «tiene una reunión cargada», pasada o futura: en un flujo de no-show no sirve [motor, datos]

`agendoLead` (lib/nutricion-grafo-motor.ts) mira las cuatro fechas de junta, sin preguntar si pasaron.
Para quien faltó a una reunión es siempre verdadero: la reunión a la que faltó cuenta. Medido en
producción (sólo lectura): **#224 de ws13** («No asistió: reagendar», pausada) espera 2 días y su
primera rama es «Agendó → termina», así que a quien faltó a una reunión cargada en su ficha no le
saldría nunca el email de los 2 días. La plantilla usa «Próxima reunión en ≤ 720 h». #224 no se tocó:
lo decide Martín.

### Medido en producción (10/10/2026, sólo lectura) [entorno]

Las diez vivas: #198 todavía tiene dos «Ir a» a la #212 (los pasa `scripts/quitar-ir-a.mts`, en
simulacro); #221 tiene uno de tarjeta a tarjeta y pone la etiqueta 1 del ws1; #226 cuelga de las
nueve etapas de entrega del producto 1 y pone la etiqueta 2. Todo lo de los clientes es suyo: los
audios, el link del video de confirmación (`confirmar.lovable.app`) y la agenda de Cal.com de ws13.

### Proceso: el Chromium de Playwright no arranca acá; el Chrome del sistema sí [proceso]

`spawn UNKNOWN` al lanzar `ms-playwright/chromium-*/chrome.exe`, también sin sandbox y con
`spawnSync(… ['--version'])` pelado: no es Playwright. Con `executablePath` al Chrome del sistema,
headless y `--mute-audio`, el banco de esbuild (ver «un componente del lienzo se verifica sin `next
dev`») abre por `file://` y se recorre con clics. La galería se vio así: los dos pasos, el desplegable
con productos, «Elegir después», «Volver», Escape y un teléfono de 390 px sin desborde.

### Lo que quedó sin hacer (parte «galeria»)

- **El enchufe**: «＋ Nueva» abre la galería. Vive en `app/automations/SimuladorWhatsApp.tsx` y
  `app/automations/ChatAgentApp.tsx`, que eran de otra corrida: el cambio exacto, en el informe de la
  parte (bloqueantes). Hasta entonces la galería tiene cero call sites.
- **«En blanco» y «Con MaKo» hacen hoy lo mismo**: la vacía de «＋ Nueva» abre siempre con la caja
  de Crear con IA. Para que se distingan, «En blanco» sin la caja (o «Con MaKo» con el foco en ella)
  es un cambio de `app/automations/SecuenciaPerfil.tsx`. Lo decide Martín.
- **Crear desde una plantilla no está en el registro de la API** (tampoco «Duplicar» ni «＋ Nueva»):
  existe para la pantalla y no para MaKo por WhatsApp. `lib/api-mako/areas/chatbot.def.ts`
- **Crear con IA no pone la guarda de la reunión** en un flujo colgado de una etapa. `lib/flujo-ia.ts`
- **Verlo con clics en la app real**: crear una de cada en el ws3 y abrirla en el lienzo.

## Restos de versiones anteriores, grupo recordatorio (10/10/2026)

Martín, con la captura del recordatorio en producción: «siguen habiendo cosas de versiones anteriores que
estan mal..». Rama `wip-v7-recordatorio`. Lo fijan `tests/recordatorio-lienzo.test.ts` y
`tests/recordatorio-lead.test.ts` (las roturas, en sus cabeceras).

### Un lienzo que arma sus nodos a mano no hereda los arreglos del lienzo [recordatorio]

**Síntoma:** después de la sexta tanda el recordatorio seguía con las esperas como tarjetas DELAY, el CRON
sin su cajita ni su «Entonces» y las tarjetas creciendo con el texto. **Causa:** `grafoRecordatorio` ponía
sus nodos con un `poner({ … })` propio, así que cada cambio de `grafoDeSecuencia` (la pastilla en la
flecha, `altoCron`, `salidaAlPie`, el alto fijo) le pasaba de largo. **La regla:** lo que se dibuja «como
una automatización más» se arma como PASOS del modelo (lib/flujo-grafo.ts) y pasa por `grafoDeSecuencia`;
lo propio se aplica ENCIMA de su salida. Lo que mejore el constructor le llega solo.

**Vive en:** `lib/recordatorio-grafo.ts` · `app/automations/RecordatorioFlujo.tsx`

### El hueco entre columnas no mide la pastilla del DELAY [lienzo]

**Estimado con los estilos, no visto en un navegador:** `grafoDeSecuencia` separa las columnas 92 px
(`GAP_COLUMNA`) y el lienzo dibuja la pastilla con `nowrap` y sin ancho: «1 h antes de la reunión» mide
~180 px y queda encima de las dos tarjetas y del círculo de la salida. `anchoPildoraFlecha` topea en 150,
así que la estimación también se queda corta. Pasa con toda espera `antes_reunion` colapsada en la flecha
de una automatización (las de antes). En el recordatorio se resolvió con la pastilla corta («24 h antes») y
cada flecha ensanchada (`AIRE_PILDORA`); en el constructor, no.

**Vive en:** `lib/flujo-conversacion.ts` (`GAP_COLUMNA`) · `lib/lienzo-grafo.ts` (`anchoPildoraFlecha`)

### El ✦ de MaKo no se puede prender sobre un emisor con variables propias [whatsapp]

`MakoRedacta` arma el prompt y el filtro (`sinVariablesAjenas`, lib/mako-redacta.ts) con las variables del
MOTOR. Sobre el recordatorio escribiría `{{empresa}}` —que `problemaDelTexto` rechaza al publicar— o la hora
escrita a mano, y nunca `{{cuando}}`, `{{hora}}`, `{{faltan}}` ni `{{link}}`. **La regla:** un ✦ que escribe
para un emisor propio recibe SU lista de variables, y la usan el prompt y el filtro. Hasta entonces el
recordatorio va con `conMako={false}`.

**Vive en:** `lib/mako-redacta.ts` · `app/api/chat-agent/redactar/route.ts` · `app/automations/MakoRedacta.tsx`

### Lo que quedó sin hacer (grupo recordatorio)

- **Los botones de deshacer y rehacer**: `BotonPila` es privada (y está dos veces: SecuenciaPerfil.tsx y
  FlujoAviso.tsx). El atajo ya anda. `app/automations/RecordatorioFlujo.tsx` (`herramientas`)
- **Mover las tarjetas y «Acomodar»**: `usePosicionesLienzo` guarda sólo en `nutricion_secuencias`.
  `app/automations/usePosicionesLienzo.ts`
- **«▶ Probar»**: el panel prueba una automatización con las variables del motor; el recordatorio tendría
  que resolver con `textoDelToque`. `app/automations/PanelProbar.tsx` · `app/automations/SimuladorWhatsApp.tsx`
- **El borrador en el server**: lo no publicado ya pregunta antes de perderse, pero no se guarda.
- **El texto repetido del editor de un solo texto** (la burbuja y la barra con lo mismo): es del editor.
  `app/automations/EditorMensajeWhatsApp.tsx`
- **`EMOJI_RECORDATORIO` vive en dos lugares** (el título y la fila): un test los ata hasta que la lista lo
  importe. `app/automations/SimuladorWhatsApp.tsx`
- **`lib/recordatorio-grafo.ts` falta en el `vive[]` del área chatbot.** `app/admin/dev/areas.ts`
- **Verlo con clics.**

## Restos de versiones anteriores, grupo avisos (10/10/2026): el lienzo de un mensaje de MaKo

Pedido literal: «Pero no estan todas las plantillas de Mauricio y siguen habiendo cosas de versiones
anteriores que estan mal..». Rama `wip-v7-avisos`. El lienzo de un mensaje de MaKo (`FlujoAviso`) pasó a
las piezas de una automatización: el DELAY sobre la flecha, la tarjeta CRON con sus cajitas, el círculo
«Entonces», la CONDITION con sus dos filas, el tacho del panel, el menú de la casa. Lo fijan
`tests/flujo-aviso.test.ts` y `tests/barrido-sexta-datos.test.ts` (24 roturas, las 24 en rojo).

### La flecha del «Si no» pasaba POR DETRÁS de la tarjeta del «sí» [avisos]

**Síntoma (visto en un navegador, con los tests en verde):** con las ramas como filas de la CONDITION, la
flecha del «Si no» sale horizontal de la fila de abajo, y la tarjeta del «sí» estaba en la misma fila: la
flecha la cruzaba por detrás y se leía como que entraba ahí. **El diagnóstico obvio era el equivocado:**
bajar la tarjeta del salto no cambia nada, porque lo que estorba es la de al lado. **La regla:** la tarjeta
del «sí» de una CONDITION con salto SUBE una fila (`sube`), y la fila del tronco (`fila`) baja lo que suba
la más alta, para que nada quede arriba del borde del dibujo. Por eso el modelo de los pasos se calcula
ANTES que el tronco.

**Vive en:** `lib/flujo-aviso.ts` (`grafoDeAviso`)

### Un mensaje de MaKo es una LISTA: el ＋ en paralelo sólo prende un canal [avisos]

El lienzo de una automatización ofrece flechas sueltas, en paralelo y arrastrables porque su motor es un
grafo; el de los avisos (`decidir`, `lib/flujo-pasos.ts`) recorre una lista: +1, o +2 si la condición no
se cumple. Copiar esos gestos dibujaría caminos que el motor no corre. Lo único que sale «a la vez» en un
mensaje es el otro canal: con un canal apagado, el círculo de la cabeza ofrece su ＋ aunque ya siga en
algo, y ese ＋ ofrece sólo el canal (el Lienzo le pasa el puerto `par`). Sin eso, con pasos puestos no
quedaba en el lienzo cómo prender el mail, porque el ＋ del costado se fue. Y con WhatsApp prendido la
tarjeta del mail no tiene círculo: un «después» del mail no existe.

Y la espera dice lo que el motor ESPERA: el editor de antes dejaba poner 8760 horas y `sanearHoras` corta
en 720 (`DELAY_MAX_HORAS`). Una espera vieja de un año se dibuja «30 días», y así se guarda al tocarla.

**Vive en:** `lib/flujo-aviso.ts` (`salidaDe`, `canalPorPrender`, `segundosDeEspera`) · `app/agencia/FlujoAviso.tsx` (`opcionesEn`, `EditorPasoEspera`)

### Lo que quedó sin hacer (grupo avisos)

- **Verlo con clics en la app real.** Se vio en un arnés (esbuild + `fetch` simulado, Chrome sin ventana):
  las pastillas, el CRON, los círculos, el menú, el click derecho y el tacho. La app no se levantó.
- **`muelles` no tiene call site:** FlujoAviso la recibe y la cadena `SimuladorWhatsApp` →
  `MensajeMakoLienzo` → `TemplateDetalleModal` no la pasa, así que el panel abre con el tamaño de siempre.
- **El ✦ del mensaje es `RedactaAviso`, no `MakoRedacta`:** el del composer escribe con la voz del lead
  para una automatización, y un aviso va al grupo del dueño. Se reusa el día que acepte un `pedir` propio
  (`app/automations/EditorMensajeWhatsApp.tsx`).
- **Piezas privadas:** `VistaEmail` y `EditorEspera` (`app/automations/FlujoLienzo.tsx`) y
  `ElegirClase`/`Volver` (`app/automations/EditorDisparadores.tsx`) no se exportan.
- **`CRON_DEFAULT` sigue en `app/_components/EditorCron.tsx`** porque lo importa `EditorDisparadores`; su
  lugar es `lib/cron-aviso.ts`.

## Restos de versiones anteriores, grupo «lista» (10/10/2026)

Martín abrió /automations en su ws9: «Pero no están todas las plantillas de Mauricio y siguen habiendo
cosas de versiones anteriores que están mal». Rama `wip-v7-lista`. Salió el pie «N etapas sin secuencia ·
Armar una» (y su `huecos` y el pedido de «Armar una»), las filas marcan lo sin publicar, la tab dice
«automatizaciones», el editor de UN mensaje dejó de dibujar el texto dos veces, y «Probar», los avisos que
arma el código y el wizard del onboarding (sin la línea oficial ni «aprobar») hablan como la tab.

### «MaKo en WhatsApp» no tiene identidad de tarjeta: lo que se guarda POR TARJETA se comparte [whatsapp]

`EditorMensajeGrupo` monta el editor de WhatsApp con un paso fijo (`id: 'mako-grupo'`, orden 1), así que
`claveDeTarjeta` da LA MISMA clave para todas las tarjetas MAKO de un lienzo y para todos los mensajes de
Notificaciones. Mientras la barra de un mensaje era el mensaje (`modo="editar"`) no importaba; al pasarla a
borrador (la misma interfaz que el de varias partes), el mapa del módulo `borradores` llevaba lo tipeado en
un aviso a la barra del siguiente, y su ➤ lo mandaba ahí. **La regla:** antes de guardar algo por tarjeta
en un mapa del módulo, mirá si TODOS los que montan el editor le dan una identidad; el de un mensaje no
recuerda la barra (`recordarBarra`), y cada montaje es de un mensaje porque los tres que lo montan le ponen
`key`. ⚠️ El panel de MaKo (`usePanelMako`) y el guion (`guionesDeMaKo`) usan la misma clave: hoy no muerde
porque «MaKo en WhatsApp» va sin ✦; el día que lo lleve, `EditorMensajeGrupo` necesita una `clave` propia.

**Vive en:** `app/automations/EditorMensajeWhatsApp.tsx` (`claveDeTarjeta`, `recordarBarra`, `EditorMensajeGrupo`)

### «No están todas las plantillas de Mauricio»: lo medido, para preguntarlo bien [plantillas]

Leído en producción (sólo lectura, 10/10/2026): el ws9 (la plataforma) no tiene ninguna automatización viva
(11 archivadas) ni store de mensajes; el ws1 (Mauricio) tiene vivas #198, #212 y #213, pausadas #220, #221 y
#226, y un store de 6 entradas: `ad-fatiga` (flujo), `reporte-semanal` (flujo y borrador),
`meta-cuenta-frenada` (flujo), `plan-proyecto-vence` (borrador), `lead-formulario-meta` (apagado) y
`lead-no-confirmo` (flujo). Cuatro de esas seis no están en `AVISOS_DEL_CLIENTE`, así que la lista de
/automations no las muestra en NINGÚN negocio: «MaKo en WhatsApp» lee `/api/perfil/plantillas` (vista
cliente, 7 mensajes) y el catálogo de la agencia (65) vive sólo en /mensajes. Las tres lecturas posibles, para
preguntarle a Martín con opciones (no se tocó nada):
1. el catálogo de la AGENCIA en la lista del ws9 (la pregunta abierta del relevo: «¿/mensajes también se muda?»):
   pide el endpoint de admin en `MensajeMakoLienzo` y en `ChatAgentApp.cargarAvisos`;
2. los flujos que armó en el store del ws1 cuando la base de la herencia era el ws1 (157a302a la pasó a la
   plataforma): pasarlos al ws9 es escribir en la base;
3. las automatizaciones de Mauricio (las de `docs/relevo/chatbot-secuencias.json`) como plantillas para
   «＋ Nueva»: hoy no hay un catálogo de plantillas de automatización.

**Vive en:** `lib/plantillas.ts` (`listarPlantillas`) · `lib/avisos-catalogo.ts` (`AVISOS_DEL_CLIENTE`) · `app/automations/ChatAgentApp.tsx` (`cargarAvisos`)

### Lo que quedó sin hacer (grupo «lista»)

- **El panel grande, el `insetDer` y lo no publicado para el recordatorio y los mensajes de MaKo**: la lista
  ya tiene `muelles` y `setSinPublicar`; faltan las props del otro lado (`RecordatorioFlujo`,
  `MensajeMakoLienzo` → `TemplateDetalleModal` → `FlujoAviso`). La marca de «sin publicar» de un mensaje de
  MaKo sale de lo GUARDADO: aparece al volver a leer la lista (publicar, prender, recargar). En vivo hace
  falta que `TemplateDetalleModal` avise (`onSinPublicar`, o `onCambio` después de guardar el borrador).
- **`/api/chat-agent/onboarding/resumen` quedó sin llamadores** (lo llamaba el paso «aprobar»). Es un GET
  que ARMA automatizaciones: borrarlo es retirar una ruta (`npx next typegen` en el clon).
- **El ✦ en la tarjeta MAKO**: el redactor (`/api/chat-agent/redactar`) escribe para el LEAD; para el
  equipo hace falta otro contexto y la `clave` de arriba.
- **Verlo con clics**: nada de esto se vio en un navegador.

## Séptima tanda (10/10/2026): la condición «suelta», las de Mauricio y Código Inmobiliario, y lo viejo del ws9

Pedidos literales en la bitácora (hitos del 10 oct 10:21-11:25). Lo que se aprendió, no lo que se hizo:

- **La «condición suelta» de la 198 no estaba suelta: el DIBUJO mentía.** Es la CONDITION que escucha la
  respuesta (nodo 'respuesta'), que en el motor cuelga del CRON y por eso `validarGrafo` la deja pasar. La
  segunda pasada de la sexta tanda le sacó la flecha al sacar la fila «Si responde» del CRON, y se veía igual
  que una tarjeta suelta. ⚠️ **El diagnóstico obvio —«Publicar y Probar no frenan las sueltas»— era el
  equivocado** para esa tarjeta: las 8 automatizaciones vivas de ws1 y ws13 pasaban `validarGrafo` sin una
  suelta real. La regla: lo que el motor cuelga de algo se DIBUJA colgado de eso, con una flecha que no es del
  dato (`sinMas`: sin ＋ en el medio, sin papelera, y «Desconectar» no la cuenta). Y una fila única no se llama
  «Si no» (sin un «Sí» arriba se lee a medio armar): `rotuloSiNoDeRespuesta`, que leen la tarjeta, su editor y
  «Probar».
- **Pero «me deja probarlo» era cierto por otra puerta.** El botón «▶ Probar» frenaba; con el panel ABIERTO,
  ↻, «Cambió · ↻», «Probar en WhatsApp» y un número nuevo rearrancaban sobre lo que se edita sin mirar nada, y
  «Probar en WhatsApp» MANDABA. El freno va en cada puerta que arranca, no en el botón que abre: el lienzo le
  pasa al panel el mismo `frenoDelFlujo` que Publicar (`EdicionLocal.freno`).
- **Un script que cambia `pasos` deja el borrador huérfano en silencio.** El borrador guarda `base` = la firma
  de lo publicado (`firmaPublicado`); con otra firma, `borradorVigente` ya no lo abre. Al arreglar datos se
  rearma o se borra en el mismo cambio. Y para comparar un borrador con lo publicado se ignora `orden`: el
  lienzo lo renumera al abrir (el de la 198 sólo difería en eso y en una errata).
- **La 221 era la post-agenda VIEJA** (`agendado_sin_confirmar`), que no está en `FAMILIA_POST_AGENDA`: prendida
  junto a la 212 y la 213, el lead recibía el audio dos veces y Activar no lo frenaba. Se archivó; el agujero del
  código sigue (ver abajo).
- **La pastilla del DELAY pisaba las tarjetas en CUALQUIER automatización**: el árbol separaba las columnas 92 px
  y «1 h antes de la reunión» mide 150. El recordatorio lo había arreglado sólo para él. La columna se corre lo
  que pide su flecha (`huecoHacia`). ⚠️ Un test que medía sólo el eje X dio un falso rojo con dos esperas
  seguidas: van a distinta altura sobre la curva, así que se comparan rectángulos.
- **Un test que fija un camino que nunca corre.** `tests/flujo-aviso.test.ts` fijaba `editorDeTarjeta(muelles, …)`
  en FlujoAviso, pero `muelles` no llegaba desde la lista: el panel de MaKo en WhatsApp estaba siempre en 460 px.
  Se enchufó de punta a punta (SimuladorWhatsApp → MensajeMakoLienzo → TemplateDetalleModal → FlujoAviso) y el
  guard mira la cadena entera.
- **Dos botones con el mismo resultado se leen como que uno está roto.** La galería traía «En blanco» y «Con
  MaKo», y una vacía abre siempre con la caja de Crear con IA: queda una tarjeta.
- **Un reporte sale por las preferencias, no por su plantilla.** El lienzo del reporte semanal dibujaba WhatsApp (el
  default de la plantilla) y no Email, que es por donde sale: `canalesDeMensaje`, la misma de la bandeja.
- **El guard de nombres reales existía y no tenía los nombres.** «Terminó la R1 con Sergio Esquer» (un cliente
  de Mauricio) pasaba el test de los ejemplos del catálogo porque la lista `REALES` no lo nombraba. La lista caza
  los conocidos; cada nombre real que aparezca se suma ahí.
- **El aviso de 30 minutos al dueño miraba sólo la hora**: una cancelación de Calendly borra la fecha y deja la
  hora (0 de 130 filas hoy). `reunionParaElDueno` (pura, con test) pasa por `juntasDe` + `fechaCoincide`.

### Lo que quedó sin hacer, con su archivo

- **`agendado_sin_confirmar` fuera de la regla del doble envío** (`lib/nutricion-familias.ts`, `FAMILIA_POST_AGENDA`):
  una automatización nueva con ese CRON, prendida junto a 212/213, repite el audio. Activar no lo frena.
- **Activar no mira si la línea está conectada** (`mako_ws13` desconectada y sin número): se prende y no sale nada.
- **Una espera «N antes de la reunión» que ya pasó sale enseguida** (el «mañana» de la 223, a quien reserva con
  menos de 24 h). Se arregló el texto; el motor sigue de largo (`lib/nutricion.ts`).
- **La 224: «Agendó» cuenta la reunión a la que faltó**, así que el email de reagendar no le sale a nadie. La
  plantilla de la galería lo resuelve con «Próxima reunión en ≤ 720 h»; la 224 la decide Martín.
- **El recordatorio sin ✦, sin mover tarjetas, sin «Acomodar» y sin «Probar»** (`app/automations/RecordatorioFlujo.tsx`;
  los cambios exactos en la sección del grupo recordatorio). Si el recordatorio se muda al motor, vienen solos.
- **Copias en FlujoAviso**: `VistaEmailAviso`, `BotonMakoAviso`, `BotonVolver` y `RedactaAviso` (originales:
  `VistaEmail` y `EditorEspera` de FlujoLienzo, `BotonMakoWhatsApp`, `Volver` de EditorDisparadores, `MakoRedacta`
  con una prop `pedir`). `BotonPila` ya es uno (`app/automations/BotonPila.tsx`, con guard).
- **«Probar» en MaKo en WhatsApp**: la vista del chat sigue en Notificaciones (`MensajeMakoLienzo` no pasa `onVerChat`).
- **El aviso de 30 min al dueño sólo corre con Calendly** (`app/api/cron/reunion-recordatorio/route.ts`,
  `correrPorWorkspace('calendly', …)`): ws13 (Cal.com) no lo recibe. Extenderlo es mandar avisos nuevos a clientes.
- **`/api/chat-agent/onboarding/resumen` sin llamadores**; retirarla pide `npx next typegen` en el clon.
- **El reporte semanal no sale por WhatsApp** desde que se borró Chatwoot (`despacharReporte`, `lib/notify.ts`).
- **El store de mensajes del ws9 es el default de todos los clientes** (`leerPar`, `lib/plantillas.ts`).

**Vive en:** `lib/flujo-conversacion.ts` (`huecoHacia`, la flecha de la que escucha) · `lib/flujo-grafo.ts`
(`rotuloSiNoDeRespuesta`) · `app/automations/PanelProbar.tsx` · `app/automations/SecuenciaPerfil.tsx`
(`EdicionLocal.freno`) · `app/agencia/TemplateDetalleModal.tsx` · `lib/recordatorio-lead.ts` (`reunionParaElDueno`)

## Lo que quedó sin hacer

**De la parte «tiempo» (sexta tanda, 09/10/2026):**

- **Montar el selector en los cinco «{ }»** (las líneas exactas, en el informe de la parte): el composer
  de WhatsApp (`app/automations/EditorMensajeWhatsApp.tsx`, el `MenuWA` de `abierto === 'datos'`), el email
  (`app/automations/EditorEmailGmail.tsx`, los dos `MenuWA` de datos), el editor de avisos
  (`app/agencia/EditorMensaje.tsx`, el `Dropdown` de secciones), la tarjeta MAKO (`app/automations/FlujoLienzo.tsx`,
  `DATOS_MAKO`) y los avisos (`app/agencia/FlujoAviso.tsx`, que ya recibe el árbol nuevo). Hasta que se
  monten, el WhatsApp y el email ofrecen los 4 de siempre (sin «Tu negocio») y el aviso, el árbol nuevo
  aplanado en secciones.
- **La tarjeta MAKO resuelve sólo los 5 del motor** (`textoDelAviso`, lib/api-mako/areas/chatbot.run.ts):
  pasarla a `conVariables(t, { ws, leadId, destino: 'equipo' })` ANTES de ofrecerle el árbol.
- ~~Borrar los cascarones `sinPrecision` / `avisoDePrecision`~~ HECHO en la segunda pasada (parte «flujo»):
  `tests/espera-duracion.test.ts` falla si vuelven.
- **«Probar»** previsualiza con el lead de ejemplo de los 5 datos (`textoDeEjemplo`, lib/simulador-grafo.ts) y
  la prueba real con `valoresVariablesLead` (`probarSecuencia`, lib/setting-secuencias.ts): los tokens nuevos
  salen crudos ahí. Va `{ ...valoresDeEjemplo(), ...lo de hoy }`.
- **Textos de la API viejos**: «cada hora, en horario de envío» y «la ventana de 9 a 21» en
  lib/api-mako/areas/chatbot.run.ts (`cuandoSale`, la nota de la simulación) y chatbot.def.ts (dos descripciones).
- **Lo que decide Martín**: los recordatorios de clases (lib/curso-mensajes.ts) y las insistencias al grupo
  (lib/flujos-tipos.ts, `INSISTIR_VENTANA` 8-21) tienen su propio horario fijo y no siguen al de
  Configuraciones; ¿el horario del negocio vale también para ellos?
- **El curso de un lead es una aproximación** (lo que abre su acceso, o su entrega + el producto de su
  embudo + donde ya tiene avance): la regla completa vive en `universoDeLaEntrega` y lee la cartera entera.
  `lib/variables-resolver.ts`
- **El tick topea en 1000 filas** por minuto (PostgREST): con más, lo que queda sale al minuto siguiente o con
  la corrida de la hora. `app/api/cron/nutricion-tick/route.ts`
- **Verlo con clics**: Configuraciones › Horario y el selector en árbol.

**De la parte «lienzo» (quinta 2), lo que decide Martín:** si mover una tarjeta se deshace con Ctrl+Z (hoy
no: la pila es de los pasos), si hace falta un «Reacomodar» que vuelva al layout automático, y qué pasa con
una tarjeta soltada arriba o a la izquierda del margen (queda en coordenadas negativas y «Centrar» no la
cuenta; igual en /mensajes). La copia de «Duplicar» hereda el acomodo. `app/_components/Lienzo.tsx`

**Del punto 15 de la cuarta tanda (09/10/2026):** los tres enchufes que quedaron en archivos de otras
partes —el número de salida en el editor, «✦ MaKo» al lado del título (`accionesTitulo` de `Lienzo.tsx`)
y la tarjeta con «+N más» y sin la transcripción— y el «De» del email (punto 16) se ENCHUFARON al unir la
tanda, con `tests/chatbot-enchufes.test.ts` (7 roturas, las 7 en rojo). Lo que sigue sin hacer: el
marcador de cuántas partes salieron vive en `nutricion_envios.asunto` (una columna `partes_salidas` es el
arreglo de fondo) y el borrador del setter de un mensaje de varias partes junta los textos en uno
(`wa_borradores` no tiene partes). `lib/mensaje-partes.ts` · `lib/nutricion.ts`

**De la cuarta tanda (09/10/2026):** los puntos 1, 5, 6 (la cuota N), 7, 8, 11 (más acciones), 14,
15 y 16, cada uno con sus archivos, en `docs/relevo/chatbot.md` → «La cuarta tanda». El chat de CRM ya
dejó marcadas las etapas de reunión (`adf1ca3d`), que es lo que el punto 5 necesitaba.


**De la tercera tanda (09/10/2026)**

- **Verla en un navegador**: editor mediano, CRON por pasos, emoji, «⋯» de la lista, «Nueva», bandeja
  tipo Gmail de «Probar», editor rico del email, monto al mover a Ganado y la capa de Crear con IA.
- `proponer_cambio_etapa` no acepta el producto (`embudoId`); faltan en el registro «sacar de una
  automatización» y «mover en el kanban de entrega». `lib/api-mako/areas/crm.def.ts` · `cs.def.ts`
- Crear con IA sólo conoce las 9 condiciones de antes, no el catálogo. `lib/flujo-ia.ts`
- `getVslEngagementMap` se traga el error: con la base caída, «No reprodujo el VSL» se cumpliría para
  todos. Hace falta una lectura estricta para el motor. `lib/leads.ts`
- El modelo gratis de OpenRouter por default está muerto para TODAS las features y `CASCADA_DOCS` sigue
  con OpenAI y Mistral. `lib/ai-cheap.ts`
- La red de plataforma en Crear con IA (cliente con una sola key) y Cancelar que no frena la cascada. `lib/ai-cheap.ts`
- Las props muertas del editor de WhatsApp (`mostrarRevisar`, `revisarHeredado`, `disposicion`). `app/automations/EditorMensajeWhatsApp.tsx`
- **La key de Gemini de la plataforma está bloqueada por Google** (403): lo decide Martín.

**De la segunda tanda (09/10/2026)**

- **Verla en un navegador en producción**: el CRON con «Al entrar» y «Si responde», el ＋ en paralelo,
  las tarjetas de control, el editor apaisado (WhatsApp en fila, Gmail, la frase de etiqueta), el
  selector de acciones, «Probar» ancho con un email, y crear con IA de punta a punta en el ws3.
- **Las secuencias de los clientes están creadas EN PAUSA** (#221, #222 y la #220 en el ws1; #223 y
  #224 en el ws13). Falta que Martín las active, y el disparador de la #224: la etapa «noresp» no
  existe en el embudo del ws13 y `setTriggerSecuencia` la rechaza. Código Inmobiliario no tiene canal
  hoy.
- `saveLeadRespuestas` guarda el set entero en UN insert: una fila mala pierde todas. `lib/leads.ts`
- El «+N» de los avisos de la IA vive en el `title` (no se ve en un teléfono). `app/automations/SecuenciaPerfil.tsx`
- `asignar_closer_setter` salió de la lista blanca de la IA en vez de validar nombres. `lib/flujo-ia.ts`
- Un override guardado del prompt `chatbot.crear-ia.system` conserva el ejemplo viejo.
- El editor y «Probar» pintan itálica con `_…_` sin bordes (`lead_nombre_x`). `app/agencia/EditorMensaje.tsx` · `app/_components/TextoMarcas.tsx`
- `scripts/typecheck-lock.mjs` arma la ruta de tsc a mano: en un worktree anidado da MODULE_NOT_FOUND
  (va `createRequire(...).resolve('typescript/bin/tsc')`). Lo mismo `tests/replay-envoltorio.test.ts`.
- El detector de voseo bueno vive en un test; `validarIA` usa la lista corta.

**De la primera tanda — antes de desplegar (HECHO el 08/10)**

- **Aplicar la 0223, la 0224 y la 0225 ANTES del deploy** (el código nuevo lee sus columnas y
  tablas) y, después del deploy, correr `npx tsx scripts/migrar-secuencias-a-grafo.mts --aplicar`.
  Lo decide Martín. `supabase/migrations/0223_flujo_grafo.sql` · `0224_crm_etiquetas.sql` ·
  `0225_setting_adjuntos.sql`.
- **Nada lo vio todavía un navegador.** Ni las cinco partes ni los arreglos levantaron un dev
  server (bootear local escribe en prod, y con `node_modules` como junction Turbopack no arranca).
  Falta mirar: los puertos y las filas de Condición y de «Si responde», el ＋ de cada salida vacía,
  el panel de 392 px con el composer, la nota de voz con link y el PDF con caption en su alto fijo,
  «Probar» abierto al editar una tarjeta, el error de Publicar abriendo su tarjeta, el popover del
  emoji y del clip sobre el panel, y el recordatorio con sus 7 tarjetas.

**Riesgos vivos**

- (Arreglado el mismo 08/10, ver la entrada siguiente.) `armarSecuenciasDeAudios` escribía
  `pasos` directo sobre las secuencias del onboarding.
- **El «aviso repetido» se detecta por el PREFIJO del resumen** (`AVISO_REPETIDO`, `lib/nutricion-grafo-motor.ts`), porque `aplicarEnElActo` no devolvía los `datos` de la acción. Desde `c4309144` (sesión API de MaKo) `ResultadoFlujo` trae `datos`: `avisar_al_equipo` puede devolver `{ salio: boolean }` y el motor leerlo de ahí en vez de comparar texto.
- **`resolverHandoff` reactiva a 'activa' sin `proximo_envio_at`**: la cola filtra con `lte` y un
  null no entra nunca. Bug previo, sin arreglar. `lib/chat-agent-handoff.ts` (`resolverHandoff`).
- **No hay forma de devolverle la charla a MaKo después de un hand-off**: `resolver_handoff`
  necesita una fila en `chat_agent_handoffs`, que el flujo no crea, y hoy sólo la reabre una
  reinscripción (`reactivarInscripcion` limpia la charla). Decisión de producto.
  `lib/chat-agent-handoff.ts` · `lib/nutricion.ts` (`responderConGrafo`).
- **Publicar una secuencia convertida no resuelve el hand-off vivo** (la segunda mitad de
  lienzo-1): una inscripción en 'handoff' publicada desde el lienzo antes del script queda sin
  salida; el script sí lo resuelve. `app/automations/SecuenciaPerfil.tsx` · `lib/nutricion.ts`
  (`setSecuenciaPasos`).
- **El merge de `setSecuenciaPasos` trata `variantes: []` como ausente**
  (`Array.isArray(p.variantes) && p.variantes.length ? … : variantesPrevias.get(…)`): la ✕ de la
  última variante no la borra. No se cambió porque antes hay que auditar a los diez escritores de
  `pasos`: uno que mande `[]` siempre borraría las variantes en cada guardado. `lib/nutricion.ts`.
- **`generarVariantes` saltea sólo `tipo === 'audio'`**: la acción «variantes» le puede volver a
  escribir variantes al caption de un archivo. `lib/secuencias-variantes.ts`.
- **`normalizar` renombra un `o0` viejo si se inserta un paso SIN id al principio**: el nuevo toma
  `o0`, el viejo pasa a `o0_2`, y una inscripción con `nodo_actual = 'o0'` seguiría al paso nuevo.
  Todo escritor que inserte pasos les da `nuevoId`. `lib/flujo-grafo.ts` (`normalizar`).
- **`inscribir_lead_secuencia` desde un «⚡ Acción» sigue reiniciando lo terminado**: es la «orden
  explícita» de la regla 3 y no usa `desdeFlujo`. Si Martín quiere el mismo freno, se pasa desde
  `lib/api-mako/areas/chatbot.run.ts` cuando `desdeUnFlujo(ctx)`.

**Arreglos que faltan**

- **«Probar» no lee la estrategia local**: `responderSimulador` lee de lo GUARDADO nombre, etapa,
  objetivo, gancho, preguntas y criterio; del lienzo sólo llega el caso. Haría falta un
  `opts.estrategia`. `lib/setting-simulador.ts`.
- **Los hand-offs pendientes**: abrir directo la tarjeta «Si responde» al entrar por el aviso (hoy
  `?sec=` sólo elige la automatización) y resolverlos al publicar un caso nuevo.
  `app/automations/SimuladorWhatsApp.tsx` · `app/automations/SecuenciaPerfil.tsx`.
- **El inbox oficial sigue con su copia del composer** (la tercera). `app/whatsapp/WhatsAppApp.tsx`.
- **El comentario del `maxWidth` del panel del nodo dice content-box y es border-box**, y el `+ 30`
  sobra. `app/_components/Lienzo.tsx` (cerca de la línea 746).
- **Las etiquetas**: la vuelta WhatsApp→MaKo (una rama `labels.association` en
  `app/api/webhooks/evolution/route.ts`) y la columna de línea en `evolution_labels`; y los avisos de
  /mensajes no cuentan el uso de una etiqueta (`usoDeEtiqueta`, `lib/etiquetas.ts`). El detalle, en
  [hallazgos-comunicacion.md](hallazgos-comunicacion.md) y [hallazgos-crm.md](hallazgos-crm.md).
- **El tope de 40 caracteres del nombre vive en dos constantes**: `TOPE_NOMBRE_SECUENCIA`
  (`lib/setting-estrategia.ts`) y `TOPE_NOMBRE` (`app/automations/SimuladorWhatsApp.tsx`).
- **La condición «Está en la etapa» ofrece sólo las etapas de venta de los productos con embudo**:
  no ofrece «la casa» ni las de entrega, porque `HechosLead` no las tiene. `app/automations/FlujoLienzo.tsx`.
- **El recordatorio**: lo que se borra queda sin borrador. (Cambiar de automatización con textos sin
  publicar ya pregunta desde el 10/10: «Restos de versiones anteriores, grupo recordatorio».)
  `app/automations/RecordatorioFlujo.tsx`.
- **El área `chatbot` de `/admin/dev` no apunta a este documento** (le falta `hallazgos:
  'hallazgos-chatbot'`). `app/admin/dev/areas.ts`.

## Octava tanda (10/10/2026, tarde): copiar y pegar, el lazo, el horario de oficina y el recordatorio en el motor

Lo hecho está en `b8af255e`, `37727baa` (el lienzo) y `c309b390` (el recordatorio). Acá lo que no se ve en el diff.

- **Un zoom borroso no era la resolución de nada: era `willChange: 'transform'` en la capa del lienzo.** Con esa
  pista Chrome pinta la capa una vez y estira el bitmap al cambiar la escala, así que al acercar el texto se
  ve lavado. Sin ella vuelve a pintar a la escala nueva. **Vive en:** `app/_components/Lienzo.tsx` (la capa).
- **El desplegable de la casa se salía de la pantalla por el costado** (el «Probar» pegado al borde): abría
  siempre desde el borde izquierdo del botón. Ahora, con el ancho MEDIDO en el segundo cuadro, si no entra se
  ancla al borde derecho. Arregla a todos los desplegables, no sólo a ése. **Vive en:**
  `app/components/Dropdown.tsx` (`place`).
- **«Si responde» no tiene padre en el dato, así que borrar su flecha no tenía qué borrar.** La flecha del
  CRON se DIBUJA (es lo que hace el motor), no es un puerto. Borrarla tuvo que ser una marca en el nodo
  (`suelta`): `raizRespuesta` la saltea, así que el motor deja de escuchar y Publicar la frena como a
  cualquier suelta; conectarla desde el CRON la saca. Y es la SEXTA puerta de `setSecuenciaPasos`: sin la línea
  en `camposDelFlujo`, guardar le devolvía la flecha. **Vive en:** `lib/flujo-grafo.ts`, `lib/flujo-edicion.ts`,
  `lib/nutricion-grafo-motor.ts`.
- **«Sacar una flecha no mueve nada» no se resuelve guardando posiciones relativas.** Las posiciones van
  relativas al CRON del árbol, y sacar una flecha puede correr el CRON mismo (`aOrigen`). Se fija cada tarjeta
  que CAMBIARÍA de lugar, contra el ancla del árbol NUEVO (`congelarPosiciones`); las que no cambian siguen
  acomodándose solas. **Vive en:** `lib/lienzo-posiciones.ts`.
- **Minutos entre dos mensajes no se pueden dormir.** El motor duerme las pausas adentro de la corrida (tope
  10 s): elegir minutos PARTE la tarjeta con una espera en el medio (`partirConEspera`). Martín lo confirmó el
  10/10 a la noche: **queda así**. **Vive en:** `lib/flujo-edicion.ts`, `app/automations/EditorMensajeWhatsApp.tsx`.
- **Un menú que cuenta lo elegido tiene que contar lo que la acción hace.** El CRON entra en el lazo pero no
  se copia ni se borra como tarjeta: el menú decía «Eliminar 3 tarjetas» y borraba 2. Lo vio el navegador, no
  un test. **Vive en:** `app/automations/FlujoLienzo.tsx` (`menuNodo`).
- **⚠️ La primera medición del lazo dio CERO y el lazo andaba.** El arrastre arrancaba en el rincón de abajo a
  la derecha, encima de «Publicar» (`data-no-pan`): el lienzo no lo toma, a propósito. Repetido desde el fondo
  vacío: lazo visible, 3 elegidas, la cuarta atenuada. Antes de diagnosticar un gesto, se mira DÓNDE empezó.
- **`next dev` en un worktree tropieza igual que el build** con el junction de `node_modules` («Symlink … points
  out of the filesystem root»): la misma raíz temporal en `next.config.ts`, y restaurarla después.
- **Leer el portapapeles pide permiso** (el aviso «Copiaste un flujo» al entrar y «Pegar lo copiado» del modal):
  sin permiso no aparece nada, y no se insiste. El «Ahora no» se recuerda por firma de la copia, en este
  navegador. Ctrl+C / Ctrl+V del lienzo usan los eventos `copy` / `paste`, que no piden nada.

Lo que quedó sin hacer, con su archivo:
- ~~La galería no tiene «Recordatorio de la reunión»~~ HECHO el 10/10 a la noche: ver «El recordatorio como
  plantilla», abajo.
- Arrastrar lo elegido con el lazo JUNTO (`app/_components/Lienzo.tsx`): hoy se mueve de a una.
- «Pídesela a MaKo» del modal no lleva el pedido escrito: crea la vacía y abre la caja (`app/automations/GaleriaPlantillas.tsx`).

## El recordatorio como plantilla (10/10/2026, noche, claude3)

Decisión de Martín, a la pregunta de qué hacer con el recordatorio de un negocio nuevo (la opción recomendada era
crearla sola al dar de alta, pausada): **«Ningún negocio tiene que arrancar con ninguna automatización creada, para
eso ya tenemos los templates. Solo ponlo como template.»** Y la espera en minutos que parte la tarjeta: «queda así».

- **Un CRON fijo NO puede entrar por `guardarDisparadores`, como las etapas: va en la FILA al insertar.**
  `setSecuenciaPasos` lee el `trigger_tipo` de la fila para decidir si exige la forma que el emisor del recordatorio
  sabe mandar (`toquesDeLaAutomatizacion`). Con el CRON puesto DESPUÉS de los pasos —que es como entra la etapa de
  las otras plantillas—, los pasos se guardan sin esa vara. Por eso `filaDePlantilla` escribe `cron.fijo` y la lista
  de CRON no se toca (roturas R28 y R33). **Vive en:** `lib/plantilla-crear.ts`.
- **Uno por negocio, y lo frenan los dos lados.** Con dos filas el emisor manda «la primera activa por cada minuto»
  (las marcas `claveToque` evitan el doble envío), pero la lista muestra dos recordatorios sin decir cuál sale. El
  server rechaza crear otro si hay uno sin archivar, y la galería lo dibuja apagado con «Ya la tienes en tu lista»
  (`yaLaTiene`, con el `trigger_tipo` de la lista que ya tiene la pantalla). Uno ARCHIVADO no cuenta: la lista no lo
  muestra. **Vive en:** `lib/plantilla-crear.ts`, `app/automations/GaleriaPlantillas.tsx`.
- **Sus datos del «{ }» no son los del motor.** `{{cuando}}`, `{{hora}}`, `{{faltan}}` y `{{link}}` los resuelve su
  emisor (`VARIABLES`, `lib/recordatorio-lead.ts`); el guard de la galería que mira el catálogo del motor los daba
  por inexistentes. Ahora los mira contra `VARIABLES` cuando el CRON es el del recordatorio, y uno del motor
  (`{{lead_nombre}}`) da rojo en tres tests (R31). **Vive en:** `tests/plantillas-automatizaciones.test.ts`.
- **Los pasos salen de la MISMA función que la mudanza** (`pasosDeLaConfig`, con los textos de fábrica y un prefijo
  de ids `rr_`): una segunda escritura de la forma del recordatorio se separaría de la que lee el emisor.
- **Nada del alta de un negocio crea automatizaciones** (medido con `grep` de los `insert` a
  `nutricion_secuencias`): los únicos son la galería, Duplicar, copiar entre negocios, la API de MaKo y
  `armarSecuenciasDeAudios`, que sólo llama `/api/chat-agent/onboarding/resumen` (sin llamadores) y la API.

Medido en producción (sólo lectura, 10/10 ~21:20):
- Las 10 filas del recordatorio están (#228 del ws1 PRENDIDA, #229-#237 pausadas) y **ninguna se tocó desde que la
  creó la mudanza**. De las 9 pausadas, sólo el ws11 tenía una configuración de antes, y estaba apagada y sin textos
  propios: **son 9 automatizaciones que esos negocios no crearon**, justo lo que la decisión de arriba dice que no
  tiene que pasar. **Martín: «Archivalos y los que te parezca ponlos como templates».** Las 9 eran idénticas a la
  plantilla (textos de fábrica, sin números propios, sin borrador ni posiciones, 0 inscripciones), así que no hay
  otra plantilla que sacar de ahí: se ARCHIVARON el 11/10 00:52 UTC (#229-#237, con compare-and-set sobre
  `activa`, `archivada_at` y `updated_at`). Para recuperar una: `archivada_at = null`. No cambia ningún envío: sin
  fila, el emisor lee la configuración de antes, que en esos negocios no existe o está apagada (ws11).
- **⚠️ El script de la mudanza las habría vuelto a crear.** `scripts/recordatorio-a-automatizacion.mts` crea la fila
  a todo negocio sin una SIN ARCHIVAR, así que una segunda corrida con `--aplicar` devolvía las 9. Ahora saltea al
  que no tiene nada propio que mudar (apagada y de fábrica); el simulacro da «creadas: 0».
- **Y lo mismo en el ws1** (Martín: «También con Mauricio... Archiva todas las que no haya pedido. Solo deja la de
  los audios que él ya grabó y el mensaje de MaKo de nueva agenda»): se archivaron la #220 (residuo +45 días), la
  #226 (felicitación al terminar clase) y la #227 (una vacía), todas pausadas y sin nadie adentro. Quedan
  prendidas las tres con SUS audios (#198 bienvenida, #212 y #213 post-agenda: audios 1, 5 y 7, grabados el
  02/08) y, con su «sí», el recordatorio #228. «Nueva agenda» es el aviso `reunion-nuevo-agendado` (🎯 Nuevo
  agendado), que no está en la lista del cliente y sigue prendido. Los otros Mensajes de MaKo de Mauricio NO se
  apagaron: a la pregunta contestó con la regla de abajo, no con un «apagalos».
- **Todavía no salió ni un recordatorio por el camino nuevo**: en toda la historia hay 3 marcas, las tres del ws1 y
  anteriores a la mudanza, y desde entonces no hubo reuniones. El primero real es el toque de 24 h de la reunión
  del 13/10 17:00 UTC (lead 2593): sale el **12/10 a las 17:00 UTC**. Ésa es la prueba de que el emisor lee la fila.

## Novena tanda (10-11/10/2026, claude3): el AI Step, el «⋯» de MaKo en WhatsApp y «Agendó» unificado

Pedidos de Martín: «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso justamente debería
estar en una nueva tarjeta que sea "AI Step". Configuralo allí» (eligió «una tarjeta con sus casos adentro»); «No
aparecen los 3 puntos para eliminar una automatización de "MaKo en WhatsApp"... deben ser EXACTAMENTE igual al
resto»; «Las dos automatizaciones de agendó se podrían unificar ya que se tiene justamente la tarjeta de CONDITION»;
y arrastrar el lienzo con el botón del medio. Código en `f2d4f25a` (botón del medio) y `18369310` (el resto).

- **El AI Step NO es una clase de nodo: es una FORMA del «Si responde»** (`paso_ia: true`, casos con
  `responder`/`sola`/`avisar`, `instrucciones`, `otra_aviso`). Una clase nueva tocaba ~15 archivos y duplicaba las
  reglas de «una por automatización, sin padre, sin esperas, sin paralelos»; como forma, `claseDe` sigue diciendo
  'respuesta' y las hereda. **El motor no se reescribió**: `expandirPasoIA` (pura, idempotente) lo devuelve a la
  forma de siempre en las puertas que RECORREN la respuesta (`responderConGrafo`, el simulador), así el
  clasificador, el borrador, la guarda de la plata y la charla de varios mensajes son los mismos. Lo que se GUARDA
  es la forma compacta. **Vive en:** `lib/flujo-grafo.ts`, `lib/nutricion.ts`, `lib/simulador-grafo.ts`,
  `app/automations/EditorPasoIA.tsx`, `lib/paso-ia-convertir.ts` (el «Pasar a AI Step»).
- **Los ids de la expansión llevan `~` a propósito** (`<nodo>~<caso>~r`, `~a`, `<nodo>~otra`): quedan fuera de
  `RX_ID`, así un flujo expandido guardado por error pierde sus flechas y Publicar falla RUIDOSO en vez de guardar
  tarjetas fantasma. Y son fijos: el motor guarda `nodo_id` y la clave del reclamo con ellos.
- **⚠️ La forma de siempre deja publicar un caso que no lleva a nada, y el motor se come la respuesta en silencio.**
  Sólo el AI Step exige que el caso conteste o avise (`faltaEnCaso`). Por eso **volver a un deploy anterior a
  `18369310` después de convertir datos es destructivo**: el motor viejo lee los casos sin nada debajo (MaKo deja
  de contestar y sólo avisa), y el primer guardado con el `camposDelFlujo` viejo borra `paso_ia` y las guías sin un
  error. Antes de un rollback, el respaldo que deja el script (`backups/novena-tanda-ws1-*.json`).
- **Un id de caso repetido era inofensivo y expandido es dañino**: la expansión deriva las tarjetas del id del caso,
  y el segundo contestaba con la guía del primero. Nace solo (un id inválido queda en '' y su `<nodo>c<k>` choca).
  El diagnóstico obvio —frenar al guardar— era el equivocado: el lienzo no muestra ids y nadie podría arreglarlo.
  Se desempatan solos (`idsDeCasos`). **Vive en:** `lib/flujo-grafo.ts`.
- **Proponer aceptaba y ejecutar fallaba**: enseñarle a un AI Step un caso sin guía (API `agregar_escenario_secuencia`
  o `resolverHandoff`) pasaba `preparar` y explotaba al confirmar. Ahora frena en `preparar` (AGENTS.md: lo que se
  puede saber sin escribir falla antes de la pendiente). **Vive en:** `lib/nutricion-grafo-motor.ts`
  (`agregarCasoAlGrafo`).
- **SIN DECIDIR (Martín):** plegar a AI Step pierde el texto PROPIO del aviso de cada caso (sale el título del caso +
  «Te escribió sobre esto.»): en la galería eran 5, p.ej. «coordina el nuevo horario». Y un caso que contesta Y
  avisa manda dos avisos (el del redactor y el del caso). Guardar el texto haría falta un campo más en el caso.
- **«⋯» de MaKo: Eliminar = OCULTAR + apagar, en ese negocio** (`oculto` en el store, `lib/plantillas-ocultas.ts`), y
  se recupera desde «Nueva automatización». ⚠️ **`oculto` no se hereda de la base y `enabled` sí**: ocultar o
  recuperar EN la base de la plataforma apagaría o prendería el mensaje para todos los clientes; está frenado en
  `ocultarPlantilla`/`restaurarPlantilla`. Duplicar y Copiar no se ofrecen para un mensaje (la copia de uno de
  fábrica no sale por el mismo evento). **Vive en:** `lib/plantillas.ts`, `app/automations/SimuladorWhatsApp.tsx`.
- **«Agendó» unificado:** en la galería, una plantilla con la condición «Ya le escribiste». En Mauricio, la #212 se
  archiva y la #213 pasa a tener los dos CRON de antes (`agendado_primer_contacto` en la columna y
  `agendado_ya_contactado`). ⚠️ **El ORDEN importa: archivar ANTES de sumar el CRON.** Con el CRON puesto y la #212
  viva, `enrolarPorEvento` inscribe al lead en las dos (la exclusión de familia se pregunta antes de insertar) y le
  llegan dos audios. Y la pantalla no ofrece los eventos de antes como CRON: si alguien borra el segundo, vuelve
  sólo por la API (`cambiar_crons_secuencia`) o el script.
- **Las escrituras de una secuencia no tienen compare-and-set** (`setSecuenciaPasos`, `renombrarSecuencia`,
  `archivarSecuencias`: update por id): un Publicar en paralelo a un script pisa sin error. Por eso el script de
  datos escribe con supabase-js y compare-and-set sobre `updated_at`, validando con las funciones puras.
  **Vive en:** `scripts/novena-tanda-ws1.mts`.
- **Una inscripción sin `nodo_actual` depende del ÍNDICE del array** (la 199 de la #198: `paso_actual` 1). Meter una
  tarjeta antes de ese índice la mueve de tarjeta sin error; los nodos nuevos van SIEMPRE al final.
- **El botón del medio**: cancelar el `pointerdown` no frena el auto-scroll de Windows (cuelga del `mousedown`), y
  el `pointerup` del medio tiene que salir antes del «clic quieto», que cerraba el panel abierto.
  **Vive en:** `app/_components/Lienzo.tsx`.
- Sin ver en el navegador: los altos de la tarjeta AI STEP y su panel, el «⋯» de los mensajes y el botón del medio
  con un mouse real (el auto-scroll no se dibuja en headless). Lo mira Martín.

## «MaKo en WhatsApp» = una automatización más (11/10/2026, claude3, `56581a3f`)

Martín, con enojo y después de pedirlo en varias tandas: «debe ser IDENTICO… quedaron cosas muy viejas que quiero que
las depreques. Todo ahora es lo mismo». Decidió «Todos arrancan vacíos» y nada de opciones nuevas («ya existe con lo
que hicimos de CONDITIONS y DELAY… Solo debes readaptar esas plantillas»). El diseño entero, en
`docs/diseno-mako-en-whatsapp-unificado.md`.

- **⚠️ El diagnóstico de fondo: se igualaba POR FUERA.** Tres tandas seguidas (quinta, novena, ésta) le agregaron a
  los mensajes un botón o un «⋯» de dos opciones encima de OTRO modelo (el store de plantillas, el lienzo de
  Notificaciones, su motor). Por eso «sigue todo distinto». La cura fue mudarlos al modelo de la automatización, no
  más paridad. Regla en la memoria (`mako-en-whatsapp-es-una-automatizacion`).
- **El molde es el del recordatorio de la reunión:** una fila con un CRON que el motor de nutrición NO inscribe
  (`aviso_mako`, el evento en el subtipo; `TRIGGERS_DEL_EMISOR`) y que corre su emisor de siempre
  (`emitirDelCatalogo` → `emitirPorEvento`, lib/aviso-evento.ts). Los 45 lugares que emiten avisos no cambiaron.
- **El `tipo` que se emite NO se puede cambiar:** el dedup (la cobranza: 120 días por cuota), el rótulo, el resumen
  y el feed cuelgan de él. Con otro tipo, el día del cambio se reenvían todas las cuotas vencidas.
- **Dos filas del mismo evento:** el dedup se reclama UNA vez por evento y cada tarjeta emite sin ventana propia; si
  no, la segunda fila la frena la ventana de la primera.
- **Una corrida dormida guarda una POSICIÓN, no una tarjeta.** Al editar el flujo mientras duerme, al despertar
  ejecutaba otra tarjeta (repetía la entrada de la cobranza con `{{cuota_dias}}` sin resolver). Ahora guarda una
  firma de los pasos y se corta si cambiaron. ⚠️ Las corridas de los flujos del STORE (p.ej. `cuota-por-vencer`)
  tienen el mismo problema y no se tocaron (hoy hay 0 corridas). **Vive en:** `lib/flujos.ts` (`retomarCorrida`).
- **«No pude leer al lead» gastaba el dedup** (la CONDITION lo leía como «no cumple» y la corrida terminaba): ahora
  reintenta 3 veces cada 5 min sin gastar la ventana. Y «Lo que arma MaKo» (`{{mensaje_mako}}`) no va después de un
  DELAY: es la foto de ese momento.
- **Duplicar perdía los CRON** (la lista blanca `COPIA` no incluía `disparadores`): arreglado para las filas del
  emisor. **Vive en:** `lib/secuencia-duplicar.ts`.
- **SIN HACER:** `lib/nutricion-desenlace.ts` (`encadenar`) y `lib/api-mako/areas/chatbot.run.ts` (~785) todavía
  dejan apuntar a una fila del emisor como siguiente automatización; el motor la cancela en el tick siguiente, pero
  queda contada. El dry-run la muestra como «acción».
- **Consecuencia que se avisó:** desde el deploy, «aviso antes de la reunión», «un lead te escribió» y «cuota vencida»
  dejan de salir en los 10 negocios hasta que cada uno agregue su plantilla. El ws1 recibía 7 y 3 en 30 días.

## Décima tanda (11/10/2026, claude3)

Siete partes en paralelo, una revisión adversarial de motor y datos y el cierre. El pedido, textual, en
`app/admin/dev/chatbot/bitacora.ts` (11/10, 04:30). Lo que no se ve en el diff:

- **Un freno de «no cambia lo que se contesta» compara lo que lee el REDACTOR, no sólo el clasificador.** La migración
  del AI Step ponía en cada caso el objetivo de la tabla de §8.4 y `loQueContesta` daba igual (nombre, «cuándo», guía,
  «sale sola»), pero el objetivo viaja aparte al redactor (`bloqueEscenario`): con `--aplicar`, la #213 del ws1 (activa,
  dos casos que salen solos) contestaba otra cosa. El diseño se contradecía (§8.4 contra §10-A). Lo migrado NO lleva
  objetivo (se imprime como sugerencia) y el freno compara objetivo, ejemplos, audio y «hasta». **Vive en:**
  `lib/ai-step-migrar.ts`, `scripts/ai-step-v2.mts`.
- **El repo tiene DOS zonas por defecto:** `ZONA_SIN_CONFIGURAR` (Ciudad de México, `lib/nutricion-grafo-motor.ts`) y
  `TZ_DEFAULT` (Tijuana, `lib/timezone.ts`). Al sumar el horario de oficina, «Contesta sola» saltó de una a la otra y en
  el ws1 (sin `mako.timezone`, horario 9-21 prendido) la ventana se corrió una hora, dos desde el 1/11. El diagnóstico
  obvio era «el horario está mal»: estaba bien. Volvió a `tz` (`tzActual`). **Vive en:** `lib/nutricion.ts` («4.5) ¿SALE
  SOLA?»). ⚠️ SIN DECIDIR: el resto del motor ya manda con el horario en hora de Ciudad de México al ws1, que es de Baja
  California: o se guarda su `mako.timezone`, o se unifican los dos defaults. **Resuelto en la undécima** (un default y una lectura):
  `docs/hallazgos-infra.md` → «Una zona, un default, una lectura».
- **Lo de fábrica no se valida contra el rango de lo que se ELIGE.** `limitesDeFabrica` respeta un env fuera de rango
  a propósito y `limitesParaGuardar` lo rechazaba igual: con `NUTRICION_MAX_POR_DIA` > 150 no pasaba ningún guardado
  (el env de prod no se pudo medir). **Vive en:** `lib/limites-envio.ts`.
- **Dos clasificadores sobre las mismas palabras: el arreglo de uno rompe al otro.** La agenda se llevaba «créame una
  automatización que le escriba a los que no vinieron a la reunión»; la regla nueva, puesta antes, se llevó «Quiero una
  reunión sobre el flujo de ventas» y «Haz el flujo de caja». Entre el verbo y el sustantivo no puede haber otro objeto
  de agenda, y «flujo de caja / efectivo / fondos / dinero» no es un flujo. **Vive en:** `lib/mako-intencion.ts`.
- **El typecheck acotado a «mis archivos» no ve los tests de otro:** quedaron cuatro errores de la tanda —
  `useState<función>(() => (b) => …)` deja `b` sin tipo, un `rol: 'setter'` que `Rol` no tiene, el estrechamiento de
  `p.cron` perdido en un callback, un `gating` opcional—. Y un enchufe del reparto por archivo: «MaKo en WhatsApp» seguía
  en el panel de control de 280 (`editorDeTarjeta`, `lib/lienzo-grafo.ts`; /mensajes ya lo medía como un mensaje).
- **Filtrar el selector no corta un remitente.** El ws1 tiene guardados el remitente y el dominio de MaKo: el corte real
  va en el motor (`procesarEnvios`, junto al sandbox: «remitente de MaKo: conecta tu email», un reintento por día) y en
  /integraciones, que seguía diciendo «Conectada». **Vive en:** `lib/nutricion.ts`, `lib/integraciones.ts`.
- **La propuesta para el CRON de antes cerraba un círculo** en 24 de 32: un paso sin `siguiente` sigue por el de abajo
  del array, y la entrada se agregaba al final de una lista vieja. Se normaliza ANTES. **Vive en:** `lib/cron-de-antes.ts`.
- **Lienzo y editores, medido:** `flex: 1` con `minHeight` deja encoger el recuadro bajo su contenido (va `flex: 1 0
  auto`); un tacho que cuelga 9 px en una caja `overflow: auto` da scroll lateral (`AIRE_ESQUINA`); la rueda hacía zoom
  en los paneles porque el listener no pasivo del lienzo hace `preventDefault` de todo (`queHaceLaRueda`); el cleanup de
  un efecto ve el primer render (va por refs); la grabación se perdía al recargar (`VoiceRecorder.tsx`, por trozos).
- **Herramientas que mintieron:** `sed -i` de Git Bash pasó dos archivos CRLF a LF; un argumento que empieza con `//`
  se reescribe (TS1161); un heredoc con comillas dobles ejecutó backticks; Edit escribe ` ` como espacio duro; los
  guards con `git ls-files` no ven lo nuevo (índice temporal: `GIT_INDEX_FILE` + `git add -N`).

**SIN HACER:**
- Datos, en orden: la mig `0251_setting_audios_origen.sql` ANTES del deploy (verificar el número contra las 0249/0250
  de otras sesiones); `scripts/mudanza-nuevo-agendado.mts --aplicar` antes del push (sin eso ws1 y ws13 se quedan sin
  «nuevo agendado»); deploy; `scripts/ai-step-v2.mts` simulacro y `--aplicar` DESPUÉS (volver atrás luego es
  destructivo). `scripts/migrar-cron-de-antes.mts` se niega a `--aplicar`: falta la fase 1 del motor.
- Al commitear, `git rm` de `HorarioBoton.tsx`, `HorarioLista.tsx` y `tests/automations-horario.test.ts`: si no,
  `funnel-estructura` y `motor-tick` dan ENOENT (leen el índice).
- `app/_ui/BotonMako.tsx` (la estrella chica del ✦), `EditorCondicionDeRespuesta` sin el layout nuevo
  (`app/automations/EditorCondicion.tsx`), el chip «Sin conectar» del CRON (`FlujoLienzo.tsx`, `CuerpoCron`), el AI Step
  por Instagram/Messenger (§6), «Escuchar» en `PanelProbar.tsx`, `armar_ai_step` en la API, el filtro por medio
  (`lib/chatbot-lista-filtro.ts`), las props muertas `claseInicial` (`EditorDisparadores.tsx`) y `graphify update`.
  Nada se abrió en el navegador: lo revisa Martín.

**DECISIONES TOMADAS POR MARTÍN, a confirmar:** lo migrado sin objetivo (§10-A); «Contesta sola» en `tzActual`; el
editor de «MaKo en WhatsApp» con el tamaño del de WhatsApp pero **sin audio, archivos, varios mensajes ni ✦** (el pedido
dice «las mismas opciones»); el email de MaKo no sale y /integraciones del ws1 dice «falta» (Mauricio sin emails hasta
vincular su dominio); al salir del editor la barra pasa a burbuja; «Descartar cambios» sin preguntar si está abierta;
0 en «por persona» = siempre borrador; Publicar frena aunque esté pausada; el tutorial se abre solo a un admin la
primera vez que ve un lienzo; Instagram y Messenger sin AI Step en la galería; el evento de antes no se ofrece en el CRON.

## El CRON «Pagos» y el aviso «Entra un pago» (11/10/2026, la pasarela de pagos)

- **«Pagos» es un BOTÓN PROPIO de la primera pantalla** (decisión de Martín, elegida entre dos opciones):
  siete botones van en una grilla de **4+3**, nunca 3+3+1 (un botón solo en una tercera fila se ve roto).
  `esClaseDeEventos` reemplazó las tres copias de «instagram || messenger || email» (editor, API).
  **Vive en:** `lib/disparadores.ts` · `app/automations/EditorDisparadores.tsx` · `tests/editor-disparadores.test.ts`.
- **Lo emite la pasarela DESPUÉS de asentar el pago en el CRM** (`enrolarPorPago`, `lib/pago-entrante.ts`):
  con `fecha_primer_pago` ya escrita, `esLeadCliente` da true y el WhatsApp sale solo, no como borrador.
  Y un lead que entra pagando NO dispara `lead_nuevo` («dejó el formulario sin agendar»).
- **«Se aprueba un pago» corre UNA vez por lead**: la inscripción es única por (lead, automatización), así
  que la bienvenida sale con el primer pago y no con cada renovación de una suscripción.
- **«Entra un pago» es el quinto Evento de MaKo** (`pago_recibido` → `pago-recibido`, `textoDelCodigo`):
  sale sólo si el negocio agrega «Aviso de pago recibido» (`mako-pago`) de la galería. En una venta de
  MaKo, el texto dice cómo quedó el alta de la cuenta. `tests/plantillas-viejas.test.ts` cruza el aviso
  contra su emisor (`lib/cobros.ts`): sin emisor queda rojo — y así quedó en la rama de Automations hasta
  juntarla con la pasarela.
- **`disparadores-canales` suma `pagos`**: «conectado» es tener Stripe o Mercado Pago con lo que MaKo
  deriva (sin el aviso registrado, un pago nunca llegaría). Un test que arma `EstadoCanales` a mano
  (`tests/editor-disparadores.test.ts`) se rompe en el TYPECHECK, no en la suite: `npm test` no chequea
  tipos. **Vive en:** `lib/disparadores-canales.ts`.

_11/10/2026 — `tests/disparadores-pagos.test.ts` (6, probado con 3 roturas)._

## Undécima tanda (11/10/2026, claude3): un flujo por categoría, un AI Step por objetivo, nada inventado

El pedido, textual, en `app/admin/dev/chatbot/bitacora.ts` (11/10, 14:38), con las cuatro decisiones de la décima (12:38).
El diseño, en `docs/diseno-undecima-tanda.md`. Diez paquetes en cuatro olas, un enchufador y el cierre, en el worktree
`C:/dev/wt-undecima` (rama `undecima`). Lo que no se ve en el diff:

**El AI Step: un nodo, el saneo y los atajos**

- **⚠️ Un campo que se MUDA del caso al nodo se pierde en el saneo, no en el modelo** (el diagnóstico obvio era el
  equivocado). El diseño decía «el saneo del caso deja de escribir objetivo/audio/ejemplos»; hecho así, se borraban al
  guardar, porque `setSecuenciaPasos` arma lo limpio con `camposDelFlujo` ANTES de juntar (`grafoAGuardar` →
  `juntarPasosIA`). Regla: el campo se SUBE en el saneo, y lo que juntar tiene que plegar o reportar no se borra ahí.
  **Y se buscan los atajos de antes:** `vozDeAIStepQueFalta` salía con null mirando sólo `c.audio` antes de llamar a la
  regla pura: con la voz en el nodo, Publicar nunca frenaba por la voz y los tests de la regla seguían verdes.
  **Vive en:** `lib/nutricion-grafo-motor.ts` (`camposDelFlujo`), `lib/nutricion.ts`.
- **Sacar tarjetas del array corre los índices.** Sin ids ni `siguiente` explícitos, las de después cambian de identidad
  (`o<i>`) y de salida («la de abajo»), y una inscripción guarda una POSICIÓN. `juntarPasosIA` normaliza antes de quitar,
  y el script de prod deja los ids viejos en su índice y agrega al final (frena si algo se corre). En #213 las tres
  quitadas eran las últimas. **Vive en:** `lib/flujo-grafo.ts`, `lib/undecima-flujos-plan.ts`.
- **Una sola puerta para la libertad** (`libertadesPermitidas` + `juntarPasosIA`). Una rotura con 0 rojos destapó que el
  corte de plata del conversor (`lib/paso-ia-convertir.ts`) era código muerto: una copia de una regla es código que
  ninguna rotura detecta.
- **«Crear con IA» rompía TODO flujo con AI Step** desde que Publicar exige el objetivo: `lib/flujo-ia-crear-core.ts`
  valida la salida del modelo a nivel Publicar, toda la cascada fallaba y el reintento citaba un id que el modelo no
  conoce. Regla: una regla nueva de Publicar entra al contrato de la IA en la misma tanda (prompt, `deIA` y `validarIA`
  con las palabras del modelo).
- **`Partial<…>` es un tipo débil:** el DTO de la pantalla (`CamposDelFlujo`, `ChatAgentApp.tsx`) y el tipo de la fila
  (`PasoSecuencia`, `lib/nutricion.ts`) no declaraban objetivo/audio/ejemplos y todo compilaba. Sólo una línea de tipo
  que lo exija lo protege (`tests/automations-paso-ia-revision.test.ts`).

**El recordatorio adentro del flujo (el carril)**

- **⚠️ El «1 h antes» de una reunión temprana no salía**, aunque el carril corre fuera de horario. Lo obvio (equivocado):
  la tolerancia o el horario. Causa: el tick sólo mira las filas cuyo `proximo_envio_at` venció en los últimos 10 min, y
  con hilos esa columna resume el hilo MÁS VIEJO: uno frenado (fuera de horario, anti-ban, cupo) la deja clavada y tapa al
  del recordatorio. Regla: un hilo que tiene que salir a horario no comparte fila con uno frenado sin aplazarlo
  (`aplazaParaNoTapar`, 15 min). Y el tick filtraba `estado = 'activa'`: lo que vive en 'respondio' le era invisible
  (`ESTADOS_QUE_SE_MUEVEN`). **Vive en:** `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts`,
  `app/api/cron/nutricion-tick/route.ts`.
- **Una respuesta apagaba los recordatorios por DOS caminos:** `pausarPorRespuesta` pasaba la inscripción entera a
  'respondio' (ahora `alResponder` deja vivos los hilos del carril), y #213 tiene `desenlace.logrado = 'respondio'`, así
  que el evaluador la cerraba como lograda la hora siguiente (`desenlaceEsperaAlCarril`). Además una 'respondio' no se
  reusaba: quien contestaba y reagendaba se quedaba sin el «Nuevo agendado» (`soloQuedaElCarril`).
- **El anti-ban se comía el «15 min antes»**: sale 45 min después del «1 h antes» y el freno deja 3 h entre mensajes. El
  carril no pasa por el anti-ban ni por los topes (`pasaPorAntiBan`), pero sus envíos SÍ entran en la cuenta diaria y
  horaria de la línea para los demás mensajes (~2 por día en el ws1).
- **`{{hora}}` no es el mismo dato en dos emisores.** En el del recordatorio (`VARIABLES`, `lib/recordatorio-lead.ts`) es
  la hora de la REUNIÓN; en el catálogo del motor, la del MOMENTO. Los textos de #228 copiados tal cual decían otra hora.
  Un texto que viene de otro emisor se traduce dato por dato, y lo que no está en el mapa frena (`MAPA_RECORDATORIO`).
- **La reserva entra al instante a su etapa** (M1): `enrolarPorEvento('agenda_nueva')` suma los CRON de la etapa
  efectiva. Lo que la ficha carga a mano tiene su propia trampa, en [hallazgos-crm.md](hallazgos-crm.md).

**Los flujos de producción**

- **⚠️ #238: «la lista `disparadores` le gana a la columna» era falso, y el diagnóstico obvio se equivocó DOS veces.** El
  relevo dijo «manda la columna» y el arquitecto lo «corrigió». El motor saca el PRIMER CRON siempre de las columnas
  (`disparadoresDe`/`listaDe`, `lib/nutricion.ts`) y la lista sólo suma del segundo en adelante. Regla: qué dispara una
  fila se le pregunta a `disparadoresDe(fila)`, nunca al jsonb crudo.
- **Los borradores viejos pisan lo rehecho:** #198 tenía `pasos_borrador` y #213 `posiciones` de la forma anterior, y
  «Publicar» desde el lienzo devolvía lo viejo. El script los pone en null.
- **La galería ya traía lo que Martín rechaza:** `bienvenida-sin-agenda` era CONDITION → DELAY → CONDITION y
  `agendo-preparar` CONDITION → CONDITION; #198 nació de ahí. `problemasDeForma` (`lib/flujo-forma.ts`) cuida ahora la
  galería, «Crear con IA» y el script.
- **El ws13 no tiene etapa de no-show:** #224 se archiva (un CRON «(de antes)» se rehace sólo si el embudo tiene la
  etapa). Y su fila nueva nace PAUSADA, pre-siembra sus 9 leads de «Pre R1» y recién ahí se prende: prendida al
  insertar, el barrido podía mandar 9 «Nuevo agendado» viejos al grupo del cliente.

**Datos y tokens**

- **El renglón opcional se lleva el renglón ENTERO.** Con «{{pago_tipo}} · {{pago_modo}}», cada pago real (sin modo)
  perdía «Primer pago». Un dato opcional por renglón. «Sin valor» = la clave no está; '' cuenta como valor (si no,
  «Hola {{nombre}}, …» con nombre '' se comía el saludo). ⚠️ Y una lectura que FALLA ahora borra el renglón en silencio,
  porque el mapa de valores no distingue «no tiene» de «no pude leer» (antes salía crudo y se notaba). SIN HACER:
  marcar en el resolvedor lo que no pudo leer (`lib/variables-resolver.ts`).
- **`{{ mensaje_mako }}` con espacios no lo ve `tokensDe`** (`RE_VARIABLE` es estricto) y `aplicarVariables` sí lo
  resuelve: un validador de token prohibido armado con `tokensDe` deja pasar justo lo que el motor manda. Se busca con el
  regex del motor (`lib/tokens-del-flujo.ts`). Y `limpiarTexto` de «Crear con IA» borraba todo dato fuera de los 5 del
  motor (también los de «Próxima reunión»), y su llave suelta no aceptaba dígitos (`lead_hora_r1`).
- **Un Evento de MaKo que se retira no se borra ni se apaga:** fuera de `EVENTOS_MAKO`, #239/#240 dejan de salir; con
  `apagado`, no se pueden guardar. Es `retirado` + `EVENTOS_MAKO_OFRECIDOS`, que quedó HUÉRFANO hasta el enchufe: el
  selector del CRON seguía ofreciendo «Un lead agenda». Escribir la salida no es ofrecerla.
- **Un ciclo de imports que sólo falla según quién cargue primero:** `flujo-conversacion → tokens-del-flujo →
  aviso-evento → disparadores → flujo-conversacion`, con `aviso-evento` evaluando `EVENTOS_MAKO` al cargar. Los tests de
  flujo-conversacion pasaban e `import('lib/disparadores.ts')` tiraba «Cannot access 'EVENTOS_MAKO' before
  initialization». Regla: `lib/flujo-conversacion.ts` sólo hace `import type` de esos dos (`frenoDelFlujo` recibe los
  problemas calculados), y antes de importar algo que llega a disparadores se prueba
  `node --import tsx -e "import('./lib/disparadores.ts')"`.
- **Sumar contexto al user de «Crear con IA» deja a Groq fuera de la cascada, sin error.** Subir `TOPE_TARJETAS_IA` a
  30 parecía cambiar un número, y la salida mínima está calibrada para ~20 tarjetas: quedó en 25. Todo lo que se sume
  pasa por `entraEnGroq` (`lib/flujo-ia.ts`); la calibración es `tests/crear-ia-tercera.test.ts`.

**La tarjeta «MaKo en WhatsApp» y la Voz de MaKo**

- **«Le avisé al equipo» sin grupo:** `emitirAviso` devuelve `ok: true` aunque el WhatsApp no salga. Detalle en
  [hallazgos-comunicacion.md](hallazgos-comunicacion.md) → «Undécima tanda».
- **El cambio del editor va DENTRO del updater** (`onPasos(prev => …)`): al salir del editor llegan dos cambios en el
  mismo tick (la barra y el audio), y con los params del render el segundo pisaba al primero.
- **Editar una tarjeta de antes la pasa a TAL CUAL**: pierde el envoltorio (título, teléfono, link, «— MaKo») y el dedup
  de 12 h. La `ne9jyr0` de #213 está así hasta que corra el script, que la reescribe con los datos a la vista.
- **⚠️ Sin la mig 0257, generar la voz SÍ cobra** (el diseño §8.2 decía que no): el insert va después del TTS. `crearAudio`
  borra el binario huérfano y la 0257 va antes o junto con el deploy. La key es `MAKO_ELEVENLABS_API_KEY`, no
  `ELEVENLABS_API_KEY`: ws9/10/11 tienen ElevenLabs BYOK y la hidratación podría dejar la de un cliente en la env de
  siempre. Y el error no dice «tu cuenta» (`textoFalloVozMaKo`): esa voz la paga la plataforma.

**La lista**

- **Un campo sembrado de la prop + una SEGUNDA puerta que escribe el mismo dato:** con «Renombrar» desde la lista y la
  automatización abierta (mismo `key`), el título de `SecuenciaPerfil` quedaba viejo y un clic + blur volvía a ESCRIBIR el
  nombre anterior. Se re-siembra al dibujar cuando cambia la prop y no se está editando.
- **Un test de selector que no podía caer:** `loQuePide` (`tests/automations-recorrido.test.ts`) no pedía las clases
  (`(?<![\w-])\.` nunca coincide en `tag.clase`). Al simplificar un selector, romperlo y ver caer el test.
- Renombrar un id ARCHIVADO funcionaba y uno ajeno contestaba «ok» sin cambiar nada: ahora los dos dan 404.

**Herramientas**

- `grep $'\r'` del Git Bash dijo LF en archivos CRLF: el worktree tiene `core.autocrlf=true` y TODO `lib/` y `tests/`
  sale CRLF. Se mide con node o con `grep --binary`. Edit conserva el CRLF; Write escribe LF (git lo normaliza).
- Un typecheck que espera turno puede leer el árbol en medio de una rotura: se vuelve a correr con los archivos quietos.
- `mock.module` de node:test prueba `server-only` de punta a punta (`--conditions=react-server
  --experimental-test-module-mocks`): hay que sacar `default` del namespace que se mockea y cargar
  `lib/api-mako/runners.ts` antes que un `areas/*.run.ts`. Molde: `tests/voz-mako.test.ts`, `tests/zona-negocio.test.ts`.
- Retirar un script con un `process.exit(1)` suelto arriba hace que TypeScript tome el resto como `never` (222 errores):
  se retira con una función `void` (`retirado()`).
- Borrar un archivo trackeado rompe los tests que recorren `git ls-files` (ENOENT) hasta el `git rm`.
- Los tests que fijan una línea exacta o un TOPE de largo de un recorte (nutricion-canal 5000 → 6500,
  flujo-aviso-accion 2500, seis que fijaban `preparaUnaReunion(sec.trigger_tipo)`) se rompen con cambios que no les
  tocan: se escriben con margen y anclados a una función, no a una línea.
- Un campo «para la pantalla» que nadie lee pasa todos los tests (`propio` del dominio, `PasosInvalidosError.tarjeta`):
  sólo un grep de lectores lo ve.

**SIN HACER (con su archivo):**
- Datos, en orden y todos en simulacro: mig 0257 antes o con el deploy → deploy → `scripts/zona-negocio-backfill.mts` →
  `scripts/undecima-email-remitente.mts` → `scripts/voz-mako-agregar.mts` (después de pagar ElevenLabs y cargar
  `MAKO_ELEVENLABS_API_KEY`) → `scripts/undecima-flujos.mts`, mejor antes del 12/10 17:00 UTC (primer toque real).
  Ninguno corrió `--aplicar`.
- La limpieza §8.7, en commit aparte después de `--aplicar`: la compatibilidad de `{{mensaje_mako}}` (también
  `CLAVE_MENSAJE_MAKO` en `app/_components/CampoConDatos.tsx`), el emisor del recordatorio, `DATOS_RECORDATORIO` en
  `FlujoLienzo.tsx` y `TRIGGER_RECORDATORIO` de `TRIGGERS_DEL_EMISOR`. Los campos `@deprecated` del caso del AI Step se
  van cuando una medición diga «0 filas con la forma de antes» (`lib/flujo-grafo.ts`).
- «Tiene una duda» no está en `ESCENARIOS_TIPICOS` (`lib/ai-step-escenarios.ts`): `lead-tuvo-reunion` y
  `cliente-empezo` salen sin él. Agregarlo es inventar texto: lo decide Martín.
- El Recurrente al grupo manda los textos de las partes pero no los binarios (`lib/disparadores.ts`
  `textosParaElGrupo`, `lib/nutricion.ts` `mandarRecurrenteAlGrupo`).
- Sin guarda para un email o un borrador que quedan vacíos por el renglón opcional (`lib/nutricion.ts`), y el HTML del
  email no recorta (`sinRenglonesVacios`).
- Una R2 no inscribe al instante (`app/api/webhooks/{calendly,calcom}/route.ts`, rama j2); un «Ir a» desde el AI Step o
  el destrabe de `requiere: 'respondio'` dejan `hilos` en null y apagan el carril de una 'respondio'; lo aplazado sale
  hasta 15 min después de la apertura (`lib/nutricion.ts`).
- La CONDITION «Próxima reunión ≤ N h» sigue laxa y el ancla del DELAY es estricta (`lib/nutricion-grafo-motor.ts`):
  igualarlas es una decisión. `u11aviso` cuelga del CRON sin esa condición: un lead sin reunión futura perdería el primer
  renglón del aviso.
- `--restaurar` del script de flujos no deshace las pre-siembras 'completada' (`scripts/undecima-flujos.mts`).
- «Pídele un cambio» no suma escenarios al AI Step (`lib/flujo-ia.ts`, `deIAEdicion`); el AI Step de Instagram y
  Messenger (`MEDIOS_OFRECIDOS`, `EditorPasoIA.tsx`); el alto del editor con 10 escenarios (`lib/lienzo-grafo.ts`); el
  lint `react-hooks/refs` en `app/_components/CampoConDatos.tsx:340-349`.
- No medido: Evolution mandando un mp3 a un @g.us, ni la plataforma hablando con «David». El ws3 no tiene grupo de MaKo:
  se crea antes de probar ahí (nunca en el ws1).
- Nada se abrió en el navegador: lo visual lo mira Martín.

_11/10/2026 — cierre de la undécima: typecheck limpio; suite entera 8190 tests: 8186 pasan, 3 fallan (de MaKo Mobile,
ya en HEAD: `confirm-encima-de-modales`, `mover-etapa-validacion`, `plan-filtro-cliente`), 1 skip. El cuarto rojo era de
la corrida (un «acá» en el `context` de `chatbot.crear-ia.system`) y lo arregló el cierre._

## Duodécima tanda (12/10/2026, claude3): Crear con IA respeta el canal y el catálogo, el chat de MaKo, Instagram

El pedido, textual, en `app/admin/dev/chatbot/bitacora.ts` (12/10, 01:50): la prueba con Fiesta Music (ws10). El diseño,
en `docs/diseno-duodecima-tanda.md`. Once paquetes en dos olas y la cosecha (corrida `wf_ec999673-272`, worktree
`C:/dev/wt-undecima`). Lo que no se ve en el diff:

**Crear con IA: lo que el modelo ve y lo que puede devolver**

- ⚠️ **El diagnóstico obvio era el equivocado: las etapas de Entrega SÍ le llegaban al modelo**, y en vivo
  (`productosConEtapas`). Lo que NO le llegaba eran las clases del CRON que se sumaron después (Instagram, Messenger,
  Email, Pagos, «se agrega / se quita etiqueta»): `armarContexto` armaba las opciones con `seccionesDisparo`. Y las
  condiciones no se filtraban por ámbito. El «Onboarding» de ws10 está en dos productos (39 y 10): faltaba una PREGUNTA,
  no opciones. Regla: el modelo ve lo que arma el desplegable (`opcionesCronIA`, con `eventosParaIA` = `eventosOfrecidos`
  sin los apagados), y una clase nueva entra sola si está en `CLASES_DISPARADOR` y `eventosDe`. **Vive en:**
  `lib/disparadores.ts`, `lib/flujo-ia-crear.ts`.
- **El canal lo perdía el CÓDIGO, no el modelo** («le dije Instagram y lo hizo por WhatsApp», #243). `nodoDe` convertía
  en WhatsApp todo lo que no fuera email, sin aviso, y `PasoIA.canal` sólo admitía esos dos. Ahora el canal del pedido lo
  decide `canalDelPedido`: gana la palabra FUERTE por el orden de `PALABRAS_CANAL`, no por la posición en el texto, y
  «historia» sola NO es Instagram («la historia de mi negocio»). `validarIA` frena WhatsApp al lead en un flujo social, un
  DM con un CRON de otro canal, un DM bajo «Si responde» y uno después de más de 24 h. Un flujo social va sin «Si responde»
  ni AI Step, porque el AI Step contesta por WhatsApp (`asistirRespuesta` sin `medio`). **Vive en:** `lib/flujo-ia.ts`.
- **#243 y #245 los escribió gemini-flash-lite, no Groq.** `pasada` llamaba a la cascada sin `sinRespaldoDeModelo`, y
  `modelosAProbar` suma los respaldos del MISMO proveedor antes de pasar al siguiente. La pasada y la reparación del JSON
  van con `sinRespaldoDeModelo: true`, y editar lleva su propio `motivo`.
- **El CRON de la IA entraba por otra puerta** (`setTriggerSecuencia`, sólo las columnas), y la lista `disparadores` de la
  0241 quedaba en NULL. Ahora entra por `guardarDisparadores(id, disparadorDeValorIA(valor))`, la de la pantalla. Las
  columnas no tienen `subtipo`: el evento vive sólo en la lista, y el 409 y editar la leen (ver «El enchufe»).
- **«Pagó» con un CRON de entrega, y unas «cuotas» que nadie pidió.** Las FILAS escritas a mano del system eran todas de
  adquisición, `filaDe` nunca llamaba a `seOfrece(def, ámbito)`, y la fila «Pagó» dibuja sola «Cuota [Cualquiera]». Ahora
  vale sólo lo que da `seccionesDeCondiciones(ámbito, catálogo)` con el catálogo del editor (`catalogosDe`, mudado a
  `lib/condiciones-catalogos.ts`). El ámbito sale de resolver el CRON PRIMERO: `entrega:` es entrega, y sin CRON vale la
  intersección. Una condición de lista se elige por NOMBRE EXACTO o se va con aviso, nunca «la más parecida». ⚠️ Un `deIA`
  sin disparador ahora saca «Agendó» o «Está en la etapa», y sin `catalogoCondicion` no se ofrece «Está en la etapa». Una
  herramienta que no está en el perfil ni en el pedido («Ya procesamos tu pago en Stripe») es un error para el reintento.
- ⚠️ **El presupuesto de Groq: el diseño medía mal.** Pedía que `entraEnGroq` siguiera en true con `ctxGrande`, y ya era
  false en HEAD (~3.793 > 3.700). Ahí manda el techo de la cascada: prompt + 3.000 ≤ 7.000. Para pagar lo nuevo se sacaron
  las filas del system, el bloque «ETAPAS» (repetía DISPARADORES) y las etiquetas ya listadas: quedan 47 tokens de aire.
  **Quien sume algo al prompt de crear lo paga** (`tests/crear-ia-tercera.test.ts`). En editar, el bloque DISPARADORES
  entero pesa ~862 tokens y deja a Groq afuera (~4.293): va sólo si el pedido habla del CRON (`RX_PIDE_CRON`; «cuando»
  suelto no alcanza). Y `bloqueDisparadores` ya no corta en 80 sin decirlo: las opciones nuevas iban al final, y eran
  justo las que se perdían.

**Editar: cambiar, quitar y volver a poner**

- **«Esa tarjeta no puede abrir otro camino a la vez»: editar sólo AGREGABA.** El system decía «NUNCA cambias ni
  borras», y «cambia WhatsApp por Instagram» colgó en paralelo una COPIA por WhatsApp (#245). Ahora el orden es quitar
  (`borrarNodo`, el del lienzo), cambiar (conserva el id), el canal POR CÓDIGO (`cambioDeCanal`) y agregar. Una copia de
  un mensaje que ya existe (misma huella) no se agrega en un cambio de canal. **Vive en:** `lib/flujo-ia.ts`
  (`deIAEdicion`).
- ⚠️ **Volver a pasar una tarjeta GUARDADA por `nodoDe` la rompe**, y era lo obvio. `aIA` recorta a 300 con «…»,
  `limpiarTexto` borra las URL (el link de agenda) y un monto que puso una persona sale como «inventado». El parche es por
  CLASE: lo que no nombra queda como estaba. Un cambio que deja la tarjeta incompleta la deja como estaba, con aviso.
- **La revisión de editar descuenta lo que ya estaba mal** en esas tarjetas (un link o un voseo de la persona): si
  frenara, el reintento no podría arreglarlo nunca. La excepción es «un mensaje al lead va por WhatsApp» en un flujo
  social. En editar, «un DM sólo con un CRON de su canal» no es un error: es la pregunta «¿Cambio qué la dispara?», y la
  respuesta se guarda por `action:'disparadores'`, fuera del borrador.

**Las preguntas y el chat de MaKo**

- **MaKo pregunta SÓLO canal, evento o producto** (`preguntaAntes`, `lib/flujo-ia-preguntas.ts`), y la respuesta la
  impone el CÓDIGO (`aplicarRespuestas`), nunca el modelo. WhatsApp cuenta siempre como conectado. El producto filtra los
  kanbans de los otros productos: así `entregaNombrada` encuentra un solo «Onboarding» (el test lo ejecuta con el ws10
  medido). El CRON forzado entra ANTES de `deIA`: pisarlo al final no alcanza, porque el ámbito de las condiciones y el
  canal de los DM ya se resolvieron con el del modelo.
- ⚠️ **`cambiarSettingSi` con un valor largo no llega a la base** (medido). Compara con `.eq('value', esperado)` y
  PostgREST pone ese filtro en la URL: con 6 KB da 200, con 8 a 12 KB «fetch failed», con 16 a 32 KB 400 y con 64 KB 414.
  El chat habría dejado de guardarse desde ~30 mensajes, sin un error. «Es el compare-and-set de la casa» vale para
  valores CORTOS: el chat compara `updated_at` ([hallazgos-infra.md](hallazgos-infra.md)). **Vive en:** `lib/settings.ts`,
  `lib/automatizacion-chat-db.ts`.
- **Cada turno re-POSTea el pedido ORIGINAL con las respuestas acumuladas.** La ronda abierta se reconstruye del chat
  guardado (`rondaAbierta`, `lib/flujo-ia-cliente.ts`), y un mensaje de MaKo sin pregunta, o una pregunta con `cambios`,
  la CIERRA. Editar manda el historial de ANTES del turno: `respuestaDelCron` («Elige tú» = la primera opción) y
  `turnoDelUsuario` lo leen del body, no del chat guardado. Con el turno al final, el turno no se guardaba.
- **El chat de editar se cerraba por código** (`alListoIA` terminaba con `setEditandoIA(false)`): el resumen, los avisos
  y la pregunta del CRON no se veían nunca. Y `escribirSec` borra `mako=1`, o se pegaba a la automatización siguiente.

**Instagram y Messenger**

- **Dos verdades de «Instagram conectado».** El CRON medía la PÁGINA de Facebook (Graph); la tarjeta, Probar y Publicar
  miden Zernio, que es por donde llegan los eventos. Queda una, `estadoMedios` (`lib/disparadores-canales.ts`), y el CRON
  abre el mismo `ConectarMedio`. Los ws 1, 9 y 15 (página sin Zernio) ven «Sin conectar», que es lo cierto. ⚠️
  `estadoMedios` traga el `ZernioError` y da `conectado: null`. Con Zernio, ese «no pude» es casi siempre una key mala o
  una cuenta pausada: por eso el CRON ofrece «Conectar» también con null.
- **El 402 de Zernio se perdía en el `catch` de la RUTA** (`app/api/zernio/route.ts`). El encargo citaba la línea 256 de
  una ruta de 60 líneas: era `asegurarWebhook`, en `lib/zernio.ts`. Ahora un 401 da `motivo:'key'` y un 402 da `pausada`
  con `billingUrl`. Pero un 401 o un 402 con la key de la PLATAFORMA es de MaKo: ese link de pago no se le muestra a un
  cliente (`usaCuentaPropia`), y un link de un tercero que va a un `href` se valida https.
- **El webhook de Zernio sólo se registraba al abrir el modal** (el POST `estado`): ws10, 11 y 13 tenían
  `webhook_ok=false` y 0 eventos. Ahora lo aseguran Publicar y Activar (`asegurarAvisosSociales`, 8 s), sólo con
  Instagram o Messenger usados y conectados, y una falla no frena. Ojo: `validarActivacion` corre también cuando MaKo
  PROPONE activar.
- **Publicar y Activar no miraban el CRON:** un CRON de Instagram con tarjetas de WhatsApp se activaba sin Instagram.
  `mediosQueUsa` y `usosDeMedios` reciben los `disparadores` guardados en la fila, porque el CRON no viaja en el body.
- **«Te sigue» sólo se sabe de quien ya ESCRIBIÓ por DM** (regla de Meta). Un 200 de Zernio no es «sé»: trae
  `isFollower: null` y un `unavailableReason`, y `error` es una falla de Meta DENTRO de un 200. Los 400, 403, 404, 410 y
  422 son «no sé» y no tiran: si tiraran, la inscripción se trabaría para siempre. Tiran la red, el timeout, 408, 409,
  425, 429 y 5xx. «Se le puede escribir» y el envío eligen la conversación con la MISMA función pura
  (`conversacionQueCuenta`, `lib/canal-social.ts`). **Vive en:** `lib/canal-zernio.ts`, `lib/zernio.ts`.
- **Un guard que barre literales no ve las variables:** el `createLead({ origen_lead: e.canal })` de Zernio dejaba a esos
  leads «Sin origen», y `tests/crm-origen-lead.test.ts` no lo veía. La ficha (`app/crm/lead-view/OrigenCard.tsx`) no
  tenía su renglón hasta la cosecha.
- **El filtro de canales de la lista:** `expandirPasoIA(pasos)` expande sólo los AI Step de WhatsApp. Quien cuente lo
  que manda un AI Step le pasa SU medio, y las opciones salen de `MEDIOS` (`lib/chatbot-lista-filtro.ts`).

**La pantalla**

- **El ✦ «no hace nada» con una tarjeta abierta:** el clic alternaba `editandoIA` con la barra en `display: none`.
  `abrirMako()` cierra la tarjeta con `foco` en `id: null` (no hace falta otra prop) y abre el chat. Y «está más grande
  que el de al lado» era falso al medir (44 y 44): pesaba el bloque negro junto a tarjetas claras. Ahora usa la cara de
  `tarjetaChrome`.
- **El aviso de Probar existía y no se veía**, y lo obvio era «falta el aviso». El primer POST tarda ~14 s, el toast dura
  3,2 s, el gate de la prueba lo mataba al tocar ↻ o cerrar, y vivía dentro de la capa de Probar:
  [hallazgos-ui.md](hallazgos-ui.md) → «un fixed atrapado». Un aviso de algo que YA pasó no se ata a la vida del panel que
  lo pidió.
- **El QR salta solo al crear una tarjeta que lo necesita** (`medioAConectarAlCrear`, `lib/medios-automatizacion.ts`),
  colgado de `chipDeTarjeta().frena` y nunca de «no está conectado», que incluye el «no sé». ⚠️ `useEstadoMedios`
  devuelve `undefined` MIENTRAS lee, y la primera tarjeta de WhatsApp cambia la consulta: el efecto espera
  `medios !== undefined`, porque el handler del ＋ todavía no lo sabe.
- **Sin la puerta del QR, la tab abre más rápido:** el spinner esperaba tres GET en fila, y ahora sólo la lista.

**El enchufe (lo que ningún paquete conectaba)**

- **Editar no sabía qué CRON tenía la automatización:** la ruta no ponía `ctx.disparadorActual`, así que «cambia WhatsApp
  por Instagram» preguntaba «¿Cambio qué la dispara?» aunque ya fuera de Instagram, y las condiciones valían con
  cualquier ámbito. ⚠️ El arreglo obvio (armarlo desde las columnas con `valorDisparo`) era el equivocado: da
  `trigger:instagram`, que no es ninguna opción del CRON de la IA (`instagram:dm`), y `userDeEditar` no encuentra el
  CRON ACTUAL. El evento vive sólo en la LISTA (mig 0241). Ahora: `disparadoresDeSecuencia` (la lectura de Publicar) y
  `valorIADeDisparador` (`lib/disparadores.ts`), el inverso EJECUTADO de `disparadorDeValorIA`. Lo usa también el 409
  de crear. **Regla:** el valor que la IA ve y el que se lee de un CRON guardado salen de las dos funciones de ida y
  vuelta, nunca de las columnas.
- **Publicar escribía `aviso` y la pantalla no lo leía** («Los avisos de Instagram no se activaron»): ahora va después
  de «Publicado ✓» (`SecuenciaPerfil.tsx`, `publicar`).
- **Las etapas de «Está en la etapa» tenían dos armados:** el lienzo (`etapasCond`) y lo que ve la IA
  (`etapasDeCondicion`). El lienzo usa ahora la función, y el test la ejecuta.
- La tarjeta CRON se siembra con `disparadorDeValorIA` (`sembrarPrimero` recibe el `Disparador` entero). Hoy esa rama
  de `alListoIA` no se alcanza (crear vive en la galería, que recarga la lista), pero ya no miente si vuelve.

**Herramientas**

- Probar rompiendo se hace en un ESPEJO (copia de `lib/`, `app/` y `tests/` con `node_modules` enlazado), y así las
  otras sesiones del worktree nunca ven un archivo roto. Un arnés que busca texto con `\n` en un archivo CRLF dice «no
  encontré».
- `typecheck-lock.mjs` «corre igual» después de 5 minutos sin RAM: con siete paquetes en paralelo, eso es la caída del
  11/10.
- `ResultadoEdicion` (`Omit<…> & { disparador?: … }`) ya no cumple `R extends ResultadoIA`: `generar` y `pasada` pasaron
  a `<R extends { avisos: string[] }>`.
- **Un guard que se queda vacío no falla:** `indexOf('await setTriggerSecuencia(')` daba -1 y `ok > -1` pasaba siempre
  (`tests/flujo-ia-arreglos.test.ts`). Al renombrar una puerta, se grepean los tests que la buscan por nombre.

**SIN HACER (con su archivo):**
- `app/automations/SecuenciaPerfil.tsx`: lo que crea la IA (`alListoIA`) no hace saltar el QR.
- `lib/disparadores-guardar.ts`: cambiar el CRON de una automatización YA ACTIVA no pasa por el freno del medio, y la API
  de MaKo y la IA no tienen otro.
- `lib/disparadores-canales.ts` (`estadoMedios`): un 401 o un 402 de la key propia queda «Sin comprobar» y no frena. Y
  `EstadoCanal` (`lib/disparadores.ts`) no trae un código: con «sin Zernio», el primer clic abre y cierra la ventana
  emergente antes de mostrar el campo de la key.
- `app/automations/ConectarMedio.tsx` (`guardarKeyZernio`) guarda la key sin verificarla: el `verificar` de Zernio dice
  «respondió 402» de una cuenta pausada.
- `lib/flujo-ia.ts`:
  - un pedido explícito del CRON en un negocio grande deja a Groq afuera (`userDeEditar`);
  - `cambioDeCanal` es una heurística (`RX_CAMBIO_CANAL`);
  - no se puede sacar una rama, ni cambiar los casos de un «Si responde» o los escenarios de un AI Step;
  - «Avance del curso» se saca (`filaDelCatalogo`).
- `lib/flujo-ia-preguntas.ts`: «mándale un DM» no pregunta el evento (a propósito), y dos embudos con producto que
  comparten «Nuevo» preguntan el producto.
- `app/automations/ChatMako.tsx` y `SimuladorWhatsApp.tsx` (`makoPara`):
  - el mensaje de MaKo del `listo` no comparte id con el guardado;
  - una automatización en blanco no tiene chat;
  - `?sec=X&mako=1` dos veces sobre la misma no lo reabre.
- `app/automations/ChatAgentApp.tsx` (`vioVacio`): la reapertura del recorrido puede pisarse con el chat que se abre al
  crear. Y el aviso de Probar sigue en 3,2 s (`app/_ui/Toast.tsx`).
- `lib/canal-zernio.ts`: «Te sigue» se consulta en vivo, una llamada por lead (de a 4, con 8 s de tope). Con cientos de
  leads parados, la alternativa es la mig 0258 (decisión 5). No se midió en prod: no hay ningún DM real.
- Antes del push: medir `ZERNIO_API_KEY` y `ZERNIO_WEBHOOK_SECRET` en Vercel prod. Lo visual lo mira Martín.

_12/10/2026 — cierre de la duodécima: typecheck sin errores de la tanda (quedan 2 de `lib/editor-landing`: `html-to-image` y `pptxgenjs` están en package.json pero no en el `node_modules` enlazado del clon). Suite entera, 8413 tests: 8409 pasan, 3 fallan y 1 se salta. Los 3 son los de antes, ya en HEAD y de otras áreas (`confirm-encima-de-modales`, `mover-etapa-validacion`, `plan-filtro-cliente`). La primera corrida dio 7 rojos: 3 eran cruces entre paquetes de la tanda (la ficha del origen, la puerta del CRON en `cron-varias-etapas` y el ＋ en `nutricion-paso-accion`) y 1 venía de `dbe5d1ec` (la quinta familia de la barra no llegó a `lib/plan-proyectos-catalogo.ts`). Los 4 quedaron arreglados._

_12/10/2026 — enchufe del cierre (el CRON que se edita, el 409, el aviso de Publicar, la siembra del CRON, las etapas de la condición): typecheck con los mismos 2 de entorno; suite entera 8418 tests, 8413 pasan, 4 fallan y 1 se salta. Los 3 de antes más `ads-video-procesando` (un tiempo bajo carga: solo da 10 / 0). Roturas en un espejo: 9 de 9 cazadas (`tests/automations-duodecima-enchufes.test.ts`, al pie)._

_12/10/2026 — cierre final de la duodécima: typecheck entero en 0 errores (los 2 de `lib/editor-landing` se fueron: otra sesión instaló `html-to-image` y `pptxgenjs` en el `node_modules` compartido). Suite entera, 8418 tests: 8414 pasan, 3 fallan y 1 se salta. Los 3 son de HEAD y de otras áreas, y la tanda no toca ningún archivo que lean: `confirm-encima-de-modales` (ya arreglado en origin/main, `DesvioMovil.tsx`), `mover-etapa-validacion` y `plan-filtro-cliente` (los dos siguen rojos en origin/main `2a9b0777`: ni el test ni lo que leen cambiaron). `ads-video-procesando` pasó: lo del enchufe era carga._

## Decimotercera tanda (12/10/2026, claude3): la barra de MaKo, crear y llevarte al lienzo, Probar sin conexión, el chat de WhatsApp

El pedido, textual (8 puntos con capturas de hola-mako.com/automations), en el último hito de
`app/admin/dev/chatbot/bitacora.ts` (12/10, 10:30). Un agente solo, sin multi-agente, en el worktree `C:/dev/wt-undecima`.
Lo que no se ve en el diff:

- ⚠️ **«No se ve el placeholder, tiene scroll y no aparece más la animación»: el diagnóstico obvio (se borró la animación)
  era el equivocado.** `useEjemploQueSeEscribe` seguía andando; lo roto era el ALTO del campo. La pila de modales pinta un
  `Modal` con `display: none` en su PRIMER render (`decidirVisible` da false hasta que un efecto lo mete en la pila), y el
  efecto del hijo corre antes que el del padre: medía `scrollHeight = 0`, ponía `height: 0px` y no volvía a medir hasta que
  cambiara el texto. Quedaba el relleno, con el ejemplo escribiéndose fuera de la vista y la barra de scroll. Además,
  `height = scrollHeight` con `box-sizing: border-box` y 2 px de borde desborda SIEMPRE 2 px. Estaba roto desde la décima
  (la caja de la galería tenía el mismo efecto). **Regla:** la barra es `ComposerWhatsApp`, que mide con el borde y tiene
  `minHeight`. La trampa general, en [hallazgos-ui.md](hallazgos-ui.md). **Vive en:** `app/_components/pila-modales.ts`,
  `app/whatsapp/_shared/ComposerWhatsApp.tsx`, `app/automations/ChatMako.tsx` (`BarraPideselo`).
- **«Al enviar no ocurre nada»: MaKo trabajaba ADENTRO del modal** y la fila nacía al guardar (para la persona, un minuto
  sin nada). Ahora el modal se cierra al enviar y la fila nace YA por la puerta de «Nueva» (`crearNueva(pedido)`, la de
  «Lienzo en blanco»): la fila «creándose» en la lista, su lienzo, y el chat de MaKo abierto con el pedido puesto, que el
  chat manda como CREAR sobre esa fila (la ruta ya lo aceptaba: vacía y pausada). Las preguntas de MaKo salen en el chat de
  la fila, no en el modal. **Decisión:** si MaKo falla, la fila queda vacía y pausada, con el error en su chat y el pedido
  de vuelta en la barra: no es una fantasma, es una automatización a la que se le puede volver a pedir. Si falla crear la
  fila, el error va pegado a «＋ Nueva» y el pedido vuelve a la barra de la galería (`pedidoSinCrear`). **Vive en:**
  `ChatAgentApp.tsx` (`crearNueva`, `pedirAMako`), `SimuladorWhatsApp.tsx` (`AbrirSecuencia.pedido`), `SecuenciaPerfil.tsx`
  (`pedidoAlAbrir`, la capa), `ChatMako.tsx` (`pedidoInicial`).
- ⚠️ **Un pedido que sale al MONTAR se corta en desarrollo:** React monta, desmonta y vuelve a montar los efectos, y el
  desmonte de `useStreamIA` aborta el pedido en vuelo. El primer turno sale en un `setTimeout(0)` que limpia el cleanup,
  con una guarda por pedido. **Regla:** si otro efecto del mismo componente aborta al desmontar, un fetch de montaje no sale
  en el cuerpo del efecto.
- **La capa ya no es un portal sobre toda la pantalla.** La pone SecuenciaPerfil, de la lista para la derecha (la fila
  recién creada se sigue viendo), y POR ENCIMA de «Publicar»: z 58 > `Z_ACCION_LIENZO` (57). El Lienzo no crea un contexto
  de apilamiento, así que compiten en el mismo. El chat sube a 59 mientras MaKo trabaja; los dos, debajo de 60 (AGENTS.md).
- **«Sin Zernio», y Probar dejaba probar.** Probar miraba sólo la FORMA (`frenoDelFlujo`), nunca los medios; Publicar sí, en
  el server. Ahora `medioQueFrena` (lib/medios-automatizacion.ts) es la cuenta de Publicar y Activar (`medioSinConectar` la
  usa) Y la de Probar, con la línea de la tarjeta que frena (para abrir SU QR). Probar dice «Conecta tu Instagram» y abre el
  modal de ese medio. «No pude comprobarlo» no frena.
- **El modal de Zernio es EL de Integraciones:** `ServicioModal`, exportado de IntegracionesBoard.tsx y montado a demanda por
  `app/integraciones/ServicioSuelto.tsx`. La `Integracion` la arma el server con la MISMA cuenta que la grilla
  (`getIntegracion` → `integracionDeDef`, por la server action `integracionAction`). Se fueron el campo propio de la key y
  `guardarKeyZernio`. Al cerrar Integraciones se vuelve a mirar Zernio: si sirve, sigue el OAuth; si se guardó una key que
  no sirve, se dice y queda «Abrir Zernio». ⚠️ `getIntegracion` NO filtra por la capa (la capa decide qué se LISTA): una
  automatización que necesita Zernio lo necesita aunque la tarjeta no esté en la grilla. Sí respeta `soloPlataforma`.
- **El chat ES el hilo de WhatsApp** (`ChatHilo` + `BurbujaHilo` + `ComposerWhatsApp`), no una copia. Lo que le faltaba al
  hilo para servirle a MaKo entró como props OPCIONALES, y nadie más cambia:
  - `onEnviarAudio`: el micrófono sin el clip (MaKo no recibe archivos). La nota se transcribe con `transcribirNota` y viaja
    como texto.
  - `acentoEnviar` y `fondoHilo`: los colores de MaKo.
  - `ponerBorrador`: devolver a la barra un pedido que no nació en ella.
  - `onEnviarTexto` puede devolver `{ error }`: no salió, y lo escrito vuelve.

  La pregunta va como los botones de respuesta de WhatsApp, debajo de la burbuja.
- **El historial del ✦ (punto 7):** la ruta del ✦ (`/api/chat-agent/redactar`) anota en el chat de MaKo de la automatización
  el pedido y lo propuesto (o el error), con `tarjeta`: el nombre de `nombreDeTarjeta`, el mismo de los errores de
  Publicar. ⚠️ El id llega del navegador: se escribe sólo si la automatización es del workspace (`secuenciaDelWorkspace`,
  lib/automatizacion-chat-db.ts). Es lo único que esa ruta escribe; el guard «la ruta no paga ni escribe»
  (`tests/whatsapp-sexta-tanda.test.ts`) lo admite explícito. El chat abierto lo suma sin releer (`chat-mako-eventos.ts`).
- **El ✦ en el email y en los DM (punto 8)**, con `canal` en lib/mako-redacta.ts:
  - el email pide asunto y cuerpo, con su JSON propio;
  - un DM, uno o dos mensajes cortos (≤ `TOPE_TEXTO_SOCIAL`);
  - la nota de voz es SÓLO de WhatsApp (Instagram rechaza el OGG/Opus).

  ⚠️ `String.replace` con un texto como patrón reemplaza SÓLO la primera vez: el system de los DM tiene `{{red}}` dos veces y
  le llegaba al modelo «DM de {{red}}». Lo encontró el test nuevo en su primera corrida. **Regla:** para llenar un hueco que
  puede repetirse, `split().join()` (o `replaceAll`).
- **El ✦ del título también con el lienzo vacío:** ahí MaKo crea. La caja grande del lienzo vacío sigue afuera (la sacó la
  décima): el ✦ es un botón chico.

**SIN HACER (con su archivo):**
- ~~`app/automations/ChatMako.tsx`: el 409 de crear sobre lo publicado~~ y ~~los rearranques de Probar sin los medios~~:
  HECHOS el 13/10/2026 (`6e53ff79`, ver «Los pendientes de la decimotercera, cerrados» más abajo).
- `app/automations/EditorPasoIA.tsx` y `app/landing-generator/CajaCrear.tsx`: el ejemplo que se escribe solo usa el mismo
  placeholder. Si alguno mide su alto en el primer efecto adentro de un Modal, tiene la trampa de arriba: no se midió.
- Lo visual (el chat como WhatsApp, la capa, el modal de Zernio) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimotercera: typecheck en 0 errores. Tests de las áreas tocadas: 1093 / 1093 (84 archivos). Suite entera, 9043 tests: la primera corrida dio 4 rojos; 1 era un guard de la forma del lienzo (`flujo-lienzo-paralelos`, la rama del email ahora abre un bloque), ya arreglado. Los otros 3 son de HEAD y de otras áreas, y ninguno lee un archivo de la tanda: `mover-etapa-validacion`, `plan-filtro-cliente` y `plan-proyectos-catalogo` (la barra de `nav.ts`). Roturas: 16 de 16 cazadas (`tests/automations-decimotercera.test.ts`, al pie)._

## Decimocuarta tanda (12/10/2026)

El pedido (Martín, 12/10, con dos capturas: la caja «¿Qué vas a crear hoy?» del Landing Generator y la tarjeta INSTAGRAM
del lienzo): sacar «Nace pausada»; la caja «Pídeselo a MaKo» igual a la del Landing Generator; el chat de MaKo al costado;
sin el chip «Conecta tu Instagram» junto a «Activar»; varias cuentas de Instagram con el desplegable de WhatsApp («Conectar
otra» adentro, sin «Conectar», sin «Sin Zernio» ni el logo de la derecha) y el ✦ al lado. Un agente solo, en
`C:/dev/wt-undecima`.

- **La caja de MaKo ES la del Landing Generator, no una copia.** Salió de `CajaCrear.tsx` a
  `app/landing-generator/CajaPedido.tsx` y la montan las dos puertas (`BarraPideselo`, ChatMako.tsx). ⚠️ Importar
  MiniaturaLanding desde /automations arrastra el render de la landing entera: `Ico` salió a `Ico.tsx`. ⚠️ Sus tokens
  `--gp-*` caen a valores CLAROS fuera de `.gma` (un `var()` inexistente no falla, toma el respaldo): en oscuro la caja
  salía blanca. Afuera va envuelta en `.gp.cp-casa` con `CSS_TOKENS_CASA` (los de la casa). **Regla:** reusar una pieza
  de Gamma fuera del editor = sus tokens desde los de la casa, nunca `CSS_GP` suelto.
- **Sin el chip «Plan | Express»:** acá no hay un modo que elegir (MaKo pregunta en el chat de la fila). El «+» ofrece lo
  que ya tiene el modal (`accionesMas`): «Lienzo en blanco», «Usar plantilla» (enfoca el buscador) y «Pegar lo copiado».
- **Medir escondido:** la caja nueva no fija `height: 0px` si `scrollHeight` da 0 (el modal se pinta con
  `display: none` en su primer render: la trampa de la decimotercera). Cierra ese «sin hacer» para `CajaCrear`.
- **El chat al costado comparte el muelle de «Probar»** (`chatAlCostado`, lib/crear-ia-lugar.ts). Los muelles los
  calcula la tab (SimuladorWhatsApp) y el estado del chat vive en SecuenciaPerfil: `onChatMako` sube «abierto» y la tab
  reserva la derecha con `probarAbierto || makoVisible`. Con «Probar» abierto el chat se ESCONDE sin desmontarse (un
  pedido en vuelo sigue) y el ✦ cierra «Probar» y lo muestra. Ya no se esconde con una tarjeta abierta: el editor se corta
  antes del muelle.
- **El chip «Conecta tu Instagram» era `err`:** el texto del freno quedaba en la píldora roja de «Activar» después de
  cerrar el modal. Probar, Publicar (409) y Activar ahora sólo abren el modal del medio.
- ⚠️ **Varias cuentas: el diagnóstico obvio («Zernio no deja») era el equivocado.** Zernio lista varias por profile
  (`GET /accounts?profileId&platform`) y `connect/{plataforma}` suma otra. Lo que impedía «Conectar otra» era el sondeo
  de `ConectarSocial`: daba conectado con «hay alguna cuenta», y con una ya conectada cerraba en el PRIMER sondeo, antes de
  terminar en la ventana. Ahora espera una cuenta que antes no estaba (`cuentaNueva`) y la deja elegida en la tarjeta.
- **El paso guarda SU cuenta** (`cuenta_zernio`, el `accountId`; `cuentaDelPaso` / `cuentaAlGuardar`, lib/canal-social.ts,
  como `linea`). El motor manda SÓLO por ella (`conversacionDelPaso`): sin conversación con esa cuenta, falla terminal y
  no cae a otra. Caer tampoco serviría: la ventana de 24 h de Meta es por conversación, y la conversación es de UNA cuenta.
  Sin cuenta elegida, lo de siempre; con varias, el desplegable lo dice: «Donde escribió el lead».

**SIN HACER (con su archivo):**
- `lib/medios-automatizacion.ts`: el chip «Sin conectar», Probar y Publicar miran «hay alguna cuenta», no la ELEGIDA. Una
  tarjeta con una cuenta desconectada recién falla al enviar.
- `lib/canal-social.ts` (`conversacionesPorLead`): las condiciones de Instagram («Se le puede escribir…») miran la
  conversación de cualquier cuenta, no la de la tarjeta que sigue.
- `app/automations/PanelProbar.tsx` / `SimuladorSocial.tsx`: Probar un DM no muestra por qué cuenta saldría.
- `app/automations/SecuenciaPerfil.tsx`: con la ventana angosta (editor de columna) no se midió el chat junto al editor.
- Lo visual (la caja, el chat al costado, la cabecera de Instagram) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimocuarta: typecheck en 0 errores. Áreas tocadas: 1044 / 1044 (82 archivos). Suite entera, 9066 tests: 3 rojos de la tanda (guards de la forma vieja en `medios-automatizacion` y `plantillas-automatizaciones`), ya arreglados. Quedan 3 rojos de HEAD, los mismos de la decimotercera y de otras áreas: `mover-etapa-validacion`, `plan-filtro-cliente` y `plan-proyectos-catalogo`. Roturas: 10 de 10 cazadas (`tests/automations-decimocuarta.test.ts`, al pie)._

## Decimoquinta tanda (12/10/2026)

El pedido (Martín, 12/10, 13:20; textual en la bitácora): el título «¿Qué vas a crear hoy?» en la caja; el lápiz y el tacho
pegados a la burbuja en el editor de Instagram; el logo de MaKo (no la estrella chica) en los editores; que el modal de
conectar no salte mientras se edita; sin «Publicar», «Acomodar» ni «Centrar» en el click derecho; que el ejemplo de la caja
vuelva si se sale sin escribir; el «+» de la caja para subir un archivo o una imagen y pegar un flujo; y «Copiar flujo» como
un TOKEN que al pegarse dice «Flujo copiado: <nombre>». Un agente solo, en `C:/dev/wt-undecima`.

- **El título era de la página, no de la caja.** Vivía en `CajaCrear.tsx` (un `<h1>` suelto), así que el modal de
  Automations recibió la caja sin él. Ahora es `titulo` de `CajaPedido` (`TITULO_CAJA`; h1 en la landing, h2 en el modal)
  y su hoja va en `CSS_CAJA_PEDIDO`; afuera de la landing toma `--gp-titulo` de `CSS_TOKENS_CASA`. **Regla:** lo que se ve
  en «la imagen» de una pieza compartida vive EN la pieza, no en una de las puertas.
- ⚠️ **El hueco entre los botones y la burbuja de Instagram: el diagnóstico obvio («el `gap` de la fila») era el
  equivocado.** `BurbujaSocial` lleva `max-width: 78%` y su caja se ajusta a la burbuja: el 78% se resuelve contra ESA
  caja y la burbuja se encoge, dejando el hueco adentro de la caja, entre los botones y el mensaje. Es la trampa que el
  WhatsApp ya había resuelto en la sexta (`BurbujaHilo` `maxAncho`), pero el editor social tiene su propia burbuja y no la
  heredó. Ahora `BurbujaSocial`/`ArchivoSocial` aceptan `maxAncho` y el editor pasa `100%`, con la caja de la fila de
  WhatsApp (`flex: 0 1 auto`, `calc(100% - 70px)`). **Regla:** una burbuja en una fila con botones va al 100%; el tope lo
  pone la fila.
- **«La estrella que no es el logo» era `BotonMako`:** dibujaba `MakoStar` (la chispa al 45% del lado y el punto chico
  arriba: «una segunda estrella arriba»), y la cabecera usaba `MakoLogo`. Ahora `BotonMako` ES `MakoLogo` (la chispa sola),
  así que cambian también los botones de MaKo del Dashboard (`NuevaHoja`, `PanelAnalista`): es la regla de la décima («el
  logo de MaKo, que es una estrella en el centro, sin la estrella chiquita arriba»). **Regla:** un botón de MaKo es el
  logo; `MakoStar` queda para marcas chicas en texto.
- **Conectar sólo cuando se pide.** Se fue lo de la duodécima §2.12 (`pedirConectar` en FlujoLienzo y
  `medioAConectarAlCrear` / `MEDIOS_QUE_SALTAN` en lib/medios-automatizacion.ts): Martín dio vuelta su propio pedido («que
  salte el QR»). El modal lo abren el chip «Sin conectar», Publicar, Probar, Activar y «Conectar otra». **Regla:** nada se
  abre solo mientras se edita un flujo.
- **El click derecho:** «Centrar» lo sumaba `Lienzo.tsx` a TODO fondo (también al lienzo de la agencia) y «Publicar» /
  «Acomodar» los sumaba FlujoLienzo. Se fueron los tres; Centrar sigue en el zoom (⤢) y Acomodar al lado del deshacer.
- ⚠️ **El ejemplo que no volvía no era el hook.** `useEjemploQueSeEscribe` ya pausaba y retomaba; el «para siempre» era el
  `tocada` de CADA puerta (la caja de Automations y la de la landing), una decisión de la tercera tanda («al darle click
  debe parar la animación completamente»). Ahora lo decide la caja (`seMueveElEjemplo(animar, foco, valor)`): se mueve sin
  el foco de la caja y vacía; el foco es el del `<form>` (con `relatedTarget`: el micrófono y el «+» también cuentan).
- **El «+» con archivo:** POST `/api/chat-agent/secuencias/archivo` (multipart, sólo admin) lee con `archivoATexto` (una
  imagen o un PDF escaneado, por visión; el gasto a `chatbot-crear-ia`). ⚠️ La ruta de MaKo corta el pedido a 2000 en
  silencio (`body.pedido.trim().slice(0, 2000)`): pegar el archivo DESPUÉS de lo escrito lo perdía. `pedidoConArchivo`
  pone lo escrito primero y recorta el archivo a la vista («…»). ⚠️ ChatMako.tsx y CrearConIA.tsx no pueden tener un
  `method: 'POST'` (el test del único lector del stream): la subida vive en `archivo-pedido-cliente.ts`.
- **El token** (`MAKO-FLUJO-` + 10 de Crockford, `tokenDeBytes` / `tokenDeTexto`, lib/flujo-copia.ts): la tabla
  `flujo_copias` (mig 0265) tiene `workspace_origen`, NO `workspace_id`: con `workspace_id` iría a `TENANT_TABLES`,
  `getTenantDb` la acotaría y el token no se leería desde otro negocio, que es para lo que existe. Sin la tabla, supabase-js
  contesta `PGRST205` (medido en prod, sólo lectura, antes de aplicarla): la ruta da 503 con `falta` y el botón copia el
  texto entero de antes. Pegar un token (la caja, «Pegar un flujo», el aviso al entrar, la galería, Ctrl+V en un lienzo)
  pasa por `resolverCopia`, y lo guardado vuelve a pasar por `leerCopia`. ⚠️ Safari pierde el permiso del clic si se
  espera un `fetch` antes de `writeText`: el token va con `ClipboardItem` y una promesa (`copiarAlPortapapeles`).

**SIN HACER (con su archivo):**
- `supabase/migrations/0265_flujo_copias.sql`: escrita, NO aplicada (la aplica la sesión principal antes del deploy).
- `lib/flujo-copia-negocio.ts`: los tokens no vencen ni se pueden revocar (no hay pantalla para listar o borrar copias).
- `app/automations/ChatMako.tsx` (`hiloDeChat`): un pedido con archivo se ve entero en el chat de MaKo (hasta 2000
  caracteres), sin resumirlo a «📎 archivo».
- `app/automations/ChatMako.tsx` (`BarraPideselo`): soltar o pegar una imagen en la caja no la sube (sólo el «+»).
- `app/automations/FlujoLienzo.tsx`: copiar TARJETAS (Ctrl+C) sigue copiando el texto entero, no un token.
- `app/agencia/FlujoAviso.tsx`: el click derecho del lienzo de la agencia conserva su «Acomodar» (no se pidió).
- Lo visual (el título en el modal, los chips, el logo en los editores) no se miró en el navegador: lo mira Martín.

_12/10/2026 — cierre de la decimoquinta: typecheck en 0 errores. Áreas tocadas: 1640 / 1640 (119 archivos). Roturas: 10 de 10 cazadas (`tests/automations-decimoquinta.test.ts`, al pie)._

## Los pendientes de la decimotercera, cerrados, y los plazos de etapa como plantilla (13/10/2026)

Cuenta `claude2`, worktree `C:/dev/wt-undecima`, commits `ae462b56` y `6e53ff79` (sin push al escribir esto).

### El 409 de «crear» no era del server: el chat decidía con la mitad del dato [chat de MaKo]

Síntoma: con el borrador vaciado a mano y tarjetas publicadas, pedirle algo a MaKo contestaba «ya tiene tarjetas: pídele un
cambio». El diagnóstico obvio era el server (el 409 sale de la ruta). La ruta tenía razón: crear ESCRIBE encima y no pisa un
flujo publicado (puede tener leads adentro). Lo que estaba mal era la pregunta del cliente: `crea = pasos.length === 0`
miraba sólo el BORRADOR. Con algo publicado, edita sobre el borrador vacío (`publicadas`, lo pasa SecuenciaPerfil).
**Regla:** una decisión que cambia QUÉ escribe el server (crear vs editar) se toma con lo que el server va a mirar, no con la
copia local.

**Vive en:** `app/automations/ChatMako.tsx` · `app/automations/SecuenciaPerfil.tsx` · `app/api/chat-agent/secuencias/ia/route.ts`

### Un freno que viaja a otro componente tiene que ser el MISMO que el del botón [probar]

El botón «Probar» frenaba por la forma Y por un medio sin conectar; lo que viajaba al panel (`EdicionLocal.freno`) era sólo
la forma, así que los rearranques (↻, «Cambió · ↻», «Probar en WhatsApp») corrían con un medio desconectado. Ahora viaja
`FrenoDeProbar` (forma o medio, con la cuenta de Publicar: `medioQueFrena`) y frenar abre el modal del medio. La lectura de
los medios tuvo que SUBIR antes del efecto que manda la edición local: un `useMemo` declarado después no lo podía usar.

**Vive en:** `app/automations/SecuenciaPerfil.tsx` (`frenoProbar`, `frenarDesdeProbar`) · `app/automations/PanelProbar.tsx`

### Una condición que depende de la AUTOMATIZACIÓN no se guarda en la fila: la pone quien evalúa [condiciones]

Los plazos de etapa del CRM pasaron a la plantilla «Un Lead No Avanzó» (espera → «Sigue en la etapa del CRON» → aviso). La
salida obvia era copiar la etapa elegida en la condición al crear la plantilla; queda VIEJA el día que alguien cambia el
CRON. La condición no guarda la etapa: `HechosLead.etapasDelCron` lo pone quien evalúa (`conEtapasDelCron`,
lib/disparadores.ts) — el motor por automatización en los dos lugares donde decide, y «Probar» con el lead de prueba, que
entra EN la etapa del CRON. Sin un CRON de etapa es «no sé». Medido el 13/10: ningún embudo tiene plazos guardados
(`funnels.data.umbrales.porEtapa`), así que no hubo nada que migrar; el aviso viejo (`lib/lead-quieto-aviso.ts`) y la op
`plazo` del CRM quedan sin datos (retirarlos es del chat CRM).

**Vive en:** `lib/condiciones-catalogo.ts` (`sigueEnEtapaDelCron`) · `lib/disparadores.ts` · `lib/nutricion.ts` · `lib/simulador-grafo.ts` · `lib/plantillas-automatizaciones.ts`

### El entorno del 13/10: `tsc` y las suites largas mueren sin decir nada

`tsc --noEmit` sale con código 1 y CERO bytes de salida (ni con `--extendedDiagnostics`), y `npm test` corta sin el resumen:
el vigía de RAM (`~/.claude/guardia/vigia.ps1`) los mata con poca memoria libre (2,8 GB medidos). Un «exit 1» sin texto NO es
un error de tipos. Los tests se corrieron en tandas de 10-12 archivos (1153 del área en verde). El typecheck queda para antes
del push, cuando «Fallas en la PC» lo destrabe.

### «No salió el mensaje»: una fecha SIN hora contaba como pasada desde el mediodía [motor · bug 5 del 13/10]

Síntoma: en la reunión del 13/10 Mauricio probó «Un Lead Agendó Llamada» (#213, ws1) con un lead cargado a mano y no le
llegó nada. El lead ya no estaba: Mauricio lo borró después, y con él se fueron (en cascada) su inscripción y sus filas de
`nutricion_envios`, incluida la del cierre «la reunión ya pasó». **Lo que sobrevivió fue `lead_audit`, que no tiene FK al
lead:** el 2660 pasó a «agenda» con la R1 «2026-10-12» SIN hora el 13/10 a las 01:57 UTC (19:57 del 12/10 en México),
volvió a «lead» y MaKo lo puso otra vez en «agenda» a las 02:05.
Causa: el motor lee una fecha sola como el mediodía de México (`parseFechaJunta`) y, antes de mandar un paso de un flujo que
prepara una reunión, cierra la inscripción si «la reunión ya pasó». A las 20:05 el mediodía ya había pasado. El reuso de la
segunda vuelta tampoco arrancó (`reunionQuePreparaMs` = null por la misma regla). Le pasa a cualquier lead agendado para
HOY después de las 12 sin que llegue la hora (alta a mano). Por Calendly no, porque trae la hora.
El diagnóstico obvio era el flujo de Mauricio (las tarjetas que borró en la llamada); la reproducción del motor puro sobre
el #241 andaba bien porque usaba un lead CON hora.
**Regla:** el mediodía es una hora inventada para anclar un «N antes», no la hora en que una reunión pasa a ser pasado.
Una fecha sola vale hasta que termina su día (`finDeLaReunionMs`, `reunionEnPie`). Un paso ANCLADO sigue necesitando una
hora (`laReunionYaPaso(…, { anclada })`). Test: tests/reunion-fecha-sola-del-dia.test.ts, probado rompiéndolo.

**Vive en:** `lib/nutricion-reinscripcion.ts` · `lib/nutricion.ts` (`procesarEnvios`, `inscribirEnSecuencia`)

**Sin hacer:** borrar un lead es un hard delete (`deleteLead`, lib/leads.ts) y no deja quién ni qué. Martín lo pidió
como registro de TODAS las acciones de un usuario para SuperAdmin (memoria `registro-acciones-superadmin`).

### Un Evento de MaKo que se ofrece sin emisor deja main en rojo, aunque el emisor «sea de otro chat» [avisos · 14/10]

`2ea2cf81` sumó el evento «El AI Analyst termina un análisis» y su plantilla, con la idea de que lo emitiera después el
chat Graphics. Main quedó con dos tests en rojo (lo avisó el chat CRM): tests/plantillas-viejas.test.ts (test 1, «se le
muestra al cliente y nada lo emite») y tests/tabs-retiradas.test.ts (un `?hoja=12` de EJEMPLO, en lib/avisos-catalogo.ts
y lib/variables-aviso.ts, que no es una hoja). Ninguno de los dos estaba en las tandas que corrí: leen el catálogo de
avisos y el de variables, no el área.
**Regla:** al tocar `lib/avisos-catalogo.ts`, `lib/variables-aviso.ts` o `EVENTOS_MAKO`, correr también esos dos. Y un
evento entra con su emisor en el MISMO commit, aunque el emisor viva en el código de otra área (acá, `avisarAnalisisListo`
en lib/graficos-analisis-server.ts). Un link de ejemplo nombra una hoja real (`?hoja=marketing`).

**Vive en:** `lib/avisos-catalogo.ts` · `lib/variables-aviso.ts` · `lib/graficos-analisis-server.ts`
