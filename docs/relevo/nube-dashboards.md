# Relevo — las hojas del Dashboard (4/11/2026, chat en la nube)

## ⛔ LO PRIMERO: Martín rechazó las 20 hojas (4/11/2026, por el Cerebro)

Textual: *«Me dijiste que me dejaste los 20 dashboard ahí y son dashboard todos iguales, horribles, que no era la idea que yo
quiero. Recuerda lo que habíamos empezado a hacer en donde habíamos empezado a hacer el dashboard de Focus, hicimos de manera
muy personalizada sobre todo copiando lo que tiene la otra página, y ahora lo que hiciste fue agarrar un template y
estandarizarlo para todos. Eso no me gusta. Quiero hacerlo de manera muy personalizada, cada dashboard. Te pido por favor que
sea de esa manera y que te centres en que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después
la adaptación con Maco. Es decir, tienes que buscar entre todos los dashboards que vamos a copiar ver cuál se adapta más al
template que queremos crear, por ejemplo de Closing Analysis, agarrar ese y agarrar elementos, sacar otros, etcétera. Pero
copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic, copiarlo absolutamente
todo. Esa era la idea.»*

**Lo que cambia** (las instrucciones del Cerebro):
1. **Nada de una base común que se repite.** Cada hoja es su propio diseño: su maqueta, sus gráficos, sus proporciones, su
   ritmo. Se comparten utilidades de datos, no la apariencia.
2. **Primero la copia exacta, después la adaptación.** Para cada hoja se elige el demo que mejor calza y se replica tal cual
   (letra, espaciados, colores, sombras, radios, grilla, tamaños). Recién después se cambian datos y textos, y se sacan o se
   agregan piezas, con los datos reales de MaKo.
3. **Se copian las animaciones**: entrada, hover y clic, con sus tiempos y curvas, y el comportamiento (tooltips, filtros,
   transiciones entre estados). Se miden en el demo real, sin inventar.
4. **El molde es Focus**: la maqueta original (`docs/diseno/mockups-dashboard/focus-pane.html`, commit `ee224623`), no las
   hojas de la base.
5. **Una hoja por vez**, empezando por Closing, con la copia al lado del original captura contra captura. Nunca en cadena.
6. Las 20 actuales se quedan hasta que cada una tenga su reemplazo, y una hoja que alguien ya creó no cambia sola.

### ⛔ BLOQUEADO EN LA NUBE: el entorno no deja entrar a `demo.codeandchill.store`

Medido el 4/11/2026 a las 10:31 UTC: el proxy de esta sesión contesta **403 al CONNECT** a `demo.codeandchill.store:443`
(denegado por la política de red del entorno). Sin eso no se puede ver, medir ni capturar ningún demo, así que **Closing no se
empezó**: una copia sin mirar el original sería inventarla, que es justo lo que se rechazó.

**Dos formas de destrabarlo:**
- **Desde la nube:** agregar `demo.codeandchill.store` en *Allowed domains* del acceso de red del entorno (menú del entorno en
  la barra del título de la sesión → Edit). Con eso, esta sesión mide y captura sola.
- **Desde la PC:** correr lo de abajo y commitear lo que sale en `docs/diseno/mockups-dashboard/demos/<demo>/`.

**Para elegir la referencia de Closing** hay que mirar los candidatos lado a lado: Halden (Dashboard y Reports, las páginas que
informan), Tandem, Moorly y Selvar (las cuotas y los vendedores). La elección se hace con las capturas, no con la descripción.

```bash
cd docs/diseno/mockups-dashboard/medidor
# La entrada (GSAP, leída del bundle): el orden, los delays y los selectores de cada página.
python -I medir-demo.py halden dashboard
python -I medir-demo.py halden reports
python -I medir-demo.py tandem dashboard
python -I medir-demo.py moorly dashboard
python -I medir-demo.py selvar dashboard
# Lo quieto, el hover y el clic: la captura a 1440 y a 390, las variables, la letra, cada panel, y cada control en
# reposo, al pasar el cursor y al apretar (con su transición declarada). Playwright va fuera del repo:
#   (en una carpeta aparte) npm i playwright && npx playwright install chromium
NODE_PATH=<esa carpeta>/node_modules node capturar.mjs https://demo.codeandchill.store/halden/ ../demos/halden/captura --telefono
NODE_PATH=<esa carpeta>/node_modules node capturar.mjs https://demo.codeandchill.store/tandem/ ../demos/tandem/captura --telefono
NODE_PATH=<esa carpeta>/node_modules node capturar.mjs https://demo.codeandchill.store/moorly/ ../demos/moorly/captura --telefono
NODE_PATH=<esa carpeta>/node_modules node capturar.mjs https://demo.codeandchill.store/selvar/ ../demos/selvar/captura --telefono
```

