# Hallazgos — Ajustes (Tu cuenta y Configuración del negocio)

Lo que vive en app/perfil, app/configuraciones, app/m/cuenta, app/m/configuraciones y lib/ajustes-secciones.ts.

**Settings mirado por fin en producción (30/10/2026): el molde está bien; lo que sobraba eran repeticiones.**
- **El pedido del 24/10 volvió como «trabado hace seis días» y estaba hecho:** «Notificaciones» una vez, columna de 780 px centrada (a 1280 va de 409 a 1189 con la barra plegada), sin scroll de costado a 1280 ni a 390. Volver a «todo el ancho» habría deshecho el pedido del 25/10.
- **Lo que un test no ve y a la vista salta:** en «Tu plan», el título de la página, el de la sección y la fila decían lo mismo; Equipo vacío decía «0 personas» junto a «eres el único», con dos «Invitar», y Fiscal vacío tenía dos «Agregar»; Seguridad en el teléfono decía «Seguridad» en la barra y en el título. Cuando una sección tiene una sola fila, el título de sección sobra.
- ⚠️ **Falsas alarmas del banco, para no salir a arreglarlas:** los selects «en otra letra» son el `sans-serif` de reserva de Dropdown sin la Geist del CDN; las pantallas de /m sin estilo son por montarlas sin `data-m`; y el logo de arranque sobre /m tapa la pantalla unos segundos con el panel del navegador oculto (no se midió con el panel a la vista).
- **«Tu plan» no se ve con la sesión de super admin:** la plataforma no tiene plan. Se vio sólo en el banco.

*30/10/2026, chat «wt-integraciones» (claude1), con la sesión de Martín en el navegador de la app: sólo mirar, sin guardar nada. La flecha de la sidebar se probó y se dejó como estaba.*

**Settings en el teléfono (26/10/2026): la foto de una persona es una URL, y la leen TODOS los avatares.**
- **Un emoji de perfil no se puede guardar como texto:** `usuarios.foto_url` lo dibujan como `<img>` la barra, el equipo, los
  chats y el teléfono. Para que el selector de la app (`IdentidadPicker`: emoji · íconos · subir · quitar) sirva para el perfil
  sin tocar ningún avatar, el emoji se guarda COMO IMAGEN (un SVG en `data:`, marcado para leerlo de vuelta) y el ícono como su
  URL de Iconify (lib/foto-perfil.ts). El selector sube a `/api/perfil/avatar` (`subirA`), no al bucket de portadas: ése
  procesa una banda de 1600×420.
- **Un control que no guarda nada se lee como roto:** el encuadre de la foto del selector no tiene dónde vivir en el perfil, así
  que va apagado (`conEncuadre={false}`), igual que `conEmoji={false}` en el workspace.
- **«Tu negocio» como una sola fila hacía parecer que faltaban secciones:** estaban todas en /m/configuraciones, detrás de un
  toque. Ahora son filas de Settings, armadas por el server con la lista de la computadora (`seccionesNegocio`).
- **«Prompts» salió del índice**; su pantalla sigue en /configuraciones/prompts con su puerta (sólo la agencia). Con ella se fue
  la bandera `metodo` de `DisponiblesNegocio`, que ya no gobernaba ninguna sección.

**Quedó SIN hacer:** la entrada a los prompts de MaKo para el super admin. Hoy sólo se abre por su link: dónde va (el menú de la
foto, Platform) lo decide el chat de la barra (app/_components/nav.ts es de ese chat).

*26/10/2026, chat «Settings» (claude5). Guard: tests/settings-movil-26-10.test.ts.*

**Sacar «General» y «Método» (26/10/2026): una sección son varios datos, y cada uno tiene su destino.**
- **El diagnóstico obvio era el equivocado:** «General era sólo del super admin, no la usa nadie». Medido en producción, sólo
  leyendo: la zona del negocio (`mako.timezone`) la tienen 13 negocios, el horario del negocio 2 (Mauricio y el de prueba) y el
  criterio de reuniones UNO (Mauricio, 9.823 letras) que la extracción de reuniones y el Plan leen en cada corrida. Sacar la
  pantalla con sus datos le habría cambiado a Mauricio qué entra a su tablero sin que nadie lo decidiera.
