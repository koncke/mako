# Relevo: los pendientes del Web Generator (nube, 9/11/2026)

> Lo escribe el chat de la nube que trabajó el pedido. Es de primera mano para lo que dice «hecho» y «medido»; lo que dice
> «sin medir» no se vio andando. La lista completa de pendientes es `docs/editor-landing/pendientes-web-generator.md`.

## Lo pedido

Martín, textual (9/11/2026): «con respecto a Web Generator, lo mismo que el tema de editor, hay cosas que nos habían quedado
pendientes. Por ejemplo, el tema de replicar landing, que eso es súper importante. Muchas que no se replicaban, tampoco aparecían
en Competitor Spy. Y habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa manera
siempre vamos a poder replicar cualquier landing.»

El orden del encargo: (1) replicar por la extensión, (2) Competitor Spy, (3) lo que la réplica hace mal, (4) los varios mouse,
(5) el resto. Sin publicar la extensión, sin migraciones en producción, sin datos de clientes reales, y sin evadir ningún
antibots.

## La punta

| Punta | Qué lleva | Veredicto |
|---|---|---|
| `punta/web-replicar-0911` | Replicar por la extensión (0.79.0), «Copiar su sitio» de Spy a Replicar, el anillo en «Leer» (tanda 2), `VERSION_EN_TIENDA` a 0.74.5, la revisión adversarial y la autocrítica | ver el último commit de la punta (renglón `Veredicto:`) |

El Cerebro la re-firma y la sube (`docs/relevo/nube-metodologia.md`).

## Hecho

- **Replicar por la extensión (§3.1, P1): hecho en código y tests.** La persona aprieta «Copiar con la extensión» en Replicar (o
  «Copiar su sitio» en Spy, que ahora abre Replicar), la extensión abre la página a la vista, la persona pasa la barrera si la
  hay, toca el ícono de MaKo, la extensión baja por la página, saca la foto de la copia idéntica (las mismas piezas que el
  lector) y la manda a MaKo, que replica. También desde cualquier página: «Replicar esta página» en el desplegable. El detalle,
  en `docs/hallazgos-extension.md` y `docs/hallazgos-editor-landing.md` (9/11).
- **La revisión adversarial** encontró dos altas y siete medias; están arregladas y probadas rompiéndolas (la tabla está en la
  cabecera de `tests/replicar-extension.test.ts`). Las altas: la pendiente era de la pestaña y no del sitio (copiaba Gmail si la
  persona usaba esa pestaña para otra cosa) y de un campo se copiaba el atributo `value`, donde React escribe lo tipeado.
- **Autocrítica (capturas en `docs/editor-landing/capturas/replicar-extension-1440.png` y `-390.png`):**
  - cambié que el botón se ofreciera a todos y avisara DESPUÉS del clic que «llega con la próxima versión»: ahora sale sólo con
    una extensión que sabe copiar (`ofertaDeExtension`). Hasta que la tienda tenga la 0.79.0, **los clientes no ven nada**;
  - saqué el porcentaje repetido tres veces mientras copia (el anillo ya lo dice; el renglón dice «No cierres esa pestaña»);
  - el giro quedaba solo en un renglón a 390 px y «Agregar a Chrome» salía subrayado: arreglados.
- **§3.2 sin bucket ni migración, a propósito:** la réplica ya no depende de lo capturado (se saca la foto cuando se pide).
  Guardar el HTML ajeno sólo serviría para replicar sin volver a abrir la página. Si se decide, el número de migración lo da el
  Cerebro (la 0410 ya está usada).
- **§2.1 Spy:** «Copiar su sitio» abre Replicar arrancando solo (`/web-generator?replicar=<url>`).
- **§4.2 tanda 2:** el anillo del reel en el paso «Leer» y mientras la extensión copia.
- **§3.3 la constante:** `VERSION_EN_TIENDA = '0.74.5'` (medido en la ficha pública desde la PC de Martín el 9/11).
- **La API de MaKo:** no se declaró ninguna operación nueva. Copiar con la extensión necesita el navegador de la persona y su
  toque en el ícono: por la API no hay a quién pedírselo. `replicar_landing` sigue como estaba (sin foto, la copia de antes).

## Para publicar la extensión (§3.3, lo hace Martín)

- El paquete: `public/mako-puente-0.79.0.zip` (lo regenera `node scripts/zip-extension.mjs`; el pre-push frena si quedó viejo).
- La subida por API está muerta (`deleted_client`): hay que volver a verificar la cuenta en el Chrome aparte
  (`scripts/cdp-tienda.mjs`) y subir el zip desde el panel. Google tarda en aprobar.
