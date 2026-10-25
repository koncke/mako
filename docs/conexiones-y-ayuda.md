# Conexiones: MaKo dice qué falta, da el link justo y ofrece ayuda (25/10/2026)

**El pedido.** Martín, 25/10/2026, por el audio de Florencia (clienta, «Florencia Ayelen Carballo»), trabada porque MaKo le pedía
«conectar no sé qué cosa»:
- «que podamos implementar la API de MaKo en MaKo en WhatsApp también y que si detecta que alguien le falta una conexión o algo que
  le ofezca ayuda, que le de el link y que le pregunte si quiere que le ayude con eso... Revisa si MaKo tiene la info de toda la app
  de como conectar cada cosa, y mas ahora que vamos implementando nuevas cosas como Zernio... Y también si los modales de conexión
  tienen su URL propia»
- «creo que le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que todo eso se hace con la app de escritorio de
  MaKo y conectado a su claude o GPT»
- «si hay algo que falta, que esta mal conectado, un bug o lo que sea, que le proponga levantar un ticket... Levantar un ticket
  siente que ser facil para el usuario»

Se midió con un relevamiento de cuatro lectores, un diseñador y un crítico que verificó en el código. Lo largo quedó en el
scratchpad del Cerebro; acá queda lo que decide y lo que se reparte.

## Lo que se midió (y lo que NO era)

- **No era el audio.** En el grupo de MaKo de Florencia hay UN solo mensaje suyo, de texto, del 22/10: «Estas analizando mis
  fathom?». Sus notas de voz están en el chat del onboarding (18/10) y en el WhatsApp personal de Martín (25/10). La cola del
  grupo no se borra (`lib/mako-doer-buffer.ts`), así que si mandó audios al grupo, no llegaron.
- **Qué le contestó MaKo (22/10).** «⚠️ No puedo contestar: esto lleva datos de tus clientes, y sin una IA tuya no los mando a la
  IA gratis de MaKo, que entrena con lo que recibe. Conecta tu propia API key de IA y lo hago 👇» con
  `/integraciones?abrir=gemini&ws=21`. Le dio un motivo que ya no aplica, le pidió una «API key», le abrió GEMINI y no dijo nada
  de Fathom, que era lo que preguntaba. **El texto no quedó guardado en ningún lado**: se reconstruyó desde el código de esa hora.
- **El aviso del Desarrollador (24/10)** nombró «tu Claude, tu GPT o tu Gemini, y también Fathom» con UN solo link, el de Claude.
- **A su negocio le falta todo:** 0 claves de IA, 0 computadoras emparejadas, sin Fathom. El crédito del onboarding venció con el
  onboarding (18/10).
- **Hoy, con un audio, MaKo le diría «tu Gemini o tu GPT» con `?abrir=gemini`.** Es el «conecta tu Gemini» que vio Martín.
- **MaKo Desktop no le resolvía el grupo:** el doer de WhatsApp no mira la computadora (`lib/mako-doer-in.ts`, `.suIA` sin `conPc`).
  Peor: con la computadora conectada y sin clave, el grupo diría «tu negocio todavía no tiene su IA conectada», que es falso.
- **El login perdía la query** (`proxy.ts`, `denegar`): un link `?abrir=fathom` abierto sin sesión terminaba en integraciones sin
  el modal. Ya está arreglado en `zernio-2510` (0024e38ce, `tests/login-next-con-query.test.ts`).
- **`?abrir=<key>` ya abre el modal de cada integración**, y `?servicio=` también (docs/hallazgos-integraciones.md decía que no).
  «Tus cuentas de IA» no tiene link propio.
- **Lo que MaKo sabe de cómo conectar cada cosa está escrito en ocho lugares que ya se contradicen** (integraciones-catalogo,
  metodo-catalogo, servicio-slides, tab-activacion, hechos-mako —sólo 3 URLs: meta, anthropic, landing—, mako-capacidades,
  `DEEP_LINKS` del doer, la expresión de intención, que todavía nombra «chatwoot»). Fathom, Zernio y MaKo Desktop no están en lo
  que MaKo recibe.

## Lo que decide el Cerebro (Martín: «no hagas preguntas»)

1. **Ningún texto le ofrece Gemini como «su IA».** Se ofrece MaKo Desktop con su Claude para la app (y el grupo, punto 2) y
   ChatGPT por clave para lo que corre solo. La única excepción es el buscador de conocimiento, que hoy embebe con Gemini
   (`lib/embeddings.ts`): se decide aparte y nunca se dice «conecta tu Gemini» en un cartel. Reemplaza lo del 22/10 que sumaba
   Gemini como «su IA».
