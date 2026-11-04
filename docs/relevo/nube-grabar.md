# Relevo «Grabar» (nube, 4/11/2026)

Lo escribe el chat de la nube que lo hizo (`cli_6ff1501b-e5d8-58be-a2dd-2546d599dfd6`, cuenta `nube`). Martín, textual, por el
Cerebro: «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard template que sea "Call
Calling", en mobile, en lugar de "Plan" en la bottom bar, pon "Dashboard".»

Se leyó como tres pedazos, cada uno en su punta (`punta/grabar-*`). «Call Calling» se leyó como **Cold Calling** (las
llamadas en frío): con el botón de grabar adentro y los números de una tanda de llamadas.

| Pedazo | Punta | Estado |
|---|---|---|
| 1. En el teléfono, «Dashboard» en el lugar de «Plan» | `punta/grabar-barra-dashboard` (`4b8468849`) | **En producción** |
| 2. «Grabar» en la ficha del lead (computadora y teléfono) | `punta/grabar-ficha` (`891ee15ce`) | **En producción** (entró con la 3) |
| 3. La plantilla Cold Calling del Dashboard | `punta/grabar-cold-calling` (`f07198cdb`) | **En producción** |

Las tres están en el deploy de producción `1b7a4bc3` (4/11, 09:04 UTC, «vercel.deployment.success»). La corrida de
`punta/grabar-ficha` pasó tests, guardas y el `tsc` entero, y falló sólo al llevar a main porque main se había movido (un choque
en la bitácora del CRM). Se resolvió en la 3, que la llevaba adentro: la marca `ci-rojo/grabar-ficha` quedó vieja y no es un rojo
del código. **Lo único que falta para que se use: aplicar la migración 0390** (abajo).

## 1. La barra del teléfono

CRM · Chats · Ops Center · **Dashboard** · More. Plan es la primera fila de Today en More, como en la sidebar. Dashboard abre
el de cada uno: Focus y las hojas a quien ve General; su hoja al closer y al setter (`destinoDashboard`, lib/movil-rutas.ts).

## 2. «Grabar» en la ficha

**Dónde está:** al lado del funnel en el pop-up del lead y en `/crm/<id>`; en el teléfono, la tercera acción de la ficha. Abre
un panel con lo que se puede grabar ahí (una línea), «Avísale que estás grabando», y las llamadas ya grabadas de ese lead.

**Cómo anda:** graba en el navegador en partes de 3 minutos (cada una un archivo entero), las sube a medida que se cierran, y al
cortar la persona dice cómo terminó (no contestó, habló, agendó, no le interesa). Por detrás, cada parte se transcribe con la IA
del negocio y, completa, la llamada pasa por el Closing con su Claude. La grabación sigue aunque se cierre la ficha: un aviso en
la esquina la muestra y la corta.

**Sin IA:** el audio queda guardado y la ficha dice qué conectar, con el botón ahí mismo. Nada se rompe.

**API de MaKo** (área `closing`, sin HTTP: son conversaciones de personas): `grabaciones_en_mako_de_un_lead` (lectura) y
`como_termino_grabacion` (acción con su «sí»).

**Lo que la pantalla dice que NO se puede** (medido en la documentación de cada plataforma, no en un aparato):
- Una llamada de ese mismo teléfono no se graba: Android le da silencio a cualquier app mientras hay una llamada, e iOS le
  corta el micrófono a la página. Se hace en otro aparato y en altavoz.
- El otro lado de una llamada por computadora sólo se oye compartiendo la pestaña, y eso lo dan Chrome y Edge. En Safari y
  Firefox se graba sólo el micrófono.

### ⚠️ Migración 0390 — SIN APLICAR

`supabase/migrations/0390_llamadas_grabadas.sql`: las tablas `llamadas_grabadas` y `llamadas_grabadas_partes` y el bucket
privado `llamadas-grabadas`. **Sólo agrega.** Orden: **antes o junto con el deploy** (sin las tablas el botón dice que la
grabación todavía no está lista y no graba; el reset del Cliente de Prueba avisaría que faltan). Se aplica con el OK del Cerebro.

- El número **0390** es alto a propósito: desde la nube no se ven los worktrees de la PC ni los números reservados, y en las
  ramas remotas el más alto era 0373. Si el Cerebro tiene otro número para esto, se renumera el archivo (nada lo nombra por
  número).

### Qué se probó con audio de verdad

Con `node scripts/probar-grabadora-navegador.mjs`: el código REAL de `app/_components/grabar/grabadora.ts` en Chromium, con un
micrófono falso que suena desde una voz sintetizada (ffmpeg + flite), y las subidas interceptadas (sin servidor ni base).
- **Sólo el micrófono, 11 s:** 3 partes, numeradas desde 0, cada una abre sola (cabecera EBML) y se decodifica; suman 10,74 s;
  la voz se oye (−17 dB en la banda de la voz); el «terminar» llega con las 3 partes y 11 s.
- **Micrófono + pestaña, 9 s:** la pestaña simulada con un tono de 1 kHz; el audio trae el tono (−13,6 dB) y la voz. La mezcla
  no sale muda.

### Qué NO se probó

- **La transcripción y el análisis con una IA de verdad** (la nube no tiene claves ni base). Están probados con su lógica pura
  (`tests/grabar-llamada.test.ts`), no de punta a punta.
- **La subida contra Vercel y Supabase de verdad**, ni la migración aplicada.
- **Un teléfono de verdad, Safari, Firefox ni la app de iPhone** (`nativo/ios`). La app de iPhone ya pedía el micrófono; su
  explicación ahora nombra las llamadas (Info.plist), y eso entra recién con el próximo build de Codemagic.
- **Que el `AudioContext` de la mezcla se cree en el clic:** Chromium sin pantalla no aplica la regla de autoplay, así que no
  se pudo romper para ver que la prueba lo caza.

**Para probarlo en el Cliente de Prueba (ws 3), con la migración aplicada:** abre un lead, «Grabar», habla 4 minutos (para que
haya 2 partes), corta, elige cómo terminó. A los pocos minutos la llamada sale transcrita y, con Claude conectado, analizada.

## 3. Cold Calling

**Dónde está:** Dashboard → Nueva hoja → **Cold Calling** (se sugiere a quien sale a buscar: escribe o llama primero).

- Primero, al lado de los números, **«Grabar llamada»**: buscas el lead (el mismo buscador del CRM del teléfono) y grabas con la grabadora de
  la ficha, con origen «en frío». «Otro lead» pasa al siguiente de la tanda.
- Abajo, del conjunto nuevo **«Llamadas grabadas en MaKo»**: llamadas, cuántas contestaron (%), cuántas agendaron, cuántas agendan
  de las que contestan (con menos de 5 que contestaron no se da el porcentaje), las llamadas por día, cómo terminan, quién llamó y a
  quién llamaste (cada lead abre su ficha).
- «Contestaron» es lo que marca quien llama al cortar; una sin marcar va a «Sin marcar».
- Sin la migración 0390, la hoja dice que la grabación todavía no está lista (no muestra ceros).
- En el teléfono, el Dashboard muestra los números de la hoja; el botón de grabar está en la ficha del lead.

**Probado:** `tests/cold-calling.test.ts` corre la fila, el agregador del Dashboard y la hoja instanciada (el botón arriba, todo
del conjunto nuevo, «Sincronizar llamadas» de Closing sigue al pie), probado rompiéndolo. **No probado:** la hoja en un navegador con
datos de verdad (la nube no tiene base).
