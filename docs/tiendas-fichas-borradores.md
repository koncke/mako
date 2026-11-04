# MaKo en las tiendas: los borradores para revisar (3/11/2026)

Todo lo que se pega en Play Console y en App Store Connect, en este orden. Revisa, cambia lo que quieras y pégalo.
Lo que dice **[Martín]** es un dato que sólo tú tienes. Los textos para el usuario van en tú.

Lo que se declara sale del código y de `/privacidad`, medido el 3/11/2026. Si una función nueva cambia los datos, esto también.

---

## 1. Datos que van en las dos

| Campo | Valor |
|---|---|
| Nombre | **MaKo** |
| Id de la app | `com.holamako.app` (no se cambia nunca) |
| App Store Connect | SKU `mako-ios`, Apple ID `6830383006`, idioma principal Spanish (Mexico) |
| Categoría | Empresa / Business (Apple, secundaria: Productividad) |
| Política de privacidad | https://hola-mako.com/privacidad |
| Términos | https://hola-mako.com/terminos |
| Soporte | https://hola-mako.com/soporte |
| Eliminar la cuenta | https://hola-mako.com/eliminar-cuenta |
| Correo de contacto | equipo@hola-mako.com |
| Precio | Gratis, sin compras dentro de la app |

**Quién figura:** en la App Store, el vendedor es el nombre legal de Leandro Tejado, titular de esa cuenta. En Play, la cuenta es de Martín, y Google muestra su nombre legal aunque el nombre público sea MaKo.

**Decidido el 4/11/2026** (Martín: «Si, el responsable legal es Leandro»): `/privacidad` y `/terminos` nombran como responsable a «Tejado Gonzalvez Leandro Martin», la razón social de ARCA (`lib/titular-mako.ts`), y suman una línea con quién publica en cada tienda: ese mismo nombre en la App Store y «Martín Carballo Koncke» en Google Play (`PUBLICA_EN_PLAY`).

---

## 2. Google Play: la ficha

**Título (30 caracteres como máximo):**

> MaKo: ventas y marketing IA

**Descripción corta (80 como máximo):**

> Tu CRM, tus chats y campañas en un solo lugar, con una IA que trabaja contigo.

**Descripción larga (4.000 como máximo):**

> MaKo es la herramienta de trabajo de tu negocio: tus contactos, tus conversaciones, tu plan y tus campañas en un solo lugar, con una inteligencia artificial que conoce tu negocio y te ayuda a avanzar.
>
> **Lo que haces desde el teléfono**
>
> • Le pides cosas a MaKo por texto o por voz: un resumen, un mensaje, qué sigue hoy.
> • Ves tu CRM como tablero y mueves cada contacto de etapa con el dedo.
> • Contestas todos tus chats en una sola bandeja.
> • Sigues tus números del día en General y en el Dashboard.
> • Organizas tus tareas y proyectos en el Plan.
> • Recibes avisos de lo que necesita una decisión tuya, y apruebas desde la tarjeta.
> • Editas videos e imágenes, y escribes tus anuncios.
>
> **Para quién es**
>
> Para negocios que venden por conversación: agencias, consultores, cursos, servicios y equipos de venta. MaKo es para mayores de 18 años.
>
> **Necesitas una cuenta de MaKo.** La app es para quienes ya tienen una.
>
> **Tus datos**
>
> Lo que le pides a la IA va a servicios de IA de terceros, y lo contamos en la política de privacidad: https://hola-mako.com/privacidad. Puedes eliminar tu cuenta desde la app cuando quieras.

**Recursos:**

| Recurso | Medida | Estado |
|---|---|---|
| Ícono | 512×512, PNG con alfa, hasta 1 MB | `public/icon-512.png` (listo, 20 KB) |
| Feature graphic | 1024×500, sin alfa | `nativo/android/feature-graphic.png` (borrador, míralo) |
| Capturas de teléfono | Al menos 4, de 1080×1920 o más, sin alfa | Se sacan del `/m` real con el negocio de prueba, cuando esté su cuenta de revisión |
| Video | Opcional | No va |

---

## 3. App Store: la ficha

**Nombre (30 como máximo):** MaKo

**Subtítulo (30 como máximo):** Ventas y marketing con IA

**Texto promocional (170 como máximo):**

> Tu CRM, tus chats y tus campañas en un solo lugar. Pídele a MaKo por voz lo que necesitas, y apruébalo con un toque.

**Descripción:** la misma de Play, sin la línea de los editores si en iPhone no llegan a la primera versión.

**Palabras clave (100 como máximo):**

> crm,ventas,marketing,leads,chat,clientes,negocio,campañas,ia,asistente,tareas,whatsapp

