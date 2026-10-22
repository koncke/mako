# Hallazgos — Ajustes (Tu cuenta y Configuración del negocio)

Lo que vive en app/perfil, app/configuraciones, app/m/cuenta, app/m/configuraciones y lib/ajustes-secciones.ts.

**El nombre del negocio, donde lo buscan (21/10/2026, Florencia, ws21).**
- **Un dato está donde lo busca quien lo quiere cambiar, no donde lo guarda el código.** Primero se sumó «Tu negocio»
  en Configuración del negocio (/configuraciones/negocio), y Martín igual lo buscó en «Perfil de Florencia»
  (/perfil?ws=21). Ahí no estaba, y lo dio por perdido. Ahora está en los dos lados, con UNA acción
  (`guardarNombreNegocioAction`) y UNA regla (lib/nombre-negocio.ts). Dos formularios con dos guardados se separan
  con el tiempo.
- ⚠️ **«Empresa» del perfil NO es el nombre del negocio.** Es `perfil.empresa`, un dato personal que no se ve en ningún
  lado de la app. Al lado de «Nombre del negocio», una fila cambia el nombre en toda la app y la otra no cambia nada
  visible. Para quien puede cambiar el nombre (el admin del negocio, o el super admin mirando) se muestra «Nombre del
  negocio» en el lugar de «Empresa» (`muestraEmpresa`). El resto del equipo sigue viendo «Empresa». Lo guardado no se
  borra.
- **Toda sección de Configuración del negocio necesita pantalla en el teléfono o un motivo escrito**
  (tests/m-configuraciones.test.ts, `EN_LA_COMPUTADORA`): el VERDE de «Tu negocio» dio rojo por eso. Una sección nueva
  se suma en tres lugares: `SECCIONES_NEGOCIO_M`, `CLAVES_NEGOCIO_M` (lib/movil-rutas.ts) y su página en
  app/m/configuraciones/<sección>.
- **El super admin mirando un cliente es `admin` para `requireSesion`** (`getRolWsEfectivo`: `sesion.rol === 'admin'`).
  Por eso `puedeEditar` le da la fila sin una regla aparte.