⚠️ Si la página de un demo no es la raíz (Halden tiene Dashboard y Reports), `capturar.mjs` recibe la URL de esa página.
`capturar.mjs` se probó sobre la maqueta de Focus servida en local (9 paneles, 31 estilos de letra, 35 variables, el hover de
un botón con su transición); contra un demo real no se pudo probar desde acá.

---

## Lo que se hizo antes del rechazo (sigue en producción hasta que cada hoja tenga su reemplazo)

Martín, textual: *«Haz todo lo de los dashboards, habiamos quedado que lo haces tu y luego me envias todo para yo
aprobarlas, pero subelas a producción directo y los reviso allí. Y no solo 4, haz todo...»*.

Cada hoja es UNA punta, `punta/dash-<hoja>`, encima de `origin/main`, y llega sola a `main` si da verde. Se subieron
**en cadena** (cada punta lleva a las anteriores): todas tocan las mismas listas (`PORTADAS_GENERAL`, `portadasDashboard`,
los colores) en líneas vecinas, y en paralelo chocaban al mezclar main. La base de todas fue `punta/dash-base` (en `main`
desde el 4/11, 07:39 UTC). Lo aprendido, en [hallazgos-templates-dashboard.md](../hallazgos-templates-dashboard.md) §10.

## Dónde mirarlas

**`/dashboard` → «Nueva hoja»**: la galería muestra las 20 juntas (las de General primero). Elegir una arma la hoja en
tu informe; borrarla no toca nada más. Una hoja que ya habías creado antes desde una plantilla **no cambia**: la plantilla
sólo arma hojas nuevas. Para ver la versión nueva de una que ya tienes, se crea otra vez desde «Nueva hoja».

Lo que comparten todas:

- **Abren con una frase** que dice lo que pasa en una línea, con los números del negocio resaltados. Un tramo cuyo número
  no se pudo leer no se dibuja (nunca «falta»).
- **Al pie de un bloque, «Ver … →»** lleva a la pantalla donde eso se trabaja (CRM, Clients, Ads Manager…).
- **Un número oscuro por fila, el ancla**: el que contesta la pregunta de la hoja.
- **Los paneles conservan su subtítulo** en castellano llano; los números no (les come el alto).
- **En el teléfono** la frase va arriba, como texto.

## Las 20 hojas

| Hoja | Id | Referencias | La pregunta | El ancla | Punta |
|---|---|---|---|---|---|
| General | `general` | Orvel · Corbel | ¿cómo viene el negocio y qué me está esperando? | Cobrado | `punta/dash-general` |
| Focus | `foco` | Pane · Lumora | ¿en qué estoy ahora y qué me queda hoy? | — (la frase de lo que te queda) | `punta/dash-focus` |
| Operación diaria | `operacion` | Moorly · Torque | ¿qué está vencido y a quién llamo? | Por cobrar | `punta/dash-operacion` |
| Agencia o servicio | `servicio` | Sunrow · Torque | ¿cada cliente va en fecha? | Avanzaron de etapa | `punta/dash-servicio` |
| Curso o comunidad | `curso` | Lumora · Vitrea | ¿cuántos siguen ahí? | Alumnos activos | `punta/dash-curso` |
| Instagram y redes | `instagram` | Murmura · Kestrel | ¿qué publicación trajo gente de verdad? | Tocan el anuncio | `punta/dash-instagram` |
| Marketing | `marketing` | Kestrel · Ondra | ¿cuánto cuesta una agenda y de qué anuncio vino? | Costo por agenda | `punta/dash-marketing` |
| Comercial | `comercial` | Coffer · Corbel · Prism · Orvel · Pelago · Selvar | ¿convierte, y a qué costo? | Tasa de cierre | `punta/dash-comercial` |
| Cobranza | `cobranza` | Coffer · Corvane · Talvo | ¿qué plata está prometida y no entró? | Cobrado | `punta/dash-cobranza` |
| Anuncio ganador | `ads-analyst` | Vitrea · Prism | ¿cuál creativo gana, y con cuánta confianza? | Listos para escalar | `punta/dash-anuncio-ganador` |
| Hooks y retención (nueva) | `hooks-retencion` | Vitrea · Murmura | ¿en qué parte se van, y qué hook los retuvo? | Hook rate | `punta/dash-hooks` |
| Landing | `landing` | Corbel · Kestrel | ¿hasta dónde bajan y dónde hacen clic? | Llegan a la mitad | `punta/dash-landing` |
| VSL y YouTube | `vsl-analyst` | la forma de Hooks, otra fuente | ¿quién llega al final y ésos compran más? | Llegan al final | `punta/dash-vsl` |
| Chat Analyst | `chat-analyst` | Parley · Tend | ¿cuánto tardamos en contestar? | Tiempo de respuesta | `punta/dash-chat` |
| Closing | `closing` | Halden · Moorly · Tandem | ¿por qué se cerró o no, y quién cierra mejor? | Tasa de cierre | `punta/dash-closing` |
| CS Analyst | `cs-analyst` | Mender · Vitrea | ¿quién necesita atención, y cuántos se van? | Se dieron de baja | `punta/dash-cs` |
| Productividad | `productividad` | Fernly · Sunrow | ¿qué avanza y qué se estancó? | Avance global | `punta/dash-productividad` |
| Automatizaciones | `automatizaciones` | Noria | ¿qué salió, qué falló y en cuánto responden? | Fallaron | `punta/dash-automatizaciones` |
| Contenido e IA | `ia-contenido` | Orrery | ¿cuánta IA gastamos y en qué? | Costo de la IA | `punta/dash-ia-contenido` |
| Inmobiliaria (nueva, por rubro) | `inmobiliaria` | Lintel (sólo su Overview) | ¿cuántos visitan, cuántos compran y en qué proyecto? | Compran, de los que visitan | `punta/dash-inmobiliaria` |

