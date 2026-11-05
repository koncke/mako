# Encargo: la tab Customers de SuperAdmin pasa a ser Admin, entera de nuevo (5/11/2026)

Lo escribió el Cerebro. Es para la sesión de la nube que lo construya, que no vio la conversación ni ve producción ni la memoria de Martín. Lo que hace falta de ellas está acá.

## El pedido, textual

Martín: «me gustaría que puedas rever completamente la tab que hoy en día se llama Customer dentro de Super Admin, que se llame Admin directamente, y que puedas revisar cómo lo hacen otras aplicaciones que lo copies completamente de otras aplicaciones. Si tienes que borrar absolutamente todo lo que hay en esa tab para hacerlo de vuelta, no tengo ningún problema. Pero sí quiero que esa tab sea fácil de utilizar y que realmente me dé las cosas que necesito. Por ejemplo, qué acciones hacen los usuarios dentro de MaKo, cuándo es que se conectan, qué no están utilizando, qué se están utilizando, cuándo la app se crashea o los bugs que tienen, el reporte, el tema obviamente de lo que sería suscripciones, lo que sería tema de cobros, gestión de usuarios, estado de alta, etcétera. O sea, todo eso, pero quiero de que sea muy completo y que lo copies como siempre de otro software o de un repo de GitHub o algo así.»

Y antes: «en SuperAdmin yo no estoy pudiendo ver por ejemplo, no se me refleja la cantidad de ingresos para suscripciones. ¿Cuánto es lo que me pagaron totalmente? ¿Cuánto me van pagando mes a mes? Etcétera.»

## Lo que tiene que dar la tab

1. **Actividad:** qué hacen los usuarios, cuándo se conectan, quién dejó de entrar.
2. **Uso:** qué se usa y qué no, por tab y por negocio.
3. **Errores:** cuándo se cae la app, qué bugs tienen, y los reportes (tickets).
4. **Ingresos:** cuánto pagó cada uno en total, cuánto entra mes a mes, MRR, y los movimientos (nuevo, sube, baja, corte, vuelve). Tiene que sumar lo que entra por pasarela y lo que entra a mano (Binance, transferencia).
5. **Cobros:** suscripciones, deudas, próximos cobros, recibos.
6. **Usuarios:** gestión, estado de alta (invitado, activo, suspendido), entrar a inspeccionar, suspender.

## Lo medido en producción (5/11/2026), que desde la nube no se ve

- **Por qué los ingresos no se reflejan:** `lib/clientes-plataforma.ts` calcula el MRR con los cobros reales de pasarela, y `cobros` tiene 2 filas en toda la base, las dos pendientes. Todo lo que Martín cobró hasta hoy entró a mano y vive en otro lado: en `pagos`, en los leads del CRM del negocio 9. Y ahí `suscripcion_monto_usd` está vacío en los tres clientes, así que `getMrrActivo` tampoco lo suma.
- **Lo cobrado de verdad:** octubre, Leila US$97, Código US$146, Florencia US$97. Noviembre, Código US$238 en dos pagos por Binance, todavía sin cargar en el CRM. Una pantalla que no muestre esos números está mal.
- **Tablas con datos de uso que ya existen (estimación del catálogo, puede estar vieja):** `errores_app`, `lead_audit` (~18.900), `credenciales_auditoria` (291), `mfa_eventos`, `ticket_eventos` (272), `tickets` (51), `offer_sesiones`, `agente_sesiones`, `chat_eventos`, `replay_sesiones` (377, grabaciones con rrweb), `curso_accesos`. `usuarios.ultimo_login` y `usuarios.sesiones_desde`.
- **Lo que no aparece como tabla:** un registro general de «qué hizo cada usuario» ni de qué pantallas abre. Martín lo pidió el 13/10: «Yo como SuperAdmin quiero tener registro de todas las acciones que hace un usuario», escrito en los puntos por donde pasa todo (las server actions, `ejecutarOperacion` de la API de MaKo y los borrados), con quién, qué, sobre qué, antes y después, cuándo y desde dónde; un borrado guarda la foto de lo borrado.

Más medición en camino: `docs/relevo/admin-medicion.md` (filas reales, qué se llena y qué no, qué usa cada negocio). Hacé `git fetch origin main` y miralo antes de cerrar el diseño. Si no llegó, seguí y dejá dicho qué supusiste.

## Lo que hay que entregar, en este orden

**1. La investigación, en `docs/investigacion-admin.md`, corta de leer.** Cómo resuelven esto: **Stripe Dashboard** (cliente, pagos, suscripciones), **Baremetrics y ChartMogul** (ingresos y movimientos), **PostHog y Amplitude** (uso, personas, actividad, retención), **Intercom** (el perfil de una persona), **Sentry** (errores agrupados), y paneles abiertos en GitHub. **Termina eligiendo qué se copia y de dónde, sección por sección.** No se le pregunta a Martín: AGENTS.md dice que ninguna pantalla se diseña de cero, y hay que copiar tal cual, con animaciones, antes de adaptar.

