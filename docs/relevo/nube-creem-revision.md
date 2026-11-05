# La revisión de Creem: el sitio, la política de uso y la moderación (nube, 5/11/2026)

> Lo escribió la sesión de la nube que hizo el trabajo (cuenta `nube`, sesión `cli_a3ba5ed6-c0ff-5a7c-bc38-e7c9878ab62b`),
> en la rama `claude/cool-davinci-7qfia2`, subida a `punta/creem-revision`. Es de primera mano: lo que digo que medí, lo medí acá.

## Lo pedido (el encargo, textual)

> Dejá el sitio listo para la revisión de Creem. Leé `docs/creem-retiros.md` y estas páginas oficiales:
> docs.creem.io/merchant-of-record/account-reviews/account-reviews, .../re-review-guide, .../rejected-accounts y
> .../ai-wrapper-compliance.
> 1. Revisá contra esos requisitos, uno por uno, lo que sirve hola-mako.com: dominio, producto, `/terminos`, `/privacidad`,
>    `/planes`, `/reembolsos`, `/soporte`, el correo de contacto. El nombre del responsable tiene que coincidir en todas.
> 2. `/aup` redirige a `/login`: hace falta una política de uso aceptable pública, enlazada desde el pie del sitio y de los
>    términos, sin sesión, escrita para lo que MaKo hace de verdad.
> 3. Integrá el Moderation API de Creem donde se genera imagen o video desde un prompt, si su documentación lo exige. Un
>    prompt rechazado muestra un mensaje claro. Si la moderación falla por un error de Creem, no se cae la generación. Hay
>    que proteger la clave y no gastar de más: cada llamada, medida.
> 4. Medí si AI Avatar puede leerse como «manipulación de rostros» y qué haría falta. No lo apagues: es una decisión de
>    Martín. Dejá el análisis y un borrador de la consulta a soporte de Creem.

## ⚠️ Lo que NO pude leer, y de dónde salió cada cosa

**Esta sesión no pudo abrir docs.creem.io** (ni `creem.mintlify.app`): la red de la nube los rechaza (`403` del proxy). Las
cuatro páginas oficiales no las leí yo. Lo que digo de ellas sale de:

1. `docs/creem-retiros.md`, que las leyó en pantalla el 5/11/2026 (los requisitos de la revisión y los riesgos de MaKo).
2. **El SDK oficial de Creem** (`creem` 1.13.0 en npm, generado de su OpenAPI): el contrato exacto del Moderation API.
   Ésa es una fuente de primera mano.
