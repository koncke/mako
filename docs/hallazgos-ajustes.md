# Hallazgos — Ajustes (Tu cuenta y Configuración del negocio)

Lo que vive en app/perfil, app/configuraciones, app/m/cuenta, app/m/configuraciones y lib/ajustes-secciones.ts.

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