**Las que se fueron** (las absorbe otra; un link o un agente que las nombre llega a la nueva): **CRM y pipeline** y
**Ventas del mes** → Comercial. **Ads Analyst** se partió en Anuncio ganador (que se queda su id: `/ads-analyst` llega
ahí) y Hooks y retención.

**Las que cambiaron de nombre y no de id** (las hojas guardadas y los links siguen andando): Ads Analyst → Anuncio
ganador, Instagram → Instagram y redes, VSL Analyst → VSL y YouTube, Foco de la semana → Focus. Se encuentran por el
nombre de antes en el buscador de «Nueva hoja».

## Lo que NO se pudo ver

- **Ninguna hoja se vio dibujada con datos reales.** Esta sesión no tiene producción ni base. Se verificó la composición
  (qué pieza va dónde, con un script sobre `componentesDe`), los tests de las plantillas (más de 700) y los tipos enteros.
  Lo primero que hay que mirar en producción: que ninguna frase quede vacía en un negocio con datos, y que los «Ver … →»
  lleven a la pantalla correcta.
- **La miniatura de cada plantilla en «Nueva hoja»** se arma con los mismos datos de ejemplo de siempre; no se miró.

## Lo que las hojas NO prometen, porque MaKo no lo mide

- **Retención por SEGUNDO del video**: Hooks y VSL van por cuartiles (25/50/75/100 %, lo que manda Meta).
- **Confianza estadística de un A/B**: Anuncio ganador usa la confianza por muestra (impresiones: alta desde 25.000).
- **Cohortes de permanencia M0…M5**: Curso mide quién vio clases en el período.
- **Motivos de baja**: el `motivo` de la cartera es el de la SEÑAL. CS dice «Por qué piden atención», no «por qué se van».
- **Tiempo de foco por tarea**: Focus no tiene el temporizador de Pane.
- **Horas ahorradas** por una automatización: Automatizaciones dice en cuántas horas responden.
- **«En fecha» por cliente**: la entrega no guarda una fecha comprometida por etapa; Agencia mide cuándo llegó cada uno.
- **Vistas de YouTube**: hoy las tiene un solo cliente; para los demás, Vistas del VSL y Costo por vista quedan sin dato.

## Lo que no se tocó

- **Ninguna migración.** Todo sale de conjuntos que ya existían.
- **Las hojas guardadas** de cada persona no cambian.
- **La API de MaKo** ya podía armar cada hoja (`crear_hoja_dashboard` con su plantilla) y desde la base cada gráfico
  acepta `frase` e `ir` (`agregar_grafico_dashboard`, `editar_grafico_dashboard`); `docs/api-mako.md` está regenerado.