**⚠️ Código de GitHub: sólo con licencia que lo permita (MIT, Apache, BSD), y conservando el aviso. Las AGPL (Cal.com, Plane, Documenso y otras) sirven para mirar, nunca para copiar código. Decí la licencia de lo que uses.**

**2. La medición que falte.** Lo mínimo para que Actividad, Uso y Errores tengan datos: un registro de acciones y de pantallas abiertas, por lotes, sin frenar a nadie y sin llenar la base (con retención), y el error de la app cayendo en `errores_app` si hoy no llega. Un registro que falla nunca rompe lo que el usuario estaba haciendo. Sin guardar contenido de leads ni mensajes: qué se hizo, no qué decía. Mirá si `/terminos` y `/privacidad` cubren esta medición, y dilo en tu relevo: la decisión legal es de Martín.

**3. La tab, de nuevo.** Puede borrarse lo de hoy (`app/customers/`, `app/admin/AdminView.tsx`, `app/admin/cobros/`): Martín dio permiso expreso. Antes de borrar, mirá qué hace cada cosa y que nada vivo se pierda (Inspeccionar, abrir una cuenta, baja, precios, «Vender plan», el registro de acciones).
- **Nombre y ruta:** la tab se llama **Admin**. Mirá `app/_components/nav.ts` (`admin-customers`) y `proxy.ts` (`SOLO_ADMIN`). `/admin` ya existe y tiene subrutas: decidí la ruta sin romperlas, y que `/customers?tab=…` siga llegando por redirección.
- **Ingresos primero.** Es lo que Martín está pidiendo hoy: esa sección sale antes que las otras, y puede subir sola.
- **Seguridad:** sólo super admin. `getSesionAdmin()` en la primera línea de cada acción y ruta, además del proxy.
- **Multi-inquilino:** son lecturas entre negocios, a propósito y sólo acá. Nunca con `OWNER_WS` (es un cliente): la plataforma es `wsSuperAdmin()`.
- **Celular y escritorio.** El teléfono tiene `app/m/`; mirá qué conviene llevar.

## Decisiones de Martín que no se reabren

- **Un cliente de agencia no es un cliente de MaKo:** vive adentro de su agencia, y al abrirlo se navega a su ficha.
- **La ficha de un cliente** es la misma pieza que la de `/customer-success`: lo que ve es lo de SuperAdmin atribuido a ese cliente. Para ver el mundo del cliente está «Inspeccionar». Decisiones en `docs/hallazgos-customers.md`.
- **Abrir una cuenta** pide el email, obligatorio.
- **Lo interno se configura en SuperAdmin:** si no es configurable, es un bug.
- **Interfaz:** texto corto, español neutro con «tú», sin voseo. Nombres de tabs en inglés. Nunca el `<select>` nativo. Modal sobre modal: el de abajo se esconde y vuelve con su scroll. Sin datos, no se muestra «falta»: se ofrece qué hacer.
- **Gráficos:** claridad, un solo sistema, lo importante primero (`docs/hallazgos-graficos.md`).
- **Todo por la API de MaKo:** lo nuevo se declara en el registro (`lib/api-mako/areas/`), con `soloPlataforma`.

## Con quién no chocar

- **Recibos y su registro:** los arma otro chat (`docs/relevo/recibos-encargo.md`, `punta/recibos`) como un componente propio, `app/admin/cobros/RecibosMako.tsx`. Vos lo montás en la sección de cobros. No lo rehagas. Si movés `app/admin/cobros/`, hacelo con commits chicos y bien avisado en tu relevo: mirá antes `origin/punta/recibos`.
- **La suscripción en la ficha del lead:** otro chat (`docs/relevo/suscripciones-ficha-encargo.md`, `punta/suscripciones-ficha`) cambia cómo se guarda. Leé su relevo antes de cerrar Ingresos. Si todavía no llegó, leé `pagos` con `es_mensualidad`, que hoy es lo único con datos.
- **`lib/agencia-mes*.ts`:** el chat de cobro a agencias (`punta/agencia-cobro`).

## Cómo se entrega

- Por `punta/admin`, en tandas chicas que lleguen solas a main con verde. Deja `docs/relevo/nube-admin.md` con lo que le toca al Cerebro.
- No podés escribirle al Cerebro. Él te escribe a vos y puede dejarte más datos en el repo.
- Si necesitás una migración, barré main y las ramas para el número, y avisá que se confirma al aplicar.
- Tests probados rompiéndolos. Bitácora del área y cosecha en `docs/hallazgos-customers.md`, con el índice en el mismo commit.