3. Búsquedas web (resúmenes del buscador, no la página): que el Moderation API es obligatorio **desde el 1/5/2026** para
   todo producto de imagen o video desde texto; que la guía de Creem recomienda **frenar** si la moderación no contesta;
   que piden **poder cancelar la suscripción desde el producto**; y que mencionan deepfakes entre lo prohibido.
   [Moderation](https://docs.creem.io/features/moderation), [la guía del generador seguro](https://docs.creem.io/guides/safe-metered-ai-image-video-generator),
   [Account Reviews](https://docs.creem.io/merchant-of-record/account-reviews/account-reviews), [FAQ](https://docs.creem.io/guides/faq).
   Y lo que hicieron otros que pasaron la revisión: [5Pixels #65](https://github.com/Abraham12611/5Pixels/pull/65) (legales,
   correo de soporte, moderación que frena si falla, y **sacaron un contador falso de descuento**),
   [opencmo #166](https://github.com/marcus-legia/opencmo/pull/166), [opencmo #170](https://github.com/marcus-legia/opencmo/pull/170),
   [huijian #1](https://github.com/kangkangding/huijian/pull/1).

**Para el Cerebro:** si va a haber más trabajo con Creem desde la nube, conviene sumar `docs.creem.io` a los hosts
permitidos del entorno. Antes de dar esta lista por cerrada, alguien con la doc abierta la cruza con las cuatro páginas.

## Los requisitos, uno por uno

Medido contra el código de esta rama (no contra producción: desde la nube no veo hola-mako.com). «Hecho» = en esta punta.

| # | Requisito | Estado | Dónde / qué falta |
|---|---|---|---|
| 1 | Dominio propio | ✅ ya estaba | hola-mako.com. No medí producción desde acá. |
| 2 | Producto en vivo y descripto | ✅ ya estaba | La landing dice qué es y muestra los precios; /planes tiene el checkout. Creem le toca a LATAM fuera de Argentina (`pasarelasDelPais`). ⚠️ En Creem hay **0 productos**: el primer checkout real de Creem nunca se creó (`docs/creem-retiros.md`). |
| 3 | Términos visibles | ✅ hecho | /terminos, en el pie de la landing y de cada página legal. **Nuevo:** nombra a Creem como vendedor registrado (*merchant of record*) cuando se paga con él, y enlaza /aup. |
| 4 | Privacidad visible | ✅ hecho | /privacidad. **Nuevo:** suma Creem, Stripe y Mercado Pago (cobro) y la moderación de Creem (qué se le manda: el texto del pedido, sin la foto, con el número del espacio). |
| 5 | Precios visibles | ✅ ya estaba | Columnas de precios en la landing y /planes. **Nuevo:** «Planes y precios» en el pie de la landing. |
| 6 | Reembolsos | ✅ hecho | /reembolsos. **Nuevo:** Creem como medio de devolución, y que el reembolso se nos pide a nosotros. |
| 7 | Correo de soporte visible y coincidente | ✅ en el sitio · ⚠️ Martín | `equipo@hola-mako.com` en todas (lo fija `tests/creem-revision-sitio.test.ts`). **Falta:** que Creem → Settings → Business Details tenga el MISMO, y comprobar que ese buzón RECIBE (ver abajo, «Lo que le toca a Martín»). |
| 8 | Soporte | ✅ hecho | /soporte. **Nuevo:** cobros, facturas, reembolsos, qué hacer si MaKo no quiso generar algo, y cómo denunciar un abuso. |
| 9 | El responsable coincide en todas | ✅ en el sitio · ⚠️ Martín | `Razón social: Tejado Gonzalvez Leandro Martin` (de `lib/titular-mako.ts`) ahora sale al pie de TODAS las legales (antes sólo en la landing y en el cuerpo de algunas). **Falta:** que quien se da de alta en Creem (KYC) sea esa misma persona. Ver abajo. |
| 10 | Cancelar la suscripción desde el producto | ✅ ya estaba | Botón «Darme de baja» en Configuración del negocio → Tu plan. |
| 11 | Sin información falsa | ⚠️ Martín | El reloj del 50% de la landing (`lib/promo-entrada-reglas.ts`) es honesto en un navegador, pero en otro navegador vuelve a empezar. Es el tipo de contador que 5Pixels sacó para pasar la revisión. Decisión de Martín: apagarlo mientras Creem revisa, o dejarlo. |
| 12 | Rubro: IA generativa, servicios, lead generation | ⚠️ Martín | Son rubros «restringidos»: Creem pide historial con la pasarela anterior, tasa de contracargos y por qué cambia (`docs/creem-retiros.md`). Hay que tenerlo a mano al pedir la revisión. |
| 13 | Política de uso aceptable pública (IA) | ✅ hecho | **/aup nueva**, pública y sin JavaScript. Enlazada desde el pie de la landing (con y sin JavaScript), el pie de cada legal, los términos (§2 y §6) y /soporte. |
| 14 | Moderation API en producción (imagen y video desde texto) | ✅ hecho · ⚠️ dos decisiones | Ver la sección siguiente. |
| 15 | Manipulación de rostros prohibida | ⚠️ Martín | AI Avatar. Análisis y borrador a soporte, abajo. **No se tocó.** |
| 16 | Sin contenido sexual ni «AI companion» | ✅ | MaKo no tiene nada de eso; /aup lo prohíbe. |

## La moderación de Creem: qué quedó

**Dónde:** en la cola del puente a Google Flow (`encolar`, `lib/flow-cola.ts`), que es por donde sale TODA imagen y todo video
generado desde un prompt: Video Generator (escenas y tomas), AI Avatar (looks y videos), el avatar del Video Editor y la
prueba del puente. Medí que no hay otro: ni Image Editor ni carruseles generan imágenes desde texto (`lib/funciones-mako.ts`:
«Todavía no: pedirle fotos a un banco de imágenes»), y la caricatura de Spy la hace el Runner con Canva. `lib/model-catalogo.ts`
sólo tiene modelos de TEXTO.

**Cómo:** `encolar('generar_imagen' | 'generar_clip', …)` modera `pedido.prompt` (el prompt FINAL, entero) antes de
insertar el trabajo. Su firma devuelve también un `RechazoDeModeracion`, así que **el compilador obliga** a cada llamador a
decir qué ve la persona. Los cuatro lo muestran tal cual:

> No puedo generar esto: el texto pide algo que la política de uso de MaKo no permite (hola-mako.com/aup). Cámbialo y vuelve a intentarlo. No se gastó nada.

Y no gasta: lo frenado no se encola, no cuenta para el tope de la prueba y no toca créditos de Flow.

**El contrato** (del SDK oficial): `POST https://api.creem.io/v1/moderation/prompt`, clave en `x-api-key`, cuerpo
`{ prompt, external_id }`, respuesta `{ id, decision: allow|deny|flag, usage: { units } }`. Una clave `creem_test_…` va a
`test-api.creem.io`. El endpoint figura como **experimental**: una respuesta que no entendemos es un error, nunca un «allow».

**Las decisiones que tomé**, con su porqué en `lib/creem-moderacion-reglas.ts`:
- `deny` y `flag` frenan. `flag` es «no lo niega pero lo mira de cerca»; generar igual suma marcas sobre la tienda, y un
  rechazo de Creem es definitivo.
- **La clave es la de la plataforma** (ws 9, `credDelCliente`), no la del negocio: quien vende MaKo en Creem es MaKo. La clave
  no sale del módulo `server-only`: ni a un log, ni a un error, ni al navegador.
- **Cada llamada queda medida** en `anthropic_usage` (proveedor `creem`, feature `creem-moderacion`), a nombre de la
  plataforma, con el negocio, la decisión, las unidades y los milisegundos. **Sin el prompt** (es de un cliente). Costo en
  US$0 porque no encontré el precio de la unidad: las unidades quedan, y con el precio se calcula.
- **No se paga dos veces lo mismo:** la decisión de un prompt se recuerda 30 minutos por negocio (un reintento de la misma
  toma no vuelve a llamar). 5 s de espera como máximo.
- En la app de iPhone, sin el permiso de IA de la persona, el prompt no sale (ni a Creem ni a Google): mismo rechazo claro.
  Era un hueco que ya estaba (el prompt a Google Flow no pasaba por `exigirPermisoIa`).
- **Si Creem no contesta** (caída, 5xx, tiempo, 429, respuesta rara): **se genera igual**, como pidió el encargo, y queda
  anotado. Si falta la clave o Creem la rechaza (401/403), también se genera, pero eso es NUESTRO: abre un ticket solo
  (`registrarError`, «ModeracionCreem»).

**Probado:** `tests/creem-moderacion.test.ts` (8 casos, la regla pura con un fetch falso y la cola REAL contra una base y un
Creem de mentira en `tests/_creem-moderacion-hijo.ts`), roto seis veces y cada rotura cae. Tipos: tsc acotado en verde.
**Sin probar contra Creem de verdad:** desde la nube no tengo la clave. El primer pedido real lo dice.

## Lo que le toca a Martín (en este orden)

1. **Quién se da de alta en Creem.** El sitio dice, en todas las legales, que el responsable es **Tejado Gonzalvez Leandro
   Martin** (`lib/titular-mako.ts`, así lo pidió Meta). Creem compara el sitio con el KYC y con la cuenta de retiro (si es
   persona, la cuenta tiene que ser personal y a su nombre). Si el alta la haces tú como persona, el sitio y el KYC no
   coinciden. Hay que elegir: o el alta la hace Leandro (KYC y cuenta suyos), o se cambia el responsable del sitio (y eso
   toca la verificación de Meta y las tiendas). No lo decidí: es tuyo.
2. **El correo:** en Creem → Settings → Business Details, `equipo@hola-mako.com`, igual que el sitio. Y mándale un correo a
   esa dirección desde otra cuenta y mira que llegue: el dominio recibe por reenvío alias por alias (`lib/app-url.ts`), y un
   alias que no existe se descarta sin aviso. Creem va a escribir ahí.
3. **Si Creem no contesta, ¿se genera o no?** Lo pedido fue «no se cae la generación» y así quedó. La guía de Creem
   recomienda lo contrario (que la generación espere). Cambiarlo es una línea: `SI_CREEM_NO_CONTESTA` en
   `lib/creem-moderacion-reglas.ts` (`'generar'` → `'frenar'`), y el mensaje ya está escrito.
4. **El aviso en la app por un destinatario nuevo.** /privacidad promete: «Si el cambio es de fondo —datos nuevos, un
   destinatario nuevo— te avisamos dentro de la aplicación antes de que aplique». La moderación de Creem es un destinatario
   nuevo del texto de los pedidos de imagen y video. O se manda ese aviso (una novedad dentro de la app), o se acepta el
   cambio así. Decisión tuya; con un abogado, mejor.
5. **El reloj del 50% de la landing** (requisito 11): apagarlo mientras Creem revisa, o dejarlo.
6. **Mandar la consulta a soporte de Creem** (borrador abajo), con el Store ID de la tienda «hola-MaKo».
7. **Un abogado** mira lo marcado como borrador: /aup entera; la cláusula de Creem en /terminos §8 (no nombré la razón
   social de Creem porque no la pude confirmar); /privacidad (Creem como responsable de los datos de pago); /reembolsos
   (Creem procesa la devolución). En /aup, puntualmente: el consentimiento por escrito para caras ajenas, a qué autoridad se
   denuncia el abuso de menores (Argentina y los países de los clientes), las leyes de mensajes comerciales (Argentina: Ley
   26.951; México: REPEP) y si hace falta marcar el contenido generado con IA.

## Lo que le toca al Cerebro (desde la PC, después del deploy)

- Mirar en producción, sin sesión: `/aup` contesta 200 (antes mandaba a /login); el pie de la landing y de /terminos tiene
  «Uso aceptable»; /privacidad nombra a Creem.
- Generar una escena en el negocio de prueba (ws 3) y mirar que aparezca una fila en `anthropic_usage` con `provider =
  'creem'` y `allow`. Si en cambio se abre un ticket «ModeracionCreem» con «Creem rechaza la clave», puede ser que Creem no
  deje usar la moderación antes de aprobar la tienda: eso también se pregunta a soporte.
- Mirar que SuperAdmin › Uso dibuje bien las filas del proveedor `creem` (no lo pude ver: no tengo la app corriendo).
- La regla nueva para código está en AGENTS.md («Lo que genera imagen o video pasa por `encolar`»).

## AI Avatar frente a la «manipulación de rostros»

**Qué hace hoy** (`lib/funciones-mako.ts`, `app/ai-avatar/`): la persona sube una foto (la del onboarding de «Voz y cara»),
MaKo la sube a su Google Flow, genera imágenes de ESA persona en una de 28 escenas (`generar_imagen` con la cara de
referencia) y después la anima diciendo un guion (`generar_clip`). Dice que reemplaza a Higgsfield y HeyGen. El Video
Generator hace lo mismo con la cara del dueño para sus anuncios.

**Por qué se puede leer como manipulación de rostros:** produce imágenes y videos nuevos de una persona REAL, en lugares
donde no estuvo y diciendo algo que no dijo. Técnicamente es *synthetic media* de una persona: un revisor que lee «tu avatar
con tu cara» y «reemplaza HeyGen» puede ponerlo en esa bolsa.

**Por qué no es lo que se suele prohibir:** no hay intercambio de caras (*face swap*) sobre un video ajeno, ni «desnudar», ni
envejecer o cambiar a alguien en una foto existente. Es el caso de uso de HeyGen o Synthesia: un avatar de uno mismo para sus
propios anuncios. El prompt del look pasa ahora por la moderación de Creem, y /aup prohíbe usar caras ajenas sin permiso
por escrito.

**Lo que falta, medido en el código:**
- **La foto no pide ningún permiso.** La voz sí: «Autorizo a MaKo a crear una copia de mi voz… y confirmo que la voz de las
  grabaciones es la mía», y el server lo vuelve a exigir (`app/video-generator/OnboardingVideoGen.tsx`). La cara no tiene
  nada parecido: cualquiera puede subir la foto de otra persona. Es lo primero que haría: la misma casilla para la foto
  («es mi cara, o tengo permiso por escrito de la persona»), guardada con fecha, y exigida por el server al generar.
- **Nada mira la imagen:** la moderación de Creem lee TEXTO. Una foto de un menor o de un famoso no la ve nadie.
- **No hay marca de «generado con IA»** en lo que sale. Para un video de una persona hablando es lo que más se pide
  (HeyGen exige un video de consentimiento para un avatar propio).
- **Sin medir:** cuántos negocios usan AI Avatar y cuántas fotos hay (la base de producción no se ve desde la nube).

**Qué haría falta para defenderlo**, de menor a mayor esfuerzo: (1) la casilla de permiso de la foto, como la de la voz;
(2) decirlo en la ficha del producto («avatar de tu propia cara, con tu permiso»), que ya dice /aup; (3) una marca visible
de IA en los videos de avatar; (4) si Creem lo pide, verificar que la cara de la foto es la de quien tiene la cuenta (una
selfie al conectar). Ninguna se hizo: es decisión tuya, y conviene preguntarle a Creem primero.

### Borrador de la consulta a soporte de Creem

En inglés, que es como contesta su soporte. Va con el Store ID (no lo tengo).

> Subject: Account review question — AI avatar feature and Moderation API (store "hola-MaKo", Store ID: ____)
>
> Hi Creem team,
>
> We're preparing our store for account review and want to make sure we're compliant before submitting.
>
> **What we sell:** MaKo (hola-mako.com) is a B2B SaaS for small businesses that sell high-ticket services: CRM, WhatsApp and
> email follow-ups, landing pages, and AI tools to produce their own ads. Plans are monthly subscriptions (USD 47 and up).
>
> **Image and video generation:** some features generate images and short videos from a text prompt (ad scenes, and an "AI
> avatar" of the user). Generation runs on the customer's own Google account (Google Flow); we never host the model. Every
> prompt is now screened with your Moderation API (`POST /v1/moderation/prompt`) right before it reaches the model; `deny` and
> `flag` are blocked and the user is told why. Our Acceptable Use Policy is public at https://hola-mako.com/aup.
>
> **Our questions:**
> 1. **AI avatar.** The user uploads a photo of themselves and the product generates new images and talking videos of that
>    same person for their own ads (similar to HeyGen or Synthesia). There is no face swapping onto someone else's
>    content. Our AUP only allows the user's own face, or someone who gave written consent, and adults only. Does this fall
>    under your prohibition on face manipulation / deepfake products? If it's allowed with conditions (consent capture,
>    identity verification, AI labels), which ones do you require?
> 2. **Moderation failures.** If the Moderation API times out or returns a 5xx, should generation be blocked (fail closed),
>    or is it acceptable to proceed and log it? Is the API available before the store is approved, and is it billed per
>    unit (`usage.units`)? At what price?
> 3. **Payouts to Argentina.** For a bank account in Argentina: in which currency does the payout arrive, through which
>    partner, and at what exchange rate? Can we receive to a USD account?
> 4. **Restricted categories.** We offer AI content generation and services as part of a SaaS. What history do you need
>    from our previous processors (we use Stripe and Mercado Pago) to complete the review?
>
> Thanks!
> [nombre de quien se da de alta en Creem]

## Archivos

- `lib/creem-moderacion-reglas.ts` — lo que decide (puro): el contrato, qué frena, el recuerdo, la medición, los textos.
- `lib/creem-moderacion.ts` — la clave de la plataforma, el recuerdo del proceso, la fila de uso y el ticket si es nuestro.
- `lib/flow-cola.ts` — `encolar` modera lo que genera; `RechazoDeModeracion`, `esRechazoDeModeracion`, `GENERAN_DESDE_PROMPT`.
- `app/video-generator/video-action.ts`, `app/ai-avatar/actions.ts`, `app/video-generator/puente-actions.ts` — muestran el rechazo.
- `app/aup/page.tsx` — la política de uso aceptable (borrador para abogado).
- `app/_legal/LegalShell.tsx` — el pie compartido de las legales (sin enlaces de compra: también se abren en la app de iPhone).
- `app/terminos`, `app/privacidad`, `app/reembolsos`, `app/soporte`, `app/vsl/Landing.tsx`, `app/vsl/PortadaSinJs.tsx`.
- `lib/rutas-publicas.ts` — `/aup` pública.
- `tests/creem-moderacion.test.ts`, `tests/_creem-moderacion-hijo.ts`, `tests/creem-revision-sitio.test.ts`, y `/aup` sumada a
  `tests/layout-sin-suspense.test.ts`.
