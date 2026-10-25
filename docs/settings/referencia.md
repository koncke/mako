# Settings — la referencia y el inventario (25/10/2026)

Pedido de Martín (25/10, ~12:00): «Te pedí un rediseño completo de todas esas tabs… Tanto en diseño como en funcionalidad.
Fijate como lo hacen otras apps y hazlo bien.» Lo que rechazó: los párrafos antes de cada configuración (la columna de la
izquierda con «Aparece en los chats…») y Notificaciones, que «se ve como antes, solo le agregaste más texto».

## La referencia: los ajustes de Linear

Se miraron Linear, Vercel, Notion, Stripe, GitHub y Slack. **Se copia Linear** (Settings › My Account y Workspace), porque es
la que resuelve con menos texto lo que Martín pide: un título, y debajo la configuración. Vercel y Stripe explican cada tarjeta
con un párrafo y un «Save» por tarjeta; GitHub es una página larga de formularios; Notion abre los ajustes en un modal.

Capturas en `docs/settings/referencias/` (de linear.app/docs, 25/10/2026):

| Captura | Qué muestra |
|---|---|
| `linear-ajustes.png` | La página entera: el índice con dos grupos (Workspace / My Account) y la columna centrada. |
| `linear-preferencias.png` | Preferences: secciones con su nombre y una tarjeta con filas; cada fila, su nombre a la izquierda y el control a la derecha. |
| `linear-notif-canales.png` | Notifications › los canales: una fila por canal con su estado («Enabled for…», «Disabled») y la flecha. |
| `linear-notif-eventos.png` | El detalle de un canal: el interruptor del canal, «Send test notification» y un interruptor por tipo de aviso. |
| `linear-seguridad.png` | Security & Access: la sesión actual, las otras con «Revoke all», y las passkeys. |

### Qué se copia, y de dónde

| De Linear | En MaKo |
|---|---|
| El índice: «Settings» y dos grupos con su nombre chico | «Tu cuenta» y «Tu negocio» (ya existían; cambia el dibujo). |
| La columna de lectura **centrada** (~800 px), no pegada a la izquierda | Todas las pestañas. Resuelve el «cortado a la mitad» del 25/10 sin la columna de textos. |
| Título de la página, una línea divisoria, y nada más | Se borraron todas las bajadas («Tus datos y cómo te contactan…»). |
| Sección = su nombre (sin párrafo) + una tarjeta con filas | `GrupoAjustes` dejó de tener la columna de la izquierda. |
| Fila = nombre (y, si suma, una línea gris) a la izquierda; el control a la derecha | `FilaAjustes`. Controles: interruptor, select, campo en el lugar, botón de texto. |
| **Se guarda al instante**, sin botón «Guardar»; un aviso chico confirma | Perfil (al salir del campo o con Enter), Notificaciones, Preferencias. |
| Notifications: canales con su estado y su punto verde/gris → detalle por canal | En la app · Celular · WhatsApp · Email. |
| El detalle de un canal: interruptor del canal, **«Enviar prueba»**, un interruptor por aviso | Los cuatro canales. |
| Security: la sesión actual arriba, las otras en lista con «Cerrar todas» | Seguridad › Dispositivos (tanda 2). |
| Members: invitar arriba, una fila por persona con su rol en un select | Equipo (tanda 3). |

Lo que **no** se copia: el modo oscuro propio de Linear (MaKo usa sus tokens, claro y oscuro salen solos), su tipografía (Geist
de la casa), y que los ajustes reemplacen a la barra de la app (en MaKo la barra queda).

De **Slack** se toma una sola cosa que Linear no tiene: **«No molestar»** con un horario (Preferences › Notifications ›
Notification schedule), porque MaKo manda avisos al celular a toda hora.

## Inventario de función, pestaña por pestaña

✅ = estaba y queda · ➕ = se suma · ➖ = sale · ⏳ = otra tanda o de otro chat

### Perfil (/perfil) — tanda 1
- ✅ Foto (subir, cambiar, quitar), nombre, cargo, teléfono con país, correo (sólo lectura), nombre del negocio (admin).
- ✅ Empresa, sitio web y «sobre ti»: no se ven en ningún lado de la app, pero MaKo los lee (`/api/v1`, área equipo). Quedan,
  juntos en «Sobre ti», sin protagonismo.
- ➖ «Empresa» a quien ve «Nombre del negocio» (el admin): confundía (docs/hallazgos-ajustes.md). Lo guardado no se borra.
- ➕ **Se edita en el lugar** (como Linear): el campo ya está en la fila, guarda al salir. Antes, cada fila abría un formulario
  con «Guardar» y «Cancelar».
- ➕ Zona horaria con **la lista entera de países** (la misma de Horario de envío) y la del navegador sugerida primero. Antes,
  seis zonas fijas.
- ➕ **Tema** (claro u oscuro), la misma preferencia del botón de la barra.
- ➖ El texto «Las horas de tus avisos y del tablero salen de aquí»: era falso (la zona personal no gobernaba nada). Ahora
  gobierna «No molestar».
- Idioma: MaKo no tiene traducciones; un selector que no cambia nada sería una pantalla de mentira. No se ofrece.

### Notificaciones (/perfil/notificaciones) — tanda 1
- ✅ Pop-up y sonido de los avisos de la app; a quién le llegan los avisos del negocio por WhatsApp y por email (admin).
- ➕ **Los canales como en Linear**: En la app · Celular · WhatsApp · Email, cada uno con su estado y su detalle.
- ➕ **Celular desde la computadora**: qué avisos te llegan al teléfono (antes sólo desde el teléfono, /m/cuenta).
- ➕ **Enviar prueba** en cada canal: un pop-up de prueba, un aviso al teléfono (`/api/push/prueba`).
- ➕ **No molestar**: un horario en el que no llegan avisos al celular (en tu zona horaria). Se guarda en
  `usuarios.perfil.notifPush.silencio` y lo respeta `enviarPush` (lib/push.ts).
- ➖ Los textos de cada sección («El aviso que salta y su sonido, en este navegador. Es sólo tuyo…»).
- ➖ «En tu celular → Instalar la app» como sección suelta: vive adentro del canal Celular.

### Seguridad (/perfil/seguridad) — tanda 2
- ✅ Segundo paso (app, llaves de acceso, WhatsApp, email), contraseña, códigos de recuperación, dispositivos recordados.
- ➕ Linear: la sesión actual arriba y «Cerrar las demás».
- ➖ La tarjeta grande del escudo pasa a una fila de estado.

### Instalar la app (/perfil/instalar) — tanda 2
- ✅ Teléfono (QR y pasos), computadora, extensión. ⏳ La app de escritorio y su descarga son del chat «MaKo Desktop».

### General (/configuraciones) — tanda 2
- ✅ Nombre del negocio, moneda, horario de envío, criterio de reuniones, etiquetas, teléfonos, Google Calendar.

### Equipo (/equipo) — tanda 3
- ✅ Invitar, rol, quitar. ➕ Linear: invitar en un modal, buscar, «Invitación pendiente» con reenviar.

### Integraciones (/integraciones) — tanda 3
- ⏳ Meta y CAPI pasan a Zernio (chat «Zernio y CAPI»). ⏳ «Tus cuentas de IA» y conectar la computadora (chat «MaKo Desktop»).
  Se rediseña el marco de la pantalla.

### Identidades fiscales (/configuraciones/fiscal) y Método (/metodo) — tanda 3
- ✅ Alta, edición y la identidad por defecto; las credenciales de la plataforma.

### Tu plan (/configuraciones/plan)
- ⏳ Es del chat «Planes». Toma el molde nuevo solo.
