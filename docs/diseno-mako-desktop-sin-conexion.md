# MaKo Desktop sin conexión — el diseño (28/10/2026)

**El pedido.** Martín, 28/10, textual: «revisa las implementaciones que salieron con la llamada de Teo, por ejemplo lo de que
el servidor se caiga y que la app desktop funcione offline y luego cuando se vuelva a tener conexión se carguen las cosas».

**Qué se le dijo a Teo** (C:/dev/revisiones/teo-2810.txt):
- «si se llega a caer tenés tu aplicación de desktop, que eso funciona siempre» (00:42:00);
- «te lo guardan en tu local» (00:37:00).

**Cómo está hoy** (main 506877517):
- Sin servidor, nada anda.
- `mako-pc` sólo contesta los turnos de la IA. No guarda nada del negocio y no tiene pantalla.
- `public/sw.js` sólo muestra los avisos push. No tiene handler `fetch`, a propósito.
- La «app de escritorio» es la app web instalada (Chrome o Edge en su ventana), más el acceso «MaKo» que deja el
  instalador (`mako-pc abrir`, con `?app=1`).

Lo que sigue responde las cinco preguntas del Cerebro y reparte el trabajo en tres tandas.

---

## 1. Con qué se arma: la PWA (service worker + IndexedDB cifrado)

| | PWA (lo que ya hay + `fetch` + IndexedDB) | Electron | Tauri 2 | `mako-pc` + SQLite |
|---|---|---|---|---|
| Descarga extra | 0 MB: es el sitio. El cascarón pesa unos cientos de KB | 50-150 MB por instalador (el mismo programa medido por Hopp: 244 MiB) | 3-15 MB (Hopp: 8,6 MiB) | Ya instalado: 118 MB (41 MB comprimido) |
| RAM | La de una ventana del navegador, que ya está abierta | 100-300 MB en reposo (Hopp, 6 ventanas: 409 MB) | 20-80 MB más WebView2 (Hopp, 6 ventanas: 172 MB) | Bun en reposo, más una pantalla que no existe |
| Firma a nombre de Martín | No hace falta: no hay ejecutable nuevo | Cada versión, en Windows y en Mac | Cada versión; la de Mac pide una Mac o Codemagic | Ya pendiente (SSL.com IV, Apple individual), sin probar |
| ¿Sirve al teléfono? | Sí: la TWA de Android es Chrome. En iPhone, Capacitor con `WKAppBoundDomains` (a verificar) | No | Sólo reemplazando la TWA y Capacitor, que ya están decididos | No |
| Actualizar | Con cada deploy, sin reinstalar | Auto-updater más firma | Auto-updater más firma | Con el instalador |

**Por qué la PWA.**
- La parte difícil es la misma en las cuatro: la base local cifrada, la cola y los conflictos.
- La PWA es la única donde eso se hace una vez y sirve en la computadora y en el teléfono.
- No suma ningún programa a firmar ni a mantener.

**Por qué no `mako-pc`.**
- Su token es el de la IA de esa PC, y su regla es «la PC es sólo el cerebro, nunca las manos».
- Darle los datos del negocio cambia su modelo de seguridad.
- Es de una sola persona (la que la conectó), no tiene pantalla y no llega al teléfono.