**URL de soporte:** https://hola-mako.com/soporte

**Recursos:** capturas de 1320×2868 y de 1206×2622 (con esas dos alcanza; Apple escala el resto), sin alfa. Ícono de 1024 sin alfa: ya está en el proyecto. Sólo iPhone: no pide capturas de iPad.

### Las notas para el revisor (en inglés, las pide Apple)

> MaKo is a work tool for small sales and marketing teams: CRM, unified inbox, tasks and an AI assistant. Accounts are created by the business on the web. The app does not sell anything and has no purchases.
>
> **Demo account** (email and password, no second factor): **[Martín: `cuenta-revision.txt`]**. It is a team-member account in its own demo workspace with fictitious data (six sample leads in the CRM). You can browse every screen, open the CRM and the chats, talk to the assistant, accept or decline the AI consent, report a response or a post, and delete the account (in the demo workspace it records the request and keeps the account working, so the next review can sign in). Changing data and sending messages to other people are turned off for this account.
>
> **Native features, beyond the website:**
> 1. Push notifications through APNs: open Account › Notifications and tap Test.
> 2. Microphone: dictate to the assistant from the chat box, and send voice notes.
> 3. Native share sheet: saving a video or a file goes to Save to Photos or Save to Files.
> 4. Universal links: an hola-mako.com link opens the matching screen in the app.
> 5. Haptic feedback on approving or sending, and a native offline screen when there is no connection.
>
> **Third-party AI (5.1.2(i)):** the first time, the app names the AI providers and asks for permission. Without it, nothing is sent to them and the rest of the app keeps working. You can change it in Account › Third-party AI.
>
> **Account deletion (5.1.1(v)):** Account › Delete my account, two taps. It explains the scope and the deadline (up to 30 days), and an email confirms it when finished.
>
> **Reporting AI content:** every assistant reply has a Report button below it.

---

## 4. Play: Data safety

Todo cifrado en tránsito: **sí**. Se puede pedir el borrado: **sí**, con https://hola-mako.com/eliminar-cuenta. Sólo lo que está en la lista. «Compartido» es lo que sale a un tercero que no trabaja para MaKo; los proveedores que procesan por encargo no cuentan como compartir, según la definición de Google, salvo lo que se marca.

| Tipo de dato (Play) | ¿Se recoge? | ¿Se comparte? | Obligatorio | Para qué |
|---|---|---|---|---|
| Nombre | Sí | No | Sí | Funcionalidad, gestión de la cuenta |
| Correo | Sí | No | Sí | Funcionalidad, gestión de la cuenta, comunicaciones |
| Identificadores de usuario | Sí | No | Sí | Funcionalidad, gestión de la cuenta |
| Device or other IDs: el token de avisos (push) del teléfono | Sí, si activa los avisos | No: Firebase lo usa por encargo, sólo para entregar el aviso | Opcional | Funcionalidad: mandarle los avisos |
| Teléfono | Sí | No | Opcional | Funcionalidad, seguridad |
| Otra información personal (cargo, empresa, sitio web, zona horaria) | Sí | No | Opcional | Funcionalidad |
| Historial de compras (lo que paga a MaKo y lo que cobra el negocio) | Sí | No | Opcional | Funcionalidad |
| Mensajes en la app | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Correos y SMS: no, salvo los correos que se leen en Chats si conecta su Gmail | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Fotos | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Videos | Sí | No | Opcional | Funcionalidad |
| Grabaciones de voz | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Archivos y documentos | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Eventos del calendario | Sí, si conecta su agenda | No: nunca van a una IA | Opcional | Funcionalidad |
| Contactos (los de su CRM, no la libreta del teléfono) | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Interacciones con la app (quién movió qué) | Sí | No | Sí | Funcionalidad, seguridad |
| Otro contenido del usuario | Sí | **Sí: IA elegida** | Opcional | Funcionalidad |
| Registros de errores y diagnósticos | Sí | No | Sí | Rendimiento de la app |
| Ubicación, salud, contactos del teléfono, apps instaladas, publicidad | **No** | | | |

No hay publicidad ni analítica de terceros en la app. Los proveedores: Vercel, Supabase, Anthropic, OpenAI, Google, Groq, Mistral, Cerebras, OpenRouter, ElevenLabs, Meta, Stripe, Mercado Pago, Creem, Resend y Evolution.

⚠️ **A confirmar por ti:** Play pregunta por la «App access» y por el «AI-generated content». Ahí va la cuenta de revisión en inglés, y se marca que hay contenido generado por IA, con la denuncia desde el mensaje.

