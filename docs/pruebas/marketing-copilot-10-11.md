# Marketing CoPilot de punta a punta, por tipo de persona (10/11/2026)

Pedido de Martín (10/11, noche): «textos rotos, botones rotos, diseño roto, funcionalidades que no funcionan… screenshot…
feedback sobre cómo se podría mejorar». Se usó la tab en **producción** (hola-mako.com), en el navegador de la app y con la sesión
de Martín. Se escribió sólo en el **ws 3 (Cliente de Prueba)**. En el ws 9 se miró y se probó un turno del chat. Al terminar, el
perfil del CoPilot del ws 9 quedó como estaba: `{"entrada":"referente"}`.

**En números:**
- **27 casos** probados.
- **22 fallas** encontradas, las 22 arregladas, con su test en `tests/marketing-copilot-produccion.test.ts`, `tests/hilo-propio-de-tab.test.ts`
  y `tests/media-buyer-hoy.test.ts`.
- **2 falsas alarmas** del navegador, explicadas abajo.
- **5 propuestas** de mejora sin hacer.

**Dónde está cada arreglo:**
| Tanda | Fallas | Estado |
|---|---|---|
| 1 | 1-3 | En main, corrida 885 |
| 2 | 4-13 | En main, corrida 890 |
| 3 | 14-22 | En la punta `punta/marketing-copilot-agente`, empujada con este informe |

Las tres salen con el despliegue automático del 11/11 a las 08:05 UTC. Las capturas están en `docs/pruebas/marketing-copilot-10-11/`.

## Las personas y las pantallas

| Persona | Dónde | Qué se probó |
|---|---|---|
| Superadmin, negocio propio con Meta conectado (cuenta vacía) | ws 9 | Primera entrada por referente (Julián Otálora, orgánico), «Comparar funnels», propuesta, estrategia sin anuncios, un turno del chat, Plan con anuncios (VSL), Hoy, Campañas, Biblioteca, Actividad, la tuerca, Nueva campaña, Ajustes, Automatizaciones |
| Cliente sin Meta y sin IA (sin la app de escritorio) | ws 3 | Infoproductor que elige VSL con ticket bajo (MaKo avisa y propone mensajes), propuesta, pantalla sin Meta, Ajustes, Nueva campaña, «Empezar de nuevo», YouTube completo |
| Tienda online (ticket de US$20-100) | ws 3, código y banco | Las opciones del ticket |
| Teléfono (375, con el teléfono emulado) | ws 9 y ws 3 | Hoy, Plan, la hoja de MaKo, funnel sin anuncios, claro y oscuro |
| Tablet (768) y notebook (1024) | ws 9 y ws 3 | La charla en una columna con «MaKo / Tu funnel», el panel |
| Escritorio 1440 | ws 9 | Todo lo de arriba, claro y oscuro |
| Otra tab (Image) | código | El hilo del CoPilot que vio Martín |

## Las fallas, caso por caso

1. **El hilo del CoPilot aparecía en otras tabs** (Image: «desde Marketing CoPilot: Volvamos a empezar»). Y al revés: en la
   estrategia, el resumen del Ops Center («68 pendientes de revisar», captura 03); en la hoja del teléfono, un «¿qué tengo pendiente
   hoy?» del 11/10; en el ws 3, un pedido del Dashboard con «No te pude contestar esto».
   → Cada tab con hilo propio dibuja y le pasa al modelo sólo lo suyo (`delHiloDeLaTab`). El Ops Center sigue viendo todo.
2. **A 390, la barra de vistas se partía** («Nueva campaña» en dos renglones, «Actividad» cortada). → `nowrap`.
3. **A 390, el Plan dibujaba el recorrido en cuatro columnas de una palabra.** → El Plan tiene su contenedor de ancho.
4. **La estrella de MaKo tapaba la caja del chat** del CoPilot, en escritorio y en tablet (capturas 01 y 09). → Las pantallas con el
   chat a la vista se anotan y la estrella de la barra no va.
5. **Con la franja «Estás viendo el dashboard de…», el pie del panel quedaba 50 px debajo** y la página se corría sola (captura 01).
   → Los altos descuentan `--barra-agencia`.
6. **«Comparar funnels» inventaba un «Con $0 al mes los anuncios no juntan datos»** en cada funnel con anuncios. También decía «Te
   sirve» en Email sin saber si hay lista, y «MaKo lo recomienda» en Lead magnets (captura 02). Nadie había dicho el presupuesto.
   → Se compara y se recomienda sólo con lo que la persona dijo (`datosDichos`), en el panel, en el agente y en la herramienta.
7. **Sin números, «Faltan tus números» se repetía en las nueve filas.** → Va una vez arriba.
8. **«Tu funnel está en marcha. ¿Qué miramos?» y sus tres botones quedaban debajo de la respuesta** (captura 04). → En el CoPilot
   se van cuando la persona escribe.
9. **«Lanzar el primer anuncio» era el único paso de «Esta semana» sin botón** (captura 06). → Va a Nueva campaña.
10. **Campañas, con la cuenta vacía, decía «0 campañas en 3 productos»** (captura 07). → Cuenta sólo los productos con campañas.
11. **Ajustes juzgaba el funnel con un $0 y un «lo atiendo yo» que nadie dijo**, y mostraba «Con US$0 no hay Campañas» sin que se
    hubiera dicho cero.
