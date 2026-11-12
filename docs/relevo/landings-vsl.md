# Relevo — Landings públicas de `hola-mako.com/vsl` (claude5, desde el 12/11/2026)

Sigue el trabajo de la nube (`docs/relevo/nube-landings-competencia.md`): las 19 landings por función copiadas de su
referencia y el sitio estilo beehiiv (`/vsl/sitio`, `/vsl/comparaciones`). Martín da su feedback mirando un visor.

## El feedback de Martín del 12/11 (textual), y qué se hizo

> «Elimines de todos lados lo de agendar llamada porque hoy en día vamos a hacer que el CTA de todos sea comienza tu prueba
> gratuita… elimina también la sidebar de landings de Maco porque yo debería poder navegar por todo con lo que ya tenemos…
> la tab de precios no hace nada… haz que todo sea navegable tal cual como quedaría. Por ejemplo, si le aprieto el logo de
> Maco, que me vaya [a la portada]. Luego no tiene sentido arriba entrar, ver planes, agenda tu llamada… debería ser
> registrarse, loguearse… ver planes… el botoncito de luna y sol que tenemos… el círculo que se va expandiendo… y que eso se
> mantenga… revises todo lo que falta porque tal vez hay botones que todavía no andan.» Y: «en la landing principal, pusiste
> CRM, Ops Center y Automation, cuando en esa parte debería estar el VSL que yo ya grabé».

(Ese feedback se lo dio a la cuenta claude4 en la sesión de la nube y NO llegó al relevo: lo volvió a pegar en este chat.)

| Pedido | Dónde quedó |
|---|---|
| Ningún «agendar llamada»: el botón es «Comienza tu prueba gratuita» | `app/vsl/_competencia/cta.ts` (`RUTA_CTA` = `/planes`, `TEXTO_CTA`, `TEXTO_CIERRE`), en las 19 landings y el sitio. Sigue al interruptor de la prueba (prendida: abajo) |
| Arriba: iniciar sesión, ver planes, registrarse | `app/vsl/_sitio/Barra.tsx`: «Iniciar sesión» (/login), «Ver planes» (/planes), el sol y la luna, «Comienza tu prueba gratuita» |
| El sol y la luna, con el barrido de la app, y que se mantenga | `app/vsl/_competencia/TemaSitio.tsx`: un script en línea (anda sin React y en el visor), recuerda el modo en `localStorage['mako.sitio.modo']` |
| El VSL de Martín en la portada nueva | `app/vsl/_sitio/Portada.tsx` (`VSL_PORTADA`, el Panda `25c0684d-…` de la portada de hoy) |
| «Precios» y los links que no andaban | «Industrias» llevaba a `/vsl/mako-<avatar>` (404, nunca se subieron): ahora a `/vsl/coaches`, `/vsl/infoproductores` y `/vsl/inmobiliarias` (publicadas el 23/10). Agencias no tiene página: fuera del menú |
| El visor sin la lista, navegable | `scripts/visor-landings/visor.html`: la página entera, sus links abren la página que corresponde (el logo → la portada nueva, Precios → /planes, Iniciar sesión → /login…), abajo Atrás / Computadora-Teléfono / Copiado-Diseño MaKo |

## La prueba gratis, PRENDIDA (12/11/2026, Martín: «Sí, préndela»)

`PRUEBA_GRATIS_PRENDIDA = true` (`lib/planes-mako.ts`): `/planes` dice «7 días gratis» y cobra el día 8 con la tarjeta,
`/reembolsos` y `/terminos` dicen la prueba, y el botón de todo el sitio es «Comienza tu prueba gratuita». El 50% del primer
mes no se ofrece con la prueba prendida (son una cosa o la otra): sus tests (`tests/primer-mes.test.ts`, la simulación del
cobro y las tarjetas con el reloj) se saltean y vuelven solos si el interruptor vuelve a `false`. `tests/planes-tres-bloques`
y `tests/partners-recursos` siguen al interruptor. Medido con `true`: 358 tests de planes y cobros, 347 pasan, 10 se
saltean, 0 fallan. Falta mirar en producción una compra de prueba con la tarjeta de prueba (la hace Martín).