---

## 5. App Store: App Privacy

**¿Se recogen datos? Sí. ¿Rastreo (tracking)? No**, y por eso la app no muestra el cartel de Apple para eso: no hay publicidad ni datos cruzados con otras empresas.

Todos «asociados a la identidad» de la persona, y ninguno para publicidad.

| Categoría de Apple | Tipos | Para qué |
|---|---|---|
| Datos de contacto | Nombre, correo, teléfono, otros datos de contacto | Funcionalidad de la app |
| Contactos | Los del CRM que carga el negocio | Funcionalidad |
| Contenido del usuario | Correos o mensajes, fotos o videos, audio, atención al cliente, otro contenido | Funcionalidad |
| Compras | Historial de compras | Funcionalidad |
| Identificadores | User ID, y el token de avisos del aparato | Funcionalidad |
| Datos de uso | Interacción con el producto | Funcionalidad |
| Diagnóstico | Fallos y rendimiento | Funcionalidad, otros fines |

**Datos que no se recogen:** ubicación, salud, datos financieros (los ve la pasarela, no MaKo), historial de navegación, de búsqueda, datos sensibles.

### Las edades

**Play, cuestionario IARC:** app de empresa, sin violencia, sin sexo, sin apuestas. Comunicación entre usuarios: sí. Público objetivo: **sólo 18 y más**, con «Restrict minor access» prendido.

**Apple, cuestionario** (desde septiembre de 2026, con la pregunta de redes sociales):

| Pregunta | Respuesta | Por qué |
|---|---|---|
| Parental controls, Age assurance | No | |
| Unrestricted web access | **No** | La app sólo navega hola-mako.com (`allowNavigation`): un link de afuera abre el navegador |
| User-generated content | **No** | Community no va en la app de iPhone |
| Social media | **No** | Ídem |
| Messaging and chat | **Sí** | Chats con sus contactos |
| Advertising | No | |
| Todo lo demás (temas adultos, salud, violencia, apuestas, concursos) | No | Y Apple pide contar lo que puede decir una IA: MaKo no genera contenido para adultos |

Eso da **4+**. Como los términos piden 18 años, se sube a mano a **18+** («set a higher age rating»).

---

## 6. La UE y la ficha de «trader» (T3)

Apple pide declararlo aunque no se publique en la UE. Si se publica en los 27 países, salen públicos en la ficha la dirección, el teléfono y el correo del titular de la cuenta: **los de Leandro Tejado, no los tuyos**. **Recomendación:** arrancar sin la UE y sumarla cuando haya una dirección comercial. Lo único que cambia es el ws19 de Madrid, que sigue con la web.

---

## 7. Play: «Solicitar acceso a producción»

Se contesta al terminar los 14 días. Tres partes; lo de **[Martín]** se completa con lo que haya pasado de verdad, porque Google pregunta por la prueba real.

**Sobre la prueba cerrada**

- *¿Qué tan fácil fue conseguir testers?* Fácil. Son personas de negocios que ya usan MaKo en la web y su entorno: **[Martín: cuántos, y de dónde]**.
- *¿Cómo fue la participación?* **[Martín: cuántos la abrieron y qué usaron]**. Lo más usado fue **[el CRM, los chats y pedirle cosas a MaKo por voz]**.
- *Resumen de lo que dijeron:* **[Martín: dos o tres comentarios reales]**.

**Sobre la app**

- *¿A quién está dirigida?* Dueños y equipos de venta de negocios chicos que venden por conversación: agencias, consultores, cursos y servicios, mayores de 18 años, sobre todo en Latinoamérica y España.
- *¿Qué valor aporta?* Reemplaza tener el CRM, los chats y la IA por separado. Desde el teléfono, una persona ve qué tiene que hacer hoy y lo hace ahí mismo, por voz o con un toque, y le llegan avisos de lo que espera una decisión suya.
- *¿Cuántas instalaciones esperas el primer año?* **[Martín: elige un rango; con la base de hoy y la pauta, recomiendo «de 1.000 a 10.000»]**.

**Sobre estar lista**

- *¿Qué cambiaste por la prueba?* **[Martín: lo que se haya cambiado de verdad. Si nadie pidió nada, se dice]**.
- *¿Cómo decidiste que estaba lista?* **[N]** testers durante 14 días o más, sin errores que frenaran el uso, los avisos llegando con el ícono de MaKo, y la misma versión web que ya usan los clientes todos los días.

⚠️ Google no pide que sea perfecta: pide que la prueba haya existido. Pídeles a los testers que la abran varias veces en las dos semanas, y anota lo que digan: eso es lo que va acá.
