# Relevo — Landings públicas de `hola-mako.com/vsl` (claude5, desde el 12/11/2026)

Sigue el trabajo de la nube (`docs/relevo/nube-landings-competencia.md`): las 19 landings por función copiadas de su
referencia y el sitio estilo beehiiv (`/vsl/sitio`, `/vsl/comparaciones`). Martín da su feedback mirando un visor.

## Dónde quedó (12/11/2026)

- **Producción iba atrás de main.** Servía `a23bad24f`: las landings con el diseño copiado, pero sin los textos de la
  referencia del 12/11 (`23ed3633e`, `a4d60b930`) ni `/vsl/sitio` (404). Main los tiene. Hay que desplegar main.
- **Hecho:** el hero de `/vsl/ai-avatar` con las imágenes reales de los presets (`public/formatos/presets/`): tres escenas en
  abanico, la principal con su subtítulo. Martín: «Sí, con imágenes». Los pasos 2 y 3 usan las mismas imágenes.

## El visor («Landings de MaKo»)

- El primero (https://claude.ai/artifact/LKcMqfaNfLJXxizHtXqwnQ) lo publicó la cuenta claude4 / la nube: desde otra cuenta
  **no se puede actualizar**, así que cada versión nueva sale con su URL.
- Qué es: `index.html` (la lista de páginas; «Copiado» / «Diseño MaKo», que cambia la letra a Urbanist y Geist Mono y pasa
  los tonos de la referencia al azul y al dorado de MaKo; claro / oscuro, que invierte los colores; computadora a 1440 o
  teléfono a 390) + `paginas/<slug>.html`, una FOTO de cada página ya dibujada (el CSS adentro, sin scripts, las imágenes en
  `assets/`).
- Cómo se arma uno nuevo: ver «Cómo se arma el visor» abajo (se completa al publicar el próximo).

## Lo pendiente

- Desplegar main (los textos del 12/11, el sitio estilo beehiiv y las fotos de AI Avatar) y publicar el visor nuevo.
- Lo que sigue abierto desde la nube (detalle en su relevo): la captura real de «Carruseles que funcionan» para Image; los
  heros viejos de `/vsl/mako` (gráfico del CoPilot), `/vsl/cobranza` (rótulos en inglés) y `/vsl/funnel` (Panda en negro);
  Closing y Classroom sin landing; y las 8 decisiones de Martín de la sección «Lo que decide Martín».