2. **El grupo de MaKo del DUEÑO va a su computadora**, igual que el chat de la app: sólo si el que escribe es la persona que
   conectó esa computadora y la computadora está en línea. Nunca un lead, un cron, un webhook ni Automations: la regla de la PC
   (`AGENTS.md`, D6a; memoria `pc-cliente-nunca-a-leads`) sigue entera para todo eso. Martín: «todo eso se hace con la app de
   escritorio de MaKo». Se reescriben `AGENTS.md` (D6a), `lib/conectar-ia-reglas.ts` y `docs/ia-del-cliente.md` con esa cita, y la
   prueba de identidad dentro de `encolarTurno` pasa a ser «el teléfono del que escribe es de la persona que conectó esa PC».
3. **Lo que corre solo necesita una clave** (es la misma regla): leer los Fathom sin que nadie lo pida, las notas de voz (Claude no
   escucha audio) y el análisis de llamadas del Closing (hoy, Claude por clave). El cartel lo dice así, con el link de cada cosa.
4. **Un solo catálogo de conexiones**, `lib/conexiones-catalogo.ts`, puro, montado sobre `DEFS` de `metodo-catalogo` (no una
   novena lista): servicio → cómo se conecta, link, quién puede, qué destraba, pasos. De ahí salen los carteles, lo que MaKo sabe
   (`hechos-mako`, `mako-capacidades`, el doer) y la API de MaKo. Test: toda key de `DEFS` tiene su entrada, y ningún texto para
   el usuario manda «/integraciones» suelto.
5. **Los links son contrato:** `/integraciones?abrir=<key>`, `/perfil/ia` y `/chats?conectar=whatsapp`. Un rediseño los conserva
   (regla en `AGENTS.md`). «Tus cuentas de IA» gana `?abrir=ia`. Una key desconocida avisa «No encontré "x"» en lugar de ignorarla.
   Desde el celular, lo que se hace en la computadora lo dice en una línea.
6. **Ofrecer ayuda:** todo cartel de «te falta X» termina con «¿Quieres que te ayude a conectarlo? Responde «sí»». La oferta se
   guarda 30 minutos; el «sí» abre una guía paso a paso sacada del catálogo (sin IA, con el molde de `lib/agenda-sin-ia.ts`), y
   «listo» verifica la conexión. MaKo nunca pide una clave por el chat.
7. **Ofrecer un ticket:** si algo falta, está mal conectado o falló, MaKo ofrece «¿Levanto un ticket para que lo revisemos?
   Responde «sí»» y lo arma solo con lo que ya sabe (negocio, qué falló, el error). Nada de formularios. Es la Ticketera de usuarios
   (docs/diseno-ticketera-usuarios.md), que desde el 17/10 tenía pendiente WhatsApp.
8. **Cada cartel guarda su texto**, para que el vigía y el Cerebro lean lo que le llegó a la persona.

## El reparto

| Tanda | Qué | Chat |
|---|---|---|
| 0 | El mensaje a Florencia | Martín, hoy |
| 1 | Carteles del grupo sin Gemini; con computadora no mienten (`conPc` también en el camino del audio); `ia_lenta` y `sin_respaldo` sin Gemini; guardar el texto | MaKo en WhatsApp (nuevo, 25/10) |
| 1b | El login conserva la query | Zernio y CAPI: hecho (0024e38ce) |
| 2 | API de MaKo: `falta: {servicio}` en los runners, `ver_ia_del_negocio`, `como_conectar`, `ver_integracion` con pasos; `hechos-mako` y la intención desde el catálogo | MaKo en WhatsApp |
| 3 | El catálogo único y sus tests; `?abrir=` como contrato; avisos del board | MaKo en WhatsApp |
| 3d | `?abrir=ia`, `TusCuentasIA.tsx`, `/perfil/ia`, la puerta de la PC para el grupo (`lib/ia-pc*`) y que `app=1` sobreviva al login nuevo | MaKo Desktop |
| 4 | El grupo del dueño a su computadora (punto 2) | MaKo en WhatsApp + MaKo Desktop (la puerta) |
| 5 | Ayuda guiada y ticket por WhatsApp (puntos 6 y 7) | MaKo en WhatsApp |

`lib/fallo-ia-texto.ts` y el doer los toca sólo «MaKo en WhatsApp»; `lib/ia-pc*` y «Tus cuentas de IA», sólo MaKo Desktop;
`proxy.ts` (`denegar`) ya lo cambió Zernio; las pantallas de Settings, sólo Settings.

## Sin confirmar

- Si Florencia mandó audios al grupo y no llegaron (no hay traza).
- La calidad de leer reuniones con `gpt-4o-mini` (el catálogo de modelos advierte que cambiar de modelo bajó la precisión de 74 % a
  46 %): se mide con una reunión real antes de prometerlo.
- Que el grupo con sólo una clave de Claude conteste turnos con herramientas (hoy Claude entra sólo en turnos sin herramientas).