12. **El nombre viejo de la tab:** «← Media Buyer», «Ir al Media Buyer» y el cargando (captura 08).
13. **«desde Marketing CoPilot» + «Marketing CoPilot: Volvamos a empezar»:** el nombre iba dos veces en cada pedido.
14. **A 1024 (una notebook), el panel medía 480 px y el recorrido seguía en etapas de 96 px** (captura 11; con el arreglo, la 12).
    → Lo de adentro del panel mira el ancho del panel.
15. **Al aceptar el funnel que propone MaKo, su aviso se borraba.** «El VSL con llamada pide una venta de unos $3,000…» (captura 13)
    pasaba a «¿Seguimos?», y la respuesta a «Sí, cambiemos» (captura 14): se perdía por qué cambió. → Ese paso se dibuja con el perfil
    de antes del cambio.
16. **La propuesta de «Anuncios a mensajes» contaba agendas «por llamada calificada»**, dos líneas debajo de «se mide por conversación
    calificada» (captura 15). → En mensajes no hay agenda: se dice qué se mide, sin inventar un costo.
17. **El recorrido decía «Llamada de venta contigo» antes de preguntar quién llama.**
18. **Sin Meta conectado, «¿En qué te ayudo hoy?» tapaba toda la tab** (captura 16): sin la barra no había forma de llegar al Plan ni
    a Ajustes, y no decía que faltaba conectar Meta. → Con estrategia elegida va la pantalla de siempre, y Hoy dice «Conecta tu
    cuenta de Meta».
19. **Una tienda no tenía su ticket**: las opciones empezaban en $200 y, sin la app de escritorio, no se puede escribir. → Suman $50
    y $100.
20. **Nueva campaña sin Meta era un callejón** (captura 18): «El negocio no tiene Meta conectado ni su Zernio con la cuenta
    publicitaria» y ningún botón. → Muestra «Conecta tu cuenta» con «Conectar con Facebook», y el mensaje se dice en palabras de
    producto.
21. **Tras «Empezar de nuevo» quedaba sólo «Deshacer»**, sin botones para empezar (captura 19). → Arreglado; en el banco, la captura 21.
22. **En el teléfono, un funnel sin anuncios montaba la estrella de la computadora**, encima del «CRM» de la barra de abajo
    (captura 20). → Lo pedido va a la hoja de MaKo del teléfono.

## Lo que funcionó bien

- MaKo avisa con criterio. Con un VSL y una venta de $1.000 dice por qué no conviene y propone mensajes (captura 13). En Ajustes,
  «Quién llama: Nadie» con un ticket de $1.000 marca «Revisar» con su motivo (captura 17).
- El chat del ws 9 contestó «¿Qué hago esta semana?» pidiendo el dato que falta, «¿Qué vendes y a quién?», en lugar de inventarlo.
- El oscuro se ve bien en escritorio y en el teléfono (captura 05).
- La tablet pasa a una columna con «MaKo / Tu funnel» (captura 09).
- Nueva campaña con Meta carga el formulario entero.
- Biblioteca y el panel de agentes funcionan.

## Falsas alarmas (el navegador, no la app)

- **El modal de Actividad salía transparente.** En una pestaña de fondo del navegador de la app, `requestAnimationFrame` da 0
  cuadros y las animaciones de entrada se quedan en su primer cuadro. Al frente se ve bien. Anotado en `docs/hallazgos-infra.md`.
- **Con el teléfono emulado, la captura sale ampliada y cortada.** El DOM mide 375 px sin nada afuera.

## Lo que no se probó

- **Esencial contra Pro:** cambiar el plan del negocio de prueba es tocar su cobro. Lo que cambia, el automático, lo cubren
  `tests/media-buyer-plan.test.ts` y `tests/media-buyer-agentes-protect.test.ts`.
- **Un miembro del equipo:** no encontré en la app una forma de ver la tab con ese rol sin entrar con su cuenta, y no se crearon
  cuentas.
- **El agente con IA, en profundidad:** el ws 3 no tiene IA, y sin la app de escritorio no deja escribir. En el ws 9 se probó un
  turno. La calidad del agente, por tipo de negocio, se midió con la batería del 9/11 (`docs/relevo/marketing-copilot-pruebas.md`).
- **Publicar una campaña:** se llegó hasta antes de «Revisar y lanzar».

## Propuestas de mejora (no hechas)

1. **Sin Meta, «Conectar con Facebook» va primero en Ajustes:** hoy está al final de la página, y es lo primero que necesita ese
   negocio.
2. **Sin la app de escritorio no se puede escribir nada en la charla**, ni una respuesta que se lee sin IA («$45», «3 por semana»).
   La caja podría aceptar lo que se lee sin IA y pedir la app sólo para hablar con MaKo.
3. **La apertura fija de otras tabs** (CRM, Calendario, Clientes) tiene el mismo problema que la 8. Hoy la regla la fija para todas
   `tests/aperturas.test.ts`: decidir si cambia el default.
4. **Hoy, Campañas y Biblioteca conservan el diseño anterior al de dos columnas.** Cuando la cuenta está vacía, la mayor parte de la
   pantalla queda sin contenido.
5. **Un funnel elegido que no sirve propone otro con datos completados**: un «lo atiendo yo» supuesto en una compra directa con
   ticket alto. Detalle en `docs/hallazgos-marketing-copilot.md`, «Sin hacer».

## Falta

Volver a mirar en producción después del despliegue de las 08:05 UTC del 11/11: las tres tandas, en 1440, 1024 y 375, en claro y
oscuro.