- **Cada dato a donde se usa:** la zona del negocio, una fila de Perfil para quien administra (la MISMA acción que la tuerca de
  una automatización, `saveZonaHorarioAction`); el horario, la tuerca de cada automatización (el del negocio sigue valiendo para
  las que lo usan y la API lo sigue cambiando); el criterio, sin pantalla ni API, pero leído con su valor.
- **«Método» era una segunda puerta a las mismas credenciales:** cada servicio de `SERVICIOS_METODO` tiene su tarjeta en
  Integraciones con el mismo formulario. Las rutas `/api/metodo` quedan (las usan el onboarding y los tests de cobros, Meta y
  Zernio). La bandera `metodo` de `DisponiblesNegocio` quedó gobernando «Prompts»: el nombre se conservó para no mover a nadie.
- **Las rutas que se van redirigen con su query:** `/configuraciones` (los 49 avisos ya mandados con `?tab=notif`) y `/metodo`
  (a Integraciones, con el `?ws=` de quien mira un cliente).

**Quedó SIN hacer:**
- El criterio de Mauricio sigue prendido. Si Martín lo quiere apagado, es un cambio de DATO (borrar `plan.criterio` del negocio
  de Mauricio), no de código: no se hizo.
- El horario de oficina DEL NEGOCIO (Mauricio y el de prueba) ya no tiene pantalla: se cambia por la API o automatización por
  automatización.
- Dos comentarios de Automations siguen diciendo «Configuraciones › Horario» (app/automations/ConfiguracionesBoton.tsx y
  OnboardingChatAgent.tsx): son de ese chat.

*26/10/2026, chat «Settings» (claude5). Guard: tests/settings-sin-general-ni-metodo.test.ts.*

**El nombre del negocio, donde lo buscan (21/10/2026, Florencia, ws21).**
- **Un dato está donde lo busca quien lo quiere cambiar, no donde lo guarda el código.** Primero se sumó «Tu negocio»
  en Configuración del negocio (/configuraciones/negocio), y Martín igual lo buscó en «Perfil de Florencia»
  (/perfil?ws=21). Ahí no estaba, y lo dio por perdido. Ahora está en los dos lados, con UNA acción
  (`guardarNombreNegocioAction`) y UNA regla (lib/nombre-negocio.ts). Dos formularios con dos guardados se separan
  con el tiempo.
- ⚠️ **«Empresa» del perfil NO es el nombre del negocio** (`perfil.empresa`, un dato personal que no se ve en ningún
  lado). Al lado de «Nombre del negocio» confundía: una fila cambia el nombre en toda la app y la otra no cambia nada
  visible. Desde el rediseño de Settings (25/10/2026) no se le ofrece a quien ve «Nombre del negocio» (el admin); lo
  guardado no se borra, y a un closer o setter se le sigue ofreciendo. Vive en app/perfil/InformacionPersonal.tsx.
- **Toda sección de Configuración del negocio necesita pantalla en el teléfono o un motivo escrito**
  (tests/m-configuraciones.test.ts, `EN_LA_COMPUTADORA`): el VERDE de «Tu negocio» dio rojo por eso. Una sección nueva
  se suma en tres lugares: `SECCIONES_NEGOCIO_M`, `CLAVES_NEGOCIO_M` (lib/movil-rutas.ts) y su página en
  app/m/configuraciones/<sección>.
- **El super admin mirando un cliente es `admin` para `requireSesion`** (`getRolWsEfectivo`: `sesion.rol === 'admin'`).
  Por eso `puedeEditar` le da la fila sin una regla aparte.

**Settings copiada de Linear (25/10/2026, rediseño de las nueve pestañas; referencia en docs/settings/referencia.md).**
- **El «texto de sobra» era la COLUMNA, no las palabras.** El rediseño de la mañana del 25/10 (dos columnas como Catalyst:
  el nombre y un párrafo a la izquierda, la tarjeta a la derecha) le dio a cada sección un lugar fijo para un párrafo, y se
  llenó. Martín lo rechazó igual que a la versión anterior. Linear no tiene ese lugar: título, una línea, y secciones de
  nombre + tarjeta con filas (nombre a la izquierda, control a la derecha). Un molde sin hueco para explicar no se llena de
  explicaciones. La regla quedó en AGENTS.md («Settings: el molde de Linear»).
