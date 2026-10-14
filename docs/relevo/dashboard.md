# Relevo — chat «Graphics» (la tab Dashboard)

<sub>Escrito el 14/10/2026 ~02:20 (hora de Argentina) por la cuenta 2, desde el chat que hizo el trabajo. Se pisa en cada relevo.</sub>

## Dónde está

**Todo lo del 13/10 está en main** desde el push integrado del chat «Estrategia 3 CUENTAS» (14/10 ~02:10, `e4c8a6d7`, que trae
`graphics-1310` adentro con sus hashes). El contrato de la v5 sigue en [dashboard-v5.md](dashboard-v5.md); lo aprendido, en
`docs/hallazgos-graficos.md`. Lo que entró:

- `a30282bf` — **«¿Qué vas a crear hoy?» en «Nueva hoja»** (la caja de Automations, la misma) y **«Copiar dashboard»** con un token
  `MAKO-DASH-…` (mig **0268** `dashboard_copias`, aplicada en prod). Viaja la definición, sin personas; en otro negocio se vacían los
  filtros para mirar que eran de allá.
- `35dc37f6` — **las plantillas se arman con los datos del negocio** (`/api/graficos/plantilla`: quita los vacíos y MaKo suma hasta 4
  con datos). Lo mismo para lo que arma MaKo con un pedido y para la API.
- `29a39259` — el **código muerto de los bloques, borrado**.
- `9966e7bc` — **«A quién cobrarle» en la tab General**. Quedó ésta (`app/general/Cobranza.tsx`) y la del chat GENERAL se borró
  (merge `11c2f4bd`, 14/10 ~02:20): ahora es el bloque `cobranza` de las vistas de /general, con el nombre de la vista al lado
  (`alcance`) y recortada a sus funnels. Vacía, la vista de fábrica no la dibuja; una vista armada por la persona sí.
- `25bd67c2` — **clic derecho en toda la tab** (opciones según dónde y en qué modo), el **botón de MaKo selectivo** (sólo tendencias
  por día/semana/mes, embudos y dispersión; ausente = lo del tipo, `conMako`) y **editable en el lugar**: editando, su clic abre lo
  que responde, las sugerencias y «Quitar el botón». La API: `pedido_mako`.
- `2e97dd80` — el tope del typecheck (`CAP_HEAP_MB`) pasó de 3072 a 4096: con 3072 el chequeo completo ya moría corriendo.
- El aviso **«El AI Analyst terminó»** lo conectó el chat Automations (`60186944`, `avisarAnalisisListo` en `analizarHoja`): no se toca
  esa llamada (tests/plantillas-viejas, test 1).

⚠️ **Tres errores de tipos míos llegaron al push integrado** y los arregló «Estrategia 3 CUENTAS» en `e4c8a6d7`: commits hechos con el
typecheck sin poder correr (RAM). Con la RAM así, un test verde no dice nada de los tipos: antes de dar algo por cerrado, el typecheck
por el lock.

## Lo que falta
- **Verlo en producción (ws3)**: «Nueva hoja» (la caja, el «+», una plantilla armándose con datos), «Copiar dashboard» y pegarlo, el
  botón de MaKo editando y el clic derecho en el lienzo, un gráfico y un texto, mirando y editando.
- **Publicar una hoja en «Creaciones» (las estrellas)**: cuando la rama `api-acciones-1310` (chat API de MaKo) llegue a main. Los
  tres pasos, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».
- **Que Martín decida** si se borran `PulsoPaginas.tsx` + su ruta y su lib, y `ScriptsBrowser`/`GuionesFull` (~900 líneas sin usar).
- **Copiar un dashboard por la API de MaKo** (`copiar_dashboard`, `pegar_dashboard`).
- **El teléfono (`/m/dashboard`)** le sigue mostrando Marketing y Comercial fijos a quien no tiene informe.
- El resto, en `docs/hallazgos-graficos.md` → «Lo que quedó sin hacer».

**Pushes:** el orden lo coordina «Estrategia 3 CUENTAS» (GENERAL → CRM → Content Machine → API de MaKo, después Graphics). Antes de
pushear, avisarle; nada de `tsc` completos fuera de turno.
