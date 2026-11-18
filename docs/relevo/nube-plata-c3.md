# Relevo — nube, «C3 + Toca la plata» (18/11/2026, cuenta `claude2`)

Pedido (Martín, 18/11): «continúes con absolutamente todos los pendientes». A este chat le tocaron, de
[docs/pendientes-verificados-17-11.md](../pendientes-verificados-17-11.md), «Un cliente lo está sufriendo» (C3) y «Toca la plata».
Antes de tocar cada ítem se buscó en `origin/main` si ya estaba hecho. El estado ítem por ítem quedó escrito EN ese documento (una
línea «18/11» debajo de cada uno); acá va lo que hace falta para seguir.

## Lo que quedó hecho, en la punta `punta/nube-plata-c3`

- **C3, Knowledge** (`6b8ccecd`): 60 fichas por módulo en `lib/knowledge-siembra/` (los siete módulos y cuatro plantillas de guion del
  pedido 3.2 del 30/10) y `scripts/sembrar-knowledge.mts`, que las carga en la PLATAFORMA con `fuente: 'mako'`. **No se corrió.**
- **P7** (`d33fa5ec`): Admin › «Por cobrar» le pregunta al libro de la mensualidad por la agencia prendida sin meses pagados por él
  (Código: 5/12 US$426 en vez de 4/12 US$238 del CRM).
- **P27, lo que le quedaba** (`d33fa5ec`): el link que sigue abierto en la pasarela de una cuota ya cobrada va a los errores de la app.
- **P17** (`34c00bc4`): la pasarela no abre el pago de una landing → notificación urgente al negocio.
- **P37** (`34c00bc4`): el Admin del teléfono ya no dice «Plan a mano» de quien no lo tiene.
- **P20**: 20 de las 23 lecturas con techo de 1000 filas paginan (tests/techo-1000-p20.test.ts). De paso: el barrido de
  dependencias ya no borra todo con la lectura caída, «proyectos vacíos» no da a todos por vacíos si no pudo leer, y el
  aviso «recortado» del Plan mide sólo los proyectos. Queda `soldUsd` (necesita que tests/venta-sin-cobro.test.ts reconozca
  la forma paginada) y los proyectos, que siguen sin paginar.
- **P21**: `docs/hallazgos.md` con una fila por documento (81 → 64), sin perder entradas.

## Lo que espera al Cerebro (escribe en producción: con el sí de Martín)

1. **Sembrar Knowledge.** Primero sólo leer y mirar el plan:
   `node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/sembrar-knowledge.mts`
   y después, con el sí de Martín, el mismo comando con `--aplicar`. Después, mirar Classroom › Methodology: cada módulo con sus
   fichas y todas «prestables».
2. **Aplicar la migración 0417** (P30, `pagos.moneda` acepta USDT/USDC): la dejó escrita el chat de Cobros el 17/11, sin aplicar.
3. **Mirar en producción** (después del deploy): Admin › Overview › «Por cobrar» de Código (5/12, US$426) y /agency?ws=13 con la
   sesión de Martín (P26).

## Lo que no se pudo desde la nube, y por qué

- **P29, P16, P1, P24, P11, P4, P18:** piden claves de prueba, un navegador real, un pago real o leer producción.
- **P14:** portar las reglas del CoPilot pide el repo fuente con su licencia MIT, que no está en este repo ni al alcance de la sesión.
- **P15, P19, P23, P34, P36, P3, P35 y la mitad de P25:** construcción; cada línea del documento dice dónde vive.

## Para verificar (la regla de los pendientes: lo que se da por cerrado lo mira otro, contra `origin/main`)

Lo de este chat NO se tachó: está marcado «en punta». Cuando la punta llegue a main, que otro lo refute y recién ahí se tacha. Lo que
sí se tachó (P27 núcleo, P28, P33) lo hizo otro chat el 17/11 y acá se verificó contra `origin/main`.
