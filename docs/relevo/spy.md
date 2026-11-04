# Relevo — Competitors Spy (3/11/2026, cuenta claude2 al 98 %)

Carpeta `C:/dev/wt-spy-0311`, rama `spy-0311` (sale de `origin/main` 7c0cff10c). **Sin pushear.**

## Hecho
- **#10/#11 — sus otras redes, validadas** · `64247bae7`. Al dar de alta se busca solo su
  YouTube, TikTok e Instagram (`lib/spy-otras-redes.ts` + `-reglas.ts`) y la ficha pregunta
  «¿Son de esta persona?». La búsqueda NO escribe; sólo «Sí, es esta persona» guarda
  (`sumarCanalAction`). **US$0,00455 por búsqueda, medido**; tope 20/día por negocio.
  Migración **0365 (`spy_competidores.tiktok`) APLICADA en producción**. Costo en el tablero
  (`docs/pendientes-martin.md`, «#10 y #11»), hallazgos en `docs/hallazgos-competitors-spy.md`.
- Tests: `tests/spy-otras-redes.test.ts` 9/0, probado rompiéndolo (5 roturas, todas cazadas).
  Vecinos `spy-canal-de-la-bio`, `spy-alta-duplicados`, `spy-reglas`: verdes (39/0).
- `node scripts/tsc-acotado.mjs --rama --heap=3584` ✓. ⚠️ **Con el heap por defecto (2560) muere
  con código 134** —se queda sin memoria por el grafo de `SpyApp.tsx`—: no es un rojo.

## Sin verificar
- La pantalla no se miró en el navegador (no hubo RAM para levantar el servidor). Lo nuevo es
  el botón «Buscar sus otras redes» en la miga y el bloque «¿Son de esta persona?».

## Lo que falta, en orden
1. **#12 — pasar de 50 publicaciones.** `TOPES.piezasPorVuelta: 50` en `lib/spy-reglas.ts`;
   YouTube ya pagina en `lib/spy-youtube.ts` (`PAGINAS_MAX`). ⚠️ Por Meta (Business Discovery)
   un límite que no acepte tira la consulta ENTERA: no subirlo a ciegas. No arrancado.
2. **Caricatura por Flow para el que no es referente.** `lib/spy-caricatura-flow.ts` YA EXISTE
   (`pedirCaricatura`, `caraDelCompetidor`, prompt literal) **pero nadie lo llama** y pide
   `rasgos` («sin rasgos, mejor no generar»): falta de dónde salen los rasgos, el disparo
   aparte después del alta con tope por día (molde `TOPE_CREDITOS.imagen`, `lib/flow-interfaz.ts`)
   y guardar el resultado en la tarjeta. No arrancado.
3. **Ítem 13:** YouTube en la caché y la poda ya están escritos (`a2ae5bb04`), pero
   **`podarLecturasCompartidas` no la llama ningún cron** (`lib/spy-compartido-db.ts:98`).
