# Hallazgos — Ajustes (Tu cuenta y Configuración del negocio)

Lo que vive en app/perfil, app/configuraciones, app/m/cuenta, app/m/configuraciones y lib/ajustes-secciones.ts.

**El nombre del negocio, donde lo buscan (21/10/2026, Florencia, ws21).**
- **Un dato está donde lo busca quien lo quiere cambiar, no donde lo guarda el código.** Primero se sumó «Tu negocio»
  en Configuración del negocio (/configuraciones/negocio), y Martín igual lo buscó en «Perfil de Florencia»
  (/perfil?ws=21). Ahí no estaba, y lo dio por perdido. Ahora está en los dos lados, con UNA acción
  (`guardarNombreNegocioAction`) y UNA regla (lib/nombre-negocio.ts). Dos formularios con dos guardados se separan
  con el tiempo.
- ⚠️ **«Empresa» del perfil NO es el nombre del negocio** (`perfil.empresa`, un dato personal que no se ve en ningún
  lado). Al lado de «Nombre del negocio» confunde: una fila cambia el nombre en toda la app y la otra no cambia nada
  visible. PENDIENTE (el Cerebro pidió lo mínimo el 22/10): la propuesta es no ofrecer «Empresa» a quien ve «Nombre del
  negocio» (el admin), sin borrar lo guardado. Vive en app/perfil/InformacionPersonal.tsx.
- **Toda sección de Configuración del negocio necesita pantalla en el teléfono o un motivo escrito**
  (tests/m-configuraciones.test.ts, `EN_LA_COMPUTADORA`): el VERDE de «Tu negocio» dio rojo por eso. Una sección nueva
  se suma en tres lugares: `SECCIONES_NEGOCIO_M`, `CLAVES_NEGOCIO_M` (lib/movil-rutas.ts) y su página en
  app/m/configuraciones/<sección>.
- **El super admin mirando un cliente es `admin` para `requireSesion`** (`getRolWsEfectivo`: `sesion.rol === 'admin'`).
  Por eso `puedeEditar` le da la fila sin una regla aparte.
