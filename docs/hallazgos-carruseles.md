# Hallazgos — Carruseles (la biblioteca de ejemplos)

Dónde vive: `lib/carruseles/biblioteca*.ts`, `scripts/carruseles-biblioteca.mts`, tablas `carruseles_biblioteca_*` (migraciones 0392 y 0393).

## Traer un carrusel puntual: por su link, nunca por el perfil (5/11/2026)

**Síntoma:** teníamos 245 links de carruseles buscados. Leer a sus creadores por perfil costó US$4,71 y trajo 1.007 carruseles, con 1 solo de los 245.

**Lo obvio era leer más posts por perfil, y estaba mal.** Los carruseles que se buscan son los que funcionaron, y suelen ser viejos: no están entre los últimos posts. Subir el tope compra más carruseles ajenos, no el buscado.

**La regla:** con el link en la mano se pide el post, a ~US$0,0025 cada uno. Así salieron 244 de 245. El actor de Instagram de Apify, con esta entrada y de a 40 links por lectura:

```json
{ "directUrls": ["https://www.instagram.com/p/XXX/"], "resultsType": "posts", "resultsLimit": 1, "addParentData": false }
```

El perfil queda para explorar a un creador, no para encontrar una pieza.

## Sin dato no es «no»: el filtro gratis tiraba a Hormozi y a Leila (5/11/2026)

**Síntoma:** el filtro `(laminas ?? 0) >= 3 && parece_contenido === true` descartó 582 de 1.344 piezas, entre ellas 11 de las 13 de `leilahormozi` y 6 de las 11 de `hormozi`.

**Lo obvio era que esas piezas no servían.** En realidad, 457 de las 582 cayeron porque **faltaba el dato**, no porque fuera malo: 338 con `parece_contenido` en null y 119 con `laminas` en null. El lector no siempre trae la cantidad de láminas, y el clasificador deja null cuando no se anima a decidir (un texto corto, o una pieza sin texto). Mirados a ojo, 363 de esos 457 sirven: entre ellos, los textos estilo tuit de Alex Hormozi y Leila, de lo mejor de la biblioteca.

**La regla:** `?? 0` y `=== true` convierten «no sé» en «no». Lo que falta se mira; se descarta sólo con un dato en contra. Tampoco el «no» del clasificador alcanza: de 67 con `parece_contenido` en false y 3 láminas o más, 40 servían.

**Mirar hojas de miniaturas con un agente: el criterio decide más que el modelo.** La primera pasada, con «¿sirve de plantilla?», descartó 130 de 762. La segunda, con «ante la duda, sirve; sólo se va lo obvio» y ejemplos de falsos descartes, se quedó con 99 de esos 130. Las portadas con foto de fondo y una frase son las que más se pierden («Your business idea might already be your hobby»). Antes de esconder, revisar a ojo la lista de descartes en una hoja propia, rotulada con su clave: la posición contada dentro de una hoja se puede correr.

## Esconder y deshacer (5/11/2026)

`dejo_de_verse_en` esconde (`lib/carruseles/biblioteca-servidor.ts:87`). Volver a leer una pieza no la revive: el `upsert` por `ref` de `scripts/carruseles-biblioteca.mts` no toca esa columna.

El 5/11 se escondieron 210 (152 mirados a ojo y 58 de dos láminas, que no alcanzan para copiar una estructura). Quedan 1.378, con los 244 de Top Carousels. Para deshacer: `update carruseles_biblioteca_piezas set dejo_de_verse_en = null where dejo_de_verse_en::date = '2026-11-05'` (la fecha sale del `now()` de esa única corrida). La lista con el motivo de cada una está en la PC: `C:/dev/cerebro-herramientas/tickets/carruseles-escondidos-2026-11-05.json`.

## Top Carousels: su biblioteca no se recorre, ni con la sesión de Martín (5/11/2026)

Sus términos del 7/10/2026 prohíben entrar con herramientas automáticas, bajar carruseles en cantidad y republicar la biblioteca, y avisan que pueden cerrar la cuenta sin devolver el dinero. `robots.txt` veda `/explore` y `/api/`, y deja a los agentes `/llms.txt` y `/llms-full.txt`. Tener la sesión abierta no cambia nada.

**La regla:** los carruseles se leen de Instagram, a partir de los @ y links que pase Martín o de su texto público para agentes. Sus puntajes no se copian. Si hiciera falta más, tienen un conector oficial (`https://topcarousels.com/mcp`, plan Pro; el permiso lo da Martín).

## Sin hacer

- **Lo que entre de ahora en adelante no pasa por esta curaduría:** una lectura nueva queda visible sin que nadie la mire. El filtro no puede ser el de arriba.
- **La lectura por links no está en el script oficial:** vivió en una copia temporal, ya borrada. La entrada de arriba es lo que hay que sumarle a `scripts/carruseles-biblioteca.mts`.
- 1 de los 245 links sin leer, y 26 creadores de la lista sin leer.
- Los 32 temas de hashtag siguen prendidos, sin decidir si conviene apagarlos. Traen de todo.
- Series y duplicados sin marcar (por ejemplo, las partes de «you can find anything on the internet», o muchas de meal prep de una misma cuenta).