- **La columna CENTRADA resuelve el «cortado a la mitad» sin estirar renglones.** El reclamo del 25/10 («no llega al final
  del ancho») era una columna de 720 px pegada a la izquierda con un tercio vacío; la respuesta de dos columnas lo tapó con
  texto. Centrada (780 px en el resto del ancho, `.aj-columna`) se lee como Linear y no deja un hueco de un lado.
- ⚠️ **La zona horaria del PERFIL no gobernaba nada, y la pantalla decía que sí** («Las horas de tus avisos y del tablero
  salen de aquí»). Ningún código leía `perfil.timezone` (sólo la API de MaKo, como dato). Desde el 25/10 gobierna «No
  molestar» (lib/notif-catalogo.ts → `enSilencio`, que lib/push.ts mira con la zona de la fila de CADA persona). Antes de
  escribir para qué sirve un dato en una pantalla, buscar quién lo lee.
- ⚠️ **HorarioEnvioPanel es de DOS dueños.** Lo monta General y lo monta la tuerca de Automations, y los tests de Automations
  fijan su JSX como texto (tests/automations-config-revision.test.ts: UN `onChange={cambiarZona}`;
  tests/automations-configuraciones.test.ts: el efecto de `onSucio` ANTES de `if (!h) return`; tests/automations-decima-
  lienzo.test.ts: los días con `justifyContent: 'center'`). La cara de Settings (`filas`) reusa los MISMOS elementos (el
  selector de zona y los días como constantes) en vez de copiarlos; copiar el selector da «el huso se cambia por otro lado».
- **El celular se configura desde la computadora.** Las preferencias de push (`usuarios.perfil.notifPush`) son de la
  PERSONA, no del teléfono: lo que se elige en Settings › Notificaciones › Celular vale para todos sus teléfonos. Lo que sí es
  del teléfono es la suscripción (el permiso), y eso se activa en el teléfono. `GET /api/push/suscripcion` cuenta cuántos
  tiene, para decir «Sin teléfono» en ámbar.
- **SIN HACER (con dónde vive):**
  - Seguridad › «Cerrar sesión en los demás dispositivos» (el «Revoke all» de Linear): la sesión es un JWT sin estado
    (lib/auth.ts, lib/auth-session.ts), no hay lista de sesiones ni forma de revocar una. Pide una tabla o una marca
    `sesiones_desde` en `usuarios` que `leerSesion` compare con el `iat`: es una MIGRACIÓN (número del Cerebro) y toca el
    login de todos. Lo que hay hoy son los dispositivos RECORDADOS del segundo paso, que sí se olvidan.
  - Integraciones: sólo perdió la bajada. El tablero (app/integraciones/IntegracionesBoard.tsx, ~2.000 líneas) sigue con su
    grilla; Meta y CAPI pasan a Zernio (chat «Zernio y CAPI»).
  - «Tu plan» (chat Planes) y «Tus cuentas de IA» (/perfil/ia, chat MaKo Desktop) toman el molde solos; sus textos son suyos.
  - El teléfono (/m/cuenta, /m/configuraciones/*) conserva su diseño propio de listas (ya era el patrón de Linear mobile);
    sólo el Perfil (InformacionPersonal) es el mismo componente y cambió con la computadora.
  - El ícono de «Settings» (la tuerca) en el índice: lo define el chat Ops Center para la barra y el menú.

## «Para qué sirve» MaKo en la computadora, y Agency a la vista (6/11/2026, Recorrido visual, nube, `punta/recorrido-visual`)

- **Desktop** (Leila 5/11: no había pantalla que lo explicara): una fila «Para qué sirve» en Instalar la app abre un detalle
  (`?ver=escritorio`, leído en el server) con tres filas de una línea y las descargas al pie. Sin párrafos: Settings copia a
  Linear, y Martín rechazó dos versiones por textos de más (25/10).
- **Agency** (Leila 5/11: más a la vista desde el menú del perfil): Partners y Agency suben justo debajo de Settings. La primera
  versión puso Agency arriba de Partners y contradecía el «abajo de Partners» de Martín del 25/10: el orden entre las dos es suyo.

**Vive en:** app/perfil/instalar/InstalarApp.tsx, app/perfil/instalar/page.tsx, app/_components/nav.ts, tests/recorrido-instalar-agency.test.ts