- **No pide permisos nuevos** (sigue con `storage`, `alarms`, `webRequest`, `scripting`, `activeTab` y los mismos sitios), así
  que no se desactiva para nadie.
- Notas para la tienda: «Nuevo: Replicar esta página. Copia en tu Web Generator de MaKo la página que estás mirando, aunque
  bloquee a los robots: la extensión baja por la página para que cargue entera, la copia y te deja donde estabas. No copia lo
  que escribiste en un formulario. Se usa tocando el ícono de MaKo.»
- Al aprobarse: subir `VERSION_EN_TIENDA` (lib/extension-tienda.ts) a 0.79.0. **Eso prende el botón para todos los clientes.**

## Pruebas para la PC de Martín (con la extensión cargada desde la carpeta, 0.79.0)

Para cada página: en `/web-generator` → «Replicar landing», pegar la dirección y «Leer». Si el servidor no la baja, aparece
«Copiar con la extensión». Mirar: que se abra al lado, que al tocar el ícono baje por la página y vuelva arriba, que MaKo la reciba
sola y replique, y que la pestaña se cierre recién cuando la copia salió.

1. **https://beacons.ai/denborg** (y https://beacons.page/denborg, que redirige): si sale el «Just a moment...», pasarlo en la
   pestaña y tocar el ícono. Tiene que copiarse Den Borg, no la verificación. También desde Spy: «Copiar su sitio».
2. **https://lovable.dev/**: 403 de Cloudflare al servidor. Además es una app en módulos: medir que la copia salga con su diseño.
3. **https://www.vidalytics.com/**: el «Vercel Security Checkpoint» (429 al servidor).
4. **https://100ads.ai/**: la app de Next (§1.3). Por el servidor ya debería salir; probar también con la extensión.
5. **https://gsap.com/**: la app de Vite (§1.2): en la pestaña real los módulos corren.
6. **Lo que NO tiene que pasar:** abrir la pestaña con «Copiar con la extensión», ir en esa misma pestaña a Gmail y tocar el
   ícono: tiene que mostrar el inicio del desplegable (no copiar Gmail para MaKo), y MaKo tiene que decir «Esa pestaña se fue a
   otra página». Y en una página con un formulario, escribir algo y copiarla: lo escrito no tiene que aparecer en la copia.

## Lo que falta, con su motivo

- **§1.4 (el Diagnóstico y la vista previa de Spy con las apps de Next):** no se tocó. No es un parámetro: primero hay que llevar
  la parte del preludio que apaga los rastreadores a esas vistas, y eso pide medir con una app de Next real, que la nube no pudo
  hacer. Con la extensión, «Copiar su sitio» ya no depende de esa vista previa.
- **§1.5–§1.7 (desfases, editable, la copia idéntica):** piden abrir las réplicas #68-#72 en el editor real del ws9 y mirarlas a
  1440 y 390. Desde la nube no hay base de producción ni Chrome con sesión: quedan para un chat en la PC.
- **§2.2 Den Borg:** destrabado por la extensión; falta la prueba 1 de arriba y publicar.
- **§2.3 (viralidad.com da 500, el destino de linktw.in):** sin tocar.
- **§4.3 tanda 3 (la página real en cada caja):** sin empezar. Pide una ruta del servidor que sirva cada sección firmada (la
  regla de «servir contenido de afuera»), y no entró en esta tanda.
- **§4.4 el segundo reel y §5:** sin tocar.
- **Lo que la revisión dejó en «bajas»:** una pestaña de MaKo congelada puede hacer que se abra otra y las dos tomen la foto; una
  pestaña de fondo estira los relojes y una página muy larga sale `parcial` sin que la pantalla lo diga; el tope del pedido
  cuenta caracteres y Vercel corta por bytes. Anotadas en `docs/hallazgos-extension.md`.

## Notas para el que siga

- `node scripts/tsc-acotado.mjs` en la nube necesita `--heap=6000` (con el de fábrica sale «código undefined»: se quedó sin heap).
- El worker se prueba recortando `background.js` entre marcadores: un bloque nuevo va FUERA de los recortes de los otros tests
  (`grep -n "bg.indexOf(" tests/`).
- `extension/replica-leer.js` NO se edita a mano: `node --import tsx scripts/sync-replica-extension.mjs`.
