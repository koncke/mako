# Relevo — Settings (chat «Settings», cuenta 5, 25/10/2026)

Pedido de Martín (25/10 ~12:00): rediseñar TODAS las pestañas de Settings, en diseño y en función, copiando cómo lo hacen
otras apps y sin textos de sobra. Rama `settings-2510` (worktree `C:/dev/wt-settings-2510`), sin pushear: la sube el Cerebro.

## Qué quedó

**Referencia: los ajustes de Linear** (docs/settings/referencia.md, capturas en docs/settings/referencias/). El molde es
app/_ui/Ajustes.tsx + ajustes.css: índice a la izquierda, columna centrada, título sin bajada, secciones de nombre + tarjeta
con filas (`FilaAjustes`: nombre a la izquierda, control a la derecha; `ancho` baja el control debajo en el teléfono),
`PuntoEstado`, `SELECT_AJUSTES` para los selects, todo guarda al instante.

| Pestaña | Commit | Qué cambió de función |
|---|---|---|
| Perfil | tanda 1 | Campos en la fila que guardan al salir; zona horaria con la lista entera; Tema; «Empresa» fuera para el admin |
| Notificaciones | tanda 1 | Canales (En la app · Celular · WhatsApp · Email) con estado y detalle; «Enviar prueba» en cada uno; el celular desde la computadora; «No molestar» (respetado por lib/push.ts) |
| Seguridad | tanda 2 | Estado de cada forma de entrar a la derecha; el cartel general sólo si falta algo; detalles sin párrafos |
| Instalar la app | tanda 2 | Sólo textos (la descarga de escritorio es del chat MaKo Desktop) |
| General | tanda 2 | Horario de envío en filas (`HorarioEnvioPanel filas`); Criterio en su tarjeta |
| Equipo | tanda 3 | «Invitar» en un modal; filas con rol y «⋯»; buscar con más de 5 |
| Identidades fiscales | tanda 3 | Moneda en una fila; razones sociales con «⋯»; alta y edición en un modal |
| Método | tanda 3 | La lista de servicios con su estado y un detalle por servicio, en vez del asistente de 20 pasos |
| Integraciones | tanda 3 | Sólo el marco (sin bajada). El tablero, Meta y CAPI son de otros chats |

## La API

Todo lo que Settings deja ver o cambiar está en la API de MaKo (área `equipo`), con la tabla pestaña por pestaña y lo que NO
va (cambiar la seguridad, las credenciales de Método, la foto, el tema) en docs/settings/referencia.md, «La API». Once
operaciones nuevas; test: tests/api-mako-settings.test.ts. La tuerca del índice es `IconoMenu configurar` (la dibuja la rama
del Ops Center).

## Cómo se miró

Un banco con los componentes reales (esbuild) y las APIs simuladas, en Chrome headless, a 1280 y 390, con clics (guardar en
el lugar, Escape, prueba de aviso, «No molestar», invitar, «⋯», detalle de Método). El «antes» con los archivos de
origin/main y los mismos datos (docs/hallazgos-ui.md). Capturas: carpeta de notas del Cerebro, `settings-capturas/`.
**No se miró en la app levantada** (sin RAM para un build): falta recorrerlo en producción después del deploy.

## Integraciones de punta a punta (segunda tanda, rama `integraciones-2510`)

Pedido de Martín (25/10 tarde, docs/feedback-25-10-tarde.md), por el Cerebro. Lo que quedó:
- **Nombres reales:** Resend, Anthropic API, OpenAI API, Gemini API, Groq API (catálogo de tarjetas y de campos). Zernio lo
  lleva su chat. El Pixel de MaKo lleva la estrella de MaKo.
- **Las IA fuera de la grilla:** `oculto` en el catálogo; viven en «Tus cuentas de IA» → «Claves de API» (las cuatro, con su
  estado). Anthropic y OpenAI abren «¿Cómo la conectas?» (clave o computadora, el MISMO tutorial de MaKo Desktop) con un «?»
  que dice en una línea que no es lo mismo; Gemini y Groq abren directo el modal de la clave, sin «Pronto».
- **Hotmart, Skool y Apify:** salieron enteros (el Leads Scraper: webhooks, /crm/prospectos, dos operaciones de la API).
  Medido antes: 0 uso. Guard: tests/leads-scraper-retirado.test.ts.
- **Google Calendar:** sin tarjeta (`oculto`); se conecta en Calendario y el CRM; las 7 agendas conectadas siguen. El login
  con Google la pide con `GOOGLE_LOGIN_CON_AGENDA=1`, APAGADO hasta que Google verifique la app.