Fuentes de los números: [Hopp, Tauri vs Electron](https://dev.to/gethopp/tauri-vs-electron-performance-bundle-size-and-the-real-trade-offs-1el4)
y [OpenReplay](https://blog.openreplay.com/comparing-electron-tauri-desktop-applications/). El de `mako-pc` está medido el
21/10/2026 (scripts/ia-pc/publicar-binarios.mts).

**Cómo no se rompe la regla vieja de `sw.js`.** La regla era: sin `fetch`, porque un caché le puede servir el HTML de una
cuenta a OTRA. Se mantiene así:
- El service worker suma `fetch` sólo para **navegaciones**.
- **Nunca guarda una respuesta del servidor.**
- Si el servidor no contesta, devuelve el **cascarón**: una página estática, igual para todos y sin un dato de nadie. Eso
  pasa sin red, con más de 25 s de espera o con un 502, 503 o 504. El plazo es largo a propósito: una página lenta no es un
  MaKo caído, y un MaKo caído contesta rápido (conexión rechazada o un 5xx).
- Los datos viven en IndexedDB, cifrados por persona (punto 3).

**Por qué el cascarón no es una página de Next.**
- El layout raíz lee la sesión (`getUsuarioActual`), así que toda página de Next sale con datos de quien la pidió.
- El cascarón son archivos estáticos en `public/sin-conexion/`: un HTML más un JS.
- El JS se arma con esbuild desde TypeScript (`lib/sin-conexion/`), con los mismos tipos que la API.
- El JS armado se commitea, y un test lo vuelve a armar y lo compara.
- El service worker lo guarda cuando hay conexión y lo renueva cuando cambia.

**Lo que cambia en `mako-pc`** (T3): `mako-pc abrir` abre MaKo en una ventana propia (`--app=` de Edge o Chrome). Es «MaKo
entero en una ventana» (f04, docs/feedback-24-10.md), y como es el mismo perfil del navegador, sin conexión abre el cascarón.

---

## 2. Qué funciona sin conexión, y qué no

**Leer** (lo de la última copia):
- **CRM:** el tablero de cada funnel y la ficha (contacto, etapa, plata, próxima reunión, últimas notas).
- **Plan:** Prioridades, Tareas por estado, Proyectos y Recurrentes.
- **Calendar:** las próximas dos semanas.
- **Second Brain y documentos:** el texto de las páginas.

**Escribir**, a la cola:
- una nota en un lead;
- una tarea nueva, marcarla hecha o moverla de estado;
- mover un lead de etapa;
- editar los textos: los campos del lead, el título y la descripción de una tarea, y una página del Second Brain.

**No puede funcionar**, porque lo hace el servidor de MaKo o un tercero:
- WhatsApp, mandar y recibir (Evolution);
- Instagram, Messenger, Meta y Ads (Zernio);
- la IA por API y el chat con MaKo. Las herramientas de MaKo corren en el servidor: tu Claude en la PC también necesita
  a MaKo para leer y escribir;
- los cobros;
- los emails;
- crear o mover un evento de Google Calendar;
- publicar una landing;
- las automatizaciones;
- importar, exportar e invitar al equipo.

**Cómo se dice en la pantalla:**
- **Cinta arriba, de 36 px:**
  - sin red: «Sin conexión · lo que ves es lo de las 10:42»;
  - con el servidor caído: «MaKo no responde · lo que ves es lo de las 10:42».
  - La cinta lleva «Reintentar».
- **Lo que necesita conexión** se ve apagado, con el motivo en una línea. Por ejemplo: «Necesita conexión: WhatsApp sale
  desde MaKo». Nunca un botón que parece andar y no anda.
- **Una escritura guardada** dice «Se sube al volver» en la misma fila, con el contador en la cinta.
- **Una acción con consecuencias** no corre sola: queda en «Espera tu OK al volver». Por ejemplo, una etapa que le manda
  un mensaje al lead o que cobra. Es la regla del teléfono: una aprobación nunca se encola (docs/diseno-mako-mobile.md,
  «Estados»).

---

## 3. Qué se guarda en la computadora, cifrado, por negocio y por persona

**La copia.**
- Una por (persona, negocio): lo que esa persona ve hoy en MaKo con su rol.
- Sale de las MISMAS lecturas del servidor, con su sesión: `tableroCrm`, `leerPlanHoyConTablero` y los tableros del
  teléfono. Así, quién ve qué es la misma regla.
- Medido el 28/10, sólo leyendo, el negocio más grande:
  - 1.173 leads, unos 455 bytes por fila en la base;
  - el Plan más grande, 630 tareas.
  - Son menos de 3 MB por negocio, y IndexedDB da GB.
- Se guarda **toda** la copia, no las 40 tarjetas por columna del teléfono.

**La llave.**
- AES-GCM de 256 bits, una **por persona y por computadora** (la DEK).
- La deriva el servidor: HKDF de `CREDENCIALES_SECRET` con el id de la persona y el de la computadora, con su propia etiqueta.
- Se la da sólo a la sesión de esa persona. Con conexión, la copia se guarda sin preguntar nada.

**Abrirla sin conexión.**
- Con la **clave de esta computadora**: 6 caracteres o más, que la persona elige UNA vez.
- PBKDF2-SHA256 con 600.000 vueltas envuelve la DEK, guardada en la computadora.
- Olvidarla no es grave: con conexión se elige otra, porque la DEK la vuelve a dar el servidor.
- Windows Hello (PRF de WebAuthn) se suma después, como atajo. Hoy pide Windows 11 25H2 y Chrome 147+, y los reportes son
  dispares ([Corbado](https://www.corbado.com/blog/passkeys-prf-webauthn)).

**Una cuenta nunca ve lo de otra.**
- La base de cada persona se nombra con un hash de su email (`mako-sc-` + SHA-256 con un prefijo fijo). ⚠️ No lleva sal y
  otra cuenta en el mismo perfil SÍ puede ver qué emails lo activaron (`indexedDB.databases()`): el cascarón tiene que
  encontrar la base sin red, así que una sal viviría en el mismo perfil (verificación de 90d6410eb). Lo que no puede es
  abrirla, y el cascarón tarda lo mismo con un email sin base que con una clave equivocada (un PBKDF2 de relleno).
- Cada registro lleva como dato asociado (AAD) `persona:negocio`. Una copia pasada de una cuenta a otra no abre.
- Sin la clave de esa persona no se descifra nada.
- El cascarón pide el email y la clave, como el login.

**Dónde está activado.** Sólo en la computadora donde la persona eligió su clave, desde Settings › Instalar la app › Sin conexión, o desde
el aviso de la primera vez. En una PC prestada no se guarda nada.

**No se guarda:**
- mientras un admin mira la cuenta de otro (`vistaDeOtro`);
- contraseñas, tokens y claves de integraciones;
- chats de WhatsApp;
- archivos y adjuntos.

**Vence y se borra.**
- «Borrar lo guardado en esta computadora», en el perfil.
- «Desconectar esta computadora», en la lista de computadoras: el servidor deja de dar la DEK, y la próxima vez que abra
  con conexión se borra la copia.
- Una copia que pasó 30 días sin volver a ver al servidor se borra sola.

---

## 4. La sincronización al volver

**La cola.**
- Vive en IndexedDB, cifrada igual, en el orden en que se escribió.
- Cada operación lleva un id único (uuid), que es su llave de idempotencia.
- El servidor guarda los ids aplicados en una tabla nueva, `sin_conexion_aplicadas` (migración, T2). Si se repite uno,
  devuelve el mismo resultado sin volver a aplicarlo.

**El orden.**
- Se suben de a una, en orden.
- Si la red se corta a mitad, se reintenta desde la que no tuvo respuesta. Si el servidor ya la había aplicado, la reconoce
  por su id y no la duplica.

**Por las mismas puertas.**
- Cada operación pasa por las MISMAS funciones que la app con conexión: los permisos, la auditoría con autor y las
  automatizaciones.
- Va con la sesión de la persona.
- La cola de una persona sólo se sube con SU sesión. Si la sesión venció, espera al login.

**Conflictos, campo por campo.**
- Cada cambio lleva, por campo, lo que la persona vio («antes») y lo que puso («después»). El servidor mira el valor de hoy:
  - **igual a «antes»:** lo aplica;
  - **igual a «después»:** no hace nada, ya estaba;
  - **otro valor:** es un conflicto. Gana lo del servidor, porque lo cambió otra persona o una automatización. La persona
    ve, por ejemplo: «Mientras no tenías conexión, Ana movió a Juan a Cerrado. Tu cambio: Llamada», con [Aplicar el mío] y
    [Dejar].
- En un texto, la persona puede **copiar** su versión antes de dejarla, para que nada se pierda. *(T2, 28/10: el diseño
  decía guardarla sola como nota; quedó en «Copiar», porque una escritura que la persona no eligió no sale.)*
- Las altas no tienen conflicto: una nota o una tarea nueva.

**Lo creado sin conexión** lleva un id. *(T2, 28/10: lo único que se crea es una tarea, y entra como BORRADOR para
confirmar en el Plan, como toda alta (lib/api-mako/areas/plan.run.ts). Un borrador no se mueve ni se edita sin
conexión, así que ningún cambio depende de otro: no hace falta el par id local → id real.)*

**Cuando el servidor la rechaza** (permiso perdido, lead borrado, dato inválido):
- Queda en «No se pudo subir», con el motivo y su texto para copiar.
- No se reintenta solo: la persona elige «Reintentar» o «Descartar».
- Las que dependen de ella caen con ella. Por ejemplo, la nota de una tarea que se rechazó.
- Las demás siguen.

**Con consecuencias** (mensaje al lead, cobro): no se aplica sola. Queda en «Espera tu OK».

**Al terminar** se baja una copia nueva.

---

## 5. Cómo se prueba

**Tests puros** (`node --test`, cada uno probado rompiéndolo):
- **El cifrado:**
  - ida y vuelta;
  - la clave equivocada falla;
  - la copia de A no abre con el AAD ni la llave de B.
- **La decisión del service worker:**
  - qué navegación recibe el cascarón;
  - que nunca guarda una respuesta del servidor;
  - que `/api`, `/l/` y `/compartido` no se tocan.
- **La cola:**
  - el orden;
  - mandar dos veces aplica una;
  - la matriz de conflictos campo por campo;
  - los rechazos y sus dependientes.

**Con un Chrome sin ventana, por CDP**, contra un servidor de prueba que sirve `sw.js`, el cascarón y una API falsa con el
mismo contrato:
1. Abrir con red: se guarda la copia.
2. `Network.emulateNetworkConditions` sin red, y recargar. Se ve el CRM con «lo de las HH:MM».
3. Escribir una nota.
4. Cortar A MITAD de la subida: la API aplica y corta antes de contestar.
5. Volver, y verificar que quedó UNA vez y en orden.
6. Además: dos personas en el mismo perfil del navegador. B no ve nada de A, ni su nombre.

**En producción**, después del deploy, con el ws3 (cliente de prueba):
1. Abrir la app.
2. Cortar el wifi.
3. Mirar el CRM y el Plan.
4. Escribir una nota.
5. Volver, y verla en el lead.

---

## Las tandas

**T1 — leer el CRM y el Plan sin conexión, con el cartel «lo que ves es lo de las HH:MM».**
- El service worker: navegaciones → cascarón, sin guardar respuestas del servidor.
- El cascarón en `public/sin-conexion/`: el tablero del CRM, la ficha y el Plan, sólo lectura.
- `GET /api/sin-conexion/llave` y `GET /api/sin-conexion/copia`.
- La copia cada 10 minutos, en las ventanas de escritorio donde la persona activó MaKo sin conexión.
- La clave de esta computadora: elegirla, y abrir con ella sin conexión.

**T2 — la cola y la sincronización** (hecha el 28/10, rama desktop-offline-t2-2810).
- La tabla `sin_conexion_aplicadas` (migración aditiva 0346).
- La subida es una server action (`app/_sin-conexion/acciones.ts`), no una ruta: pasa por las acciones del teléfono, y
  ésas llaman a `refresh()`, que sólo vale dentro de una. Lleva la idempotencia, los conflictos campo por campo, los
  rechazos y «Espera tu OK».
- Desde el cascarón se escriben: una nota, mover de etapa (sólo a donde mueve el teléfono), el nombre, el email o la
  empresa, mover una tarea de columna y una tarea nueva (como borrador).
- El título de una tarea queda para la T3: el tablero del dueño sólo se guarda con la fila entera.
- Al volver la conexión no sube nada solo. El panel «Cambios hechos sin conexión» sube con el clic de la persona.

**T3 — el resto.**
- Leer Calendar, el Second Brain y los documentos.
- Windows Hello (PRF).
- `mako-pc abrir` en una ventana propia.
- En el teléfono: la TWA y el iPhone con `WKAppBoundDomains`.
- La lista de computadoras con «Borrar lo guardado».

**Para una tanda posterior** (anotado, no es de esta):
- Martín le dijo a Teo que la app hace que se gasten los tokens de la suscripción del cliente (00:12:40). Hoy eso cubre
  sólo los chats con MaKo, y con la PC prendida.
- Landings, reels, copies, anuncios, automatizaciones y respuestas a leads siguen por clave de API (`FUERA_DE_D6B`).
- Va por separado: extender D6b a esas tabs, o corregir lo que se dice en la venta. Las respuestas a leads NUNCA van a la
  PC del cliente (AGENTS.md, tests/ia-pc-nunca-a-leads.test.ts).
- Tampoco es de acá «si se cae un servidor, pasa solo a otro» (00:41:05). Eso es infraestructura: una réplica de Supabase,
  una segunda región y una segunda instancia de Evolution.