## La barra del sitio en todas las páginas (12/11/2026)

Martín: «me voy a otra tab y después ya no sale la top bar de arriba para seguir navegando… ya no puedo regresar». Cada
landing traía la barra de su referencia, sin el menú del sitio. Ahora arriba de las 19 landings y de `/planes` va la barra del
sitio (`BarraGlobal` en `app/vsl/_sitio/Barra.tsx`), fija al bajar, y la copiada se oculta (`BARRA_PROPIA` en
`app/vsl/_competencia/TemaSitio.tsx`, una clase por diseño; el test exige que esté).

## El visor («Landings de MaKo»)

- El primero (https://claude.ai/artifact/LKcMqfaNfLJXxizHtXqwnQ) lo publicó la cuenta claude4 / la nube: desde otra cuenta
  **no se puede actualizar**.
- **El de claude5: https://claude.ai/artifact/3QRCSF8oaK1ZK2PXADuQow**. Desde esta cuenta se actualiza en la misma URL.
- Qué es: `index.html` (sin lista: la portada nueva y sus links; abajo Atrás, Computadora / Teléfono y Copiado / Diseño MaKo)
  + `paginas/<slug>.html` y `paginas/<slug>-tel.html`, una FOTO de cada página (sin scripts, salvo el del sol y la luna) +
  `assets/` con las hojas de estilo, imágenes y letras. Las páginas de la app a las que llevan los links (`DE_LA_APP` en
  `armar.mjs`: /planes, /login, las de Industrias y las legales) también van.
- **Cómo se arma uno nuevo** (unos 3 minutos, sin `next dev`), con lo nuevo YA desplegado:
  `node scripts/visor-landings/armar.mjs <carpeta> https://hola-mako.com`. Con `<carpeta> <base> indice` escribe sólo el
  índice. Se publica con la herramienta Artifact: `file_path` = `<carpeta>/index.html`, `root` = `<carpeta>` y en `files`
  cada `paginas/*.html` y cada `assets/**`.
- **Si producción va atrás** (como el 12/11): cada página se dibuja desde main sin servidor (`renderToStaticMarkup` de las
  landings de `registro.ts`, `PortadaSitio` con `PLANES_MAKO_DEFAULT` porque `lib/compra-plan.ts` es server-only,
  `ComparacionesSitio` y `VitrinaPlanes` para /planes), con las hojas de estilo de una foto de producción, y los gráficos que se
  dibujan al hidratar (`.recharts-responsive-container`: Cobranza, Dashboard, Plan, Ads Analyst) se copian de la foto de
  producción en el mismo orden y al mismo ancho. Los scripts de esa receta quedaron en el scratchpad de la sesión: la receta es ésta.

## Lo pendiente

- Desplegar main (textos del 12/11, sitio estilo beehiiv, fotos de AI Avatar, el CTA, el sol y la luna, el VSL).
- **Las páginas que NO son código y siguen ofreciendo la llamada:** la portada de hoy (`/`, un documento de Web Generator con
  Calendly) y las de Industrias (`/vsl/coaches`, `/vsl/infoproductores`, `/vsl/inmobiliarias`, documentos del 23/10). Se
  cambian publicando esos documentos en producción, con el permiso de Martín (`scripts/landings-mako-v2*.mts --subir`).
- La portada nueva no es `/` todavía: el logo lleva a `/`, que hoy es la portada vieja. Cambiarla la decide Martín.
- Lo que sigue abierto desde la nube: la captura real de «Carruseles que funcionan» para Image; los heros de `/vsl/mako`
  (gráfico del CoPilot), `/vsl/cobranza` (rótulos en inglés) y `/vsl/funnel` (Panda en negro); Closing y Classroom.