- **Sin conectar en gris** (`data-sin-conectar`), y `?abrir=<key>` de una oculta abre su modal suelto.
- Guards: tests/integraciones-limpieza-25-10.test.ts. Hallazgos: docs/hallazgos-integraciones.md (la primera entrada).

## Sin «General» ni «Método» (tercera tanda, 26/10, sobre tren-k)

Pedido de Martín por el Cerebro: «Elimina la tab General... Elimina Método... fijate el icono de integraciones... Parece un
link». Lo que quedó:
- **General salió:** la zona del negocio es una fila de Perfil («Zona del negocio», para quien administra); el horario vive en la
  tuerca de cada automatización; el criterio de reuniones, sin pantalla ni API, sigue leído con su valor (sólo lo tiene
  Mauricio). /configuraciones redirige (el `?tab=` de los avisos sigue cayendo en su lugar).
- **Método salió:** cada credencial ya tenía su tarjeta en Integraciones. /metodo redirige ahí con la query. «Prompts» sigue con
  la regla de la plataforma (`metodo`).
- **Integraciones con un enchufe** (`enchufe`, en el set de iconos-menu), en la computadora y en el teléfono.
- **API:** salen `ver_criterio_reuniones` y `guardar_criterio_reuniones` (y sus rutas REST); el horario del negocio sigue
  (`ver_`/`configurar_horario_envio`), sin la mención a Settings › General. Docs, snapshot y plugin regenerados.
- Guard: tests/settings-sin-general-ni-metodo.test.ts (13 roturas cazadas). Hallazgos: docs/hallazgos-ajustes.md (la primera).

## Settings en el teléfono (cuarta tanda, 26/10, rama `settings-movil-2610` desde origin/main ede2bbaab)

Pedido de Martín desde su Android. Lo que quedó:
- **El sol/luna en la cabecera** de Settings (`InterruptorModo` variante «cabecera»); sin la fila «Modo oscuro» ni «Tema» en Perfil.
- **«Tu negocio» directo** en la lista (Equipo, Integraciones, Identidades fiscales, Tu plan), no una fila que abría otra pantalla.
- **«Cerrar sesión»** sola, en rojo, con el ícono de salir (`CerrarSesion` variante «fila»).
- **Los desplegables que se cerraban solos:** era el teclado (`resizes-content` + el Dropdown cerraba en todo `resize`). Ahora
  reubica, y al tacto el buscador no se enfoca solo. Ver docs/hallazgos-ui.md (la primera entrada).
- **La foto de perfil** grande abre `IdentidadPicker` (emoji · íconos · subir · quitar); el emoji y el ícono se guardan como imagen.
- **«CEO»** de ejemplo en Cargo. **«Prompts»** fuera del índice (la pantalla sigue en /configuraciones/prompts).
- Guard: tests/settings-movil-26-10.test.ts.

## La agenda al entrar con Google, lista para prender (quinta tanda, 26/10, rama `google-agenda-2610`)

Google aprobó la app (Martín, 26/10). La política de privacidad lee el MISMO interruptor que el login y dice lo que hace hoy
(app/privacidad/page.tsx). Guard: tests/privacidad-agenda-login.test.ts.

**EL PASO QUE FALTA (configuración de producción, no código):** poner `GOOGLE_LOGIN_CON_AGENDA=1` en Vercel → Production y
redesplegar. Lo pide el Cerebro a Martín cuando esta rama esté en main. Con eso, el login pide el calendario (destildable) y
la política pasa sola a «una sola vez, al entrar».

## Pendiente (detalle en docs/hallazgos-ajustes.md y docs/hallazgos-integraciones.md, «SIN HACER»)
- `GOOGLE_LOGIN_CON_AGENDA=1` en Vercel (arriba).
- La entrada del super admin a los prompts de MaKo (hoy sólo por su link): dónde va lo decide el chat de la barra.
- El criterio de reuniones de Mauricio sigue prendido: apagarlo es un cambio de dato (no se hizo).
- Seguridad › cerrar las demás sesiones: pide una migración (la sesión es un JWT sin estado).
- Prender `GOOGLE_LOGIN_CON_AGENDA`: con la verificación de Google aprobada y la política de privacidad reescrita.
- La lectura de un @ por Apify de la plataforma (lib/instagram-perfil-server.ts), dormida: la decide el CRM.
- Recorrer Settings e Integraciones en producción (1280 y 390) apenas se despliegue.
