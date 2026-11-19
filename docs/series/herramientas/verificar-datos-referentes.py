"""Arma artefacto-datos.json desde los reels.json de las tres cuentas.

Uso:  python armar_datos.py            -> imprime el JSON
      python armar_datos.py --check F  -> compara el archivo F con lo que arma (y valida reglas)
"""
import sys, json, re, math, collections, statistics as st, datetime as dt

sys.stdout.reconfigure(encoding='utf-8')
BASE = 'C:/dev/referentes-videos'
HOY = dt.date(2026, 11, 19)
med = st.median

def fecha(x):
    f = x['fecha']; return dt.date(int(f[:4]), int(f[4:6]), int(f[6:]))
def mil(n): return f"{int(round(n)):,}".replace(',', '.')
from decimal import Decimal, ROUND_HALF_UP
def hu(x, k=1): return float(Decimal(repr(x)).quantize(Decimal(1).scaleb(-k), rounding=ROUND_HALF_UP))
def dec(x, k=1): return f"{hu(x, k):.{k}f}".replace('.', ',')
def por(x, k=2): return '×' + dec(x, k)

R = {c: json.load(open(f'{BASE}/{c}/reels.json', encoding='utf-8')) for c in ('ramiro', 'victor', 'hormozi')}
T = {c: json.load(open(f'{BASE}/{c}/temas.json', encoding='utf-8')) for c in R}
META = {c: {x['id']: json.load(open(f"{BASE}/{c}/{x['id']}/meta.json", encoding='utf-8')) for x in R[c]} for c in R}
NUM = {c: {x['n']: x for x in R[c]} for c in R}

def fijado(c, x): return x['n'] in (1, 2) if c == 'victor' else bool(x.get('fijado'))
def maduro(c, x):
    if fijado(c, x): return False
    if c == 'ramiro': return fecha(x) < dt.date(2026, 11, 17)
    if c == 'hormozi': return bool(x['mas_de_48h'])
    return True  # Víctor: los 33 no fijados (como el relevo verificado)
VFORMA = {'persona-a-camara': 'persona a cámara', 'situacion-actuada': 'sketch o situación actuada con gente real',
          'texto-en-pantalla': 'montaje sin voz: texto fijo + canción', 'otro': 'efecto visual'}
def forma(c, x): return VFORMA[x['gancho_tipo']] if c == 'victor' else x['forma']
def mads(c, xs=None): return [x for x in (R[c] if xs is None else xs) if maduro(c, x)]
MED = {c: med([x['reproducciones'] for x in mads(c)]) for c in R}

# --- a igual edad -------------------------------------------------------------
def vecinos_3d(c):  # método del crítico de Hormozi: cada maduro contra la mediana de los maduros a ±3 días (sin él)
    m = mads(c); out = {}
    for x in m:
        v = [y['reproducciones'] for y in m if y is not x and abs((fecha(y) - fecha(x)).days) <= 3]
        out[x['id']] = x['reproducciones'] / med(v)
    return out
def vecinos_6(c):  # método del crítico de Víctor: contra los 6 más cercanos en fecha
    m = sorted(mads(c), key=fecha); out = {}
    for x in m:
        o = sorted([y for y in m if y is not x], key=lambda y: abs((fecha(y) - fecha(x)).days))[:6]
        out[x['id']] = x['reproducciones'] / med([y['reproducciones'] for y in o])
    return out
VEC = {'ramiro': vecinos_3d('ramiro'), 'hormozi': vecinos_3d('hormozi'), 'victor': vecinos_6('victor')}
def vec_grupo(c, xs):
    v = [VEC[c][x['id']] for x in xs if x['id'] in VEC[c]]; return med(v) if v else None
def mitades_h(xs):
    a = [x for x in mads('hormozi') if fecha(x) <= dt.date(2026, 11, 5)]
    b = [x for x in mads('hormozi') if fecha(x) >= dt.date(2026, 11, 6)]
    ma, mb = med([x['reproducciones'] for x in a]), med([x['reproducciones'] for x in b])
    ids = {x['id'] for x in xs}
    pa = [x['reproducciones'] for x in a if x['id'] in ids]; pb = [x['reproducciones'] for x in b if x['id'] in ids]
    return (med(pa) / ma if pa else None), (med(pb) / mb if pb else None)
def spearman(a, b):
    def rk(v):
        s = sorted(range(len(v)), key=lambda i: v[i]); r = [0] * len(v); i = 0
        while i < len(s):
            j = i
            while j + 1 < len(s) and v[s[j + 1]] == v[s[i]]: j += 1
            for k in range(i, j + 1): r[s[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    ra, rb = rk(a), rk(b); ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    return sum((p - ma) * (q - mb) for p, q in zip(ra, rb)) / math.sqrt(sum((p - ma) ** 2 for p in ra) * sum((q - mb) ** 2 for q in rb))
SPEAR_R = spearman([(HOY - fecha(x)).days for x in mads('ramiro')], [x['reproducciones'] for x in mads('ramiro')])
# Ajuste por edad de Víctor: no se pudo replicar exacto; se toma del relevo verificado (victor.md, «Las formas de video»)
V_AJUSTE = {'persona a cámara': 1.0, 'sketch o situación actuada con gente real': 2.4,
            'montaje sin voz: texto fijo + canción': 1.5, 'efecto visual': 0.6}

def a_igual_edad(c, f, xs):
    m = mads(c, xs)
    if not m: return 'sin reels maduros: no cuenta'
    cr = med([x['reproducciones'] for x in m]) / MED[c]
    v = vec_grupo(c, xs)
    uno = '1 maduro: ' if len(m) == 1 else ''
    if c == 'ramiro':
        return f"{uno}{por(v)} contra sus vecinos de fecha (crudo {por(cr)})"
    if c == 'hormozi':
        a, b = mitades_h(xs)
        mit = ' y '.join(por(z) for z in (a, b) if z is not None)
        if len(m) == 1: return f"1 reel: {por(v)} contra sus vecinos de fecha (crudo {por(cr)})"
        return f"{por(v)} contra sus vecinos de fecha; {mit} por mitad del período (crudo {por(cr)})"
    # victor: contra la cámara
    cam = [x for x in R['victor'] if forma('victor', x) == 'persona a cámara']
    vc = vec_grupo('victor', cam)
    if f == 'persona a cámara':
        return f"la referencia; {por(v)} contra sus 6 vecinos de fecha"
    crc = med([x['reproducciones'] for x in m]) / med([x['reproducciones'] for x in mads('victor', cam)])
    lo, hi = sorted([v / vc, V_AJUSTE[f]])
    pre = '1 reel: ' if len(m) == 1 else ''
    return f"{pre}{por(lo, 1)} a {por(hi, 1)} sobre la cámara (crudo {por(crc, 1)}); {por(v)} contra sus 6 vecinos de fecha"

# --- textos -------------------------------------------------------------------
GT = {'ia-exagerado': 'IA exagerada sobre rodaje real', 'sketch-ia-entero': 'sketch entero con IA', 'animado': 'animado',
      'persona-a-camara': 'persona a cámara', 'situacion-actuada': 'situación actuada', 'texto-en-pantalla': 'texto en pantalla',
      'b-roll': 'b-roll con texto'}
def gtipo(c, x):
    if x['gancho_tipo'] == 'otro': return forma(c, x)
    return GT[x['gancho_tipo']]
def corta(x):
    p = [f"{round(s['de'])} s {re.split(r'[:(]', s['que'])[0].strip()}" for s in x['estructura']]
    return ' · '.join(p) + f" · fin {round(x['duracion_s'])} s"
# Hormozi: citas traducidas al español (15 palabras como máximo)
HES = {
    2: '¿Por qué se van mis empleados? (cartel)',
    16: 'Nunca bajes tu precio para ganar un cliente',
    43: '10 reglas para GANAR en los negocios (cartel) · véndele a la gente rica: paga mejor',
    23: 'Así se hacen los anuncios (cartel: «Cómo hago 450 anuncios»)',
    36: '¿Cómo hacen tan poco? (cartel con su reacción)',
    28: 'Lo tengo que hablar con mi pareja, mi perro, mi rabino…',
    37: 'Aquí van 15 años de consejos de venta en 60 segundos',
    22: 'Vi a alguien desconocido venderle a una pareja un paseo en helicóptero de US$2.000',
    35: 'Si tuviera que enseñarle a vender a alguien de la calle en 14 días',
    24: 'Mi equipo no vende como yo (cartel)',
    44: 'No consigo suficientes clientes (cartel)',
    27: 'Este error de impuestos nos costó 29 millones de dólares (cartel)',
    34: 'No tengo un proceso de ventas (cartel) · tengo un parque infantil bajo techo',
    40: 'Un mal fichaje es peor que una silla vacía (cartel)',
    25: '¿Por qué se van mis empleados? (su propio clip del taller)',
    45: 'Por el amor de Dios, ponte en forma',
}
def cita(c, x):
    if c == 'hormozi': return HES[x['n']]
    return x['gancho_cita']

DEF = {
 'ramiro': {
  'Ballenas, no quebrados (nicho y ángulos)': 'Te escriben curiosos y gente sin plata porque tu contenido es viral o genérico; la promesa es anicharte y hablar con ángulos (un paradigma nuevo para el problema de siempre) que atraen a quien paga de 3.000 a 10.000 por adelantado.',
  'La IA (Claude) hace el trabajo': 'Producir contenido o contestar mensajes te obliga a pagar editor, setters o agencia; la promesa es que Claude edite, anime, publique y filtre los mensajes por ti, sin equipo.',
  'Follow me ads y anuncios': 'Los anuncios te salen caros o te traen gente que no califica; la promesa es correr bien follow me ads, retargeting o campañas de reconocimiento: qué contenido promocionar, qué KPI mirar, qué reglas automáticas poner.',
  'Sistema de adquisición: embudo, webinars, historias': 'Tu audiencia mira pero no agenda llamadas calificadas; la promesa es el camino completo para convertirla: embudo de contenido (TOFU-MOFU-BOFU), webinars, historias y retargeting. Incluye la receta de punta a punta aunque no nombre el embudo.',
  'Rentabilidad: margen, backend y plata perdida': 'Facturas pero te queda poco, o sigues pagando algo que no da resultados; la promesa es un margen del 70 %, vender más a quien ya es cliente (backend) y una base orgánica que abarata los anuncios.',
  'Trazabilidad: qué contenido trae plata': 'Subes contenido todos los días y no sabes cuál vende; la promesa es medir leads, llamadas y cobros por cada pieza (su CRM) y repetir los temas que traen plata. Va aquí sólo si el reel nombra o muestra la medición.',
 },
 'victor': {
  'Mentalidad: miedo, riesgo y constancia': 'Lo que frena por dentro a quien mira: miedo a fracasar o a perder, no intentarlo, no cumplir metas, rendirse; se responde con disciplina, constancia y su historia de antes y después.',
  'Lujo y humor de millonario': 'Su vida (jet, Ferrari, compras caras) con humor, memes de tendencia, ironía ante la crítica o provocación política; sin lección ni oferta.',
  'Tu entorno': 'Las personas de tu vida: amistades, pareja, quienes te critican, gente que te usa; con quién te juntas decide en quién te conviertes. Va aquí cuando el tema son las otras personas, no el miedo propio.',
  'Crecer en redes': 'Ganar seguidores o viralizar una cuenta: el reto de 100.000 en 30 días, el caso de un cliente, la clase gratis; la promesa es la cifra de seguidores. Si habla de seguidores y de dinero, decide lo que regala el CTA.',
  'Ganar dinero con contenido': 'El contenido como negocio: cuánto se gana haciendo videos para marcas o con una marca personal, y lo que cobra Víctor; la promesa es dinero, no seguidores.',
  'El dinero sí importa': 'Defensa del dinero frente a quien dice que no importa: lo que cuesta ser pobre, la libertad que da, por qué unos ganan más que otros (valor percibido).',
 },
 'hormozi': {
  'Cerrar la venta': 'Lo que pasa dentro de la conversación de venta: guion, tono, objeciones, precio y descuentos, calificar y educar al prospecto, agenda y asistencia; la promesa es cerrar más con los mismos prospectos. Si le sirve igual a quien vende sin equipo, va aquí.',
  'Foco y decisiones al frente del negocio': 'Cómo decide y se maneja quien dirige el negocio: foco en una sola cosa, el cuello de botella de hoy, metas, socios, vender o no la empresa, disciplina y reglas generales para ganar.',
  'Armar el equipo de ventas': 'Contratar, entrenar, pagar y motivar a quienes venden (setters y closers) para que el equipo venda sin depender de quien fundó el negocio. Sólo lo que necesita a otras personas vendiendo por ti.',
  'Conseguir clientes': 'Que lleguen más prospectos o se agenden más llamadas: anuncios, contenido, landing, VSL, una oferta de captación, la regla de 100; la promesa es más leads.',
  'Más plata por cliente': 'Ganar más con lo que ya vendes o quedarte con más: qué producto empujar (LTV contra CAC), subir precios, upsell, impuestos; la promesa es más margen sin más clientes. Va aquí lo que se le vende a quien ya es cliente.',
  'Gente que rinda y se quede': 'El resto del equipo (no quienes venden): entrenar para que el negocio no dependa de quien lo dirige, retener con una escalera de carrera, sacar a quien no rinde.',
 },
}

def tema_xs(c, t): return [x for x in R[c] if x['tema'] == t]
def com_med(c, xs): return med([META[c][x['id']]['comentarios'] for x in xs])
def cnt(xs, f): return sum(1 for x in xs if f(x))

def porque(c, t):
    xs = tema_xs(c, t); m = mads(c, xs)
    if c == 'ramiro':
        return {
         'Ballenas, no quebrados (nicho y ángulos)': f"Es el dolor de todos los días: la bandeja llena de gente que pregunta el precio y no paga. Es el que más repite ({len(xs)} de 50) pero rinde {por(vec_grupo(c, xs))} a igual fecha: sirve de fondo, no de apuesta.",
         'La IA (Claude) hace el trabajo': f"Ahorra el costo más visible (el editor, el setter) y es novedad; regala la herramienta y eso dispara los comentarios (mediana {mil(com_med(c, xs))} por reel).",
         'Follow me ads y anuncios': "Mucha gente ya paga anuncios y ve subir el costo por seguidor; les habla con sus números (qué KPI mirar según el ticket).",
         'Sistema de adquisición: embudo, webinars, historias': "Le da un mapa a quien tiene seguidores pero no llamadas.",
         'Rentabilidad: margen, backend y plata perdida': "Toca el ego: muestra ganancia, no facturación.",
         'Trazabilidad: qué contenido trae plata': f"Quien ya publica y no vende siente que trabaja gratis; la promesa es dejar de adivinar. Ojo: sus {len(m)} reels maduros son {'sketches con IA' if all(x['forma'] == 'sketch entero con IA' for x in m) else 'mezcla de formas'}, la forma que mejor le rinde: tema y forma no se separan.",
        }[t]
    if c == 'victor':
        fij = [x for x in xs if fijado(c, x)]
        return {
         'Mentalidad: miedo, riesgo y constancia': "Le habla a gente joven con trabajos mal pagados; el freno es el miedo y Víctor se pone de ejemplo: de repartir pizzas al Ferrari. Ojo: a igual edad queda entre los dos temas que menos rinden.",
         'Lujo y humor de millonario': "Aspiración pura que se comparte; además es la prueba de que su método da plata.",
         'Tu entorno': "Lo social duele: las amistades que no avanzan, la pareja, quienes critican.",
         'Crecer en redes': f"Es su bio y su producto: una cifra concreta con un caso real. Ojo: los {len(xs)} son de abril a julio y llevan meses sumando reproducciones.",
         'Ganar dinero con contenido': f"Promete un oficio con el que se gana sin título ni capital. Sus {len(fij)} fijados de 2024 ({' y '.join(mil(x['reproducciones']) for x in sorted(fij, key=lambda x: -x['reproducciones']))}) son de este tema y no entran en la mediana.",
         'El dinero sí importa': "Polémico y validante: le da permiso a quien quiere ganar más.",
        }[t]
    return {
     'Cerrar la venta': f"Es lo que mejor sabe y lo dice: lo de ventas siempre le arrasa; deja una frase para usar mañana en la llamada. {cnt(xs, lambda x: x['forma'] == 'a cámara en estudio blanco')} de los {len(xs)} son del estudio blanco.",
     'Foco y decisiones al frente del negocio': f"Le habla a la persona, no al negocio, y se comparte. Ojo: {cnt(m, lambda x: x['cta_tipo'] == 'ninguno')} de sus {len(m)} maduros no piden nada; a igual edad sigue arriba ({por(vec_grupo(c, xs))} contra sus vecinos de fecha).",
     'Armar el equipo de ventas': f"Es el tema del producto que lanza, y el que menos rinde: {cnt(xs, lambda x: x['cta_tipo'] != 'ninguno')} de {len(xs)} piden comentar para el lanzamiento ({por(vec_grupo(c, xs))} contra sus vecinos de fecha).",
     'Conseguir clientes': "El dolor más directo («no consigo suficientes clientes») con el caso de un negocio chico y sus números.",
     'Más plata por cliente': "Cifras grandes y concretas: plata que ya tienes y estás dejando ir. Ojo: el #34 es el fijado #1 resubido con otro cartel.",
     'Gente que rinda y se quede': f"El dolor de todo negocio de servicios: entrenas a alguien y se va con tus clientes. El reel más visto de la cuenta, el fijado de {mil(NUM['hormozi'][2]['reproducciones'])}, es de este tema.",
    }[t]

GANCHO_CITA = {  # reel del que sale la cita de cada molde (las del relevo verificado)
 'ramiro': {'respuesta suelta de una llamada, con título': 38, 'contra la creencia común': 11, 'parodia de película o escena absurda': 13,
            '«cómo hacer X» + tutorial paso a paso': 36, 'cifra de resultado + «te explico mi sistema»': 27, 'imitar al cliente (su queja u objeción)': 20},
 'victor': {'afirmación tajante o cruda': 15, 'parodia o sketch con giro': 31, 'el lujo como gancho (cifra, compra u objeto caro)': 2,
            'promesa (número o profecía)': 17, 'historia personal de antes y después': 3, 'contra la creencia común': 23},
 'hormozi': {'pregunta o queja del público como título': 2, 'afirmación tajante': 16, 'lista con número': 43,
             'cómo hacer X / cómo lo hago yo': 23, 'la frase de Hormozi como título': 36, 'queja u objeción del cliente entre comillas': 28},
}
def ganchos(c):
    g = collections.defaultdict(list)
    for x in R[c]: g[x['gancho_patron']].append(x)
    def gm(xs):
        v = [x['reproducciones'] for x in mads(c, xs)]; return med(v) if v else 0
    top = sorted(g.items(), key=lambda kv: (-len(kv[1]), -gm(kv[1])))[:6]
    out = []
    for p, xs in top:
        n = GANCHO_CITA[c][p]; x = NUM[c][n]
        assert x['gancho_patron'] == p, (c, p, n)
        out.append({'patron': p, 'veces': len(xs), 'cita': cita(c, x)})
    return out

def ejemplo(c, x):
    return {'id': x['id'], 'url': f"https://www.instagram.com/reel/{x['id']}/", 'reproducciones': x['reproducciones'],
            'gancho_cita': cita(c, x), 'gancho_tipo': gtipo(c, x), 'estructura_corta': corta(x)}
def temas(c):
    out = []
    orden = sorted({x['tema'] for x in R[c]} - {'otros'},
                   key=lambda t: (-len(tema_xs(c, t)), -med([x['reproducciones'] for x in mads(c, tema_xs(c, t))]), t))
    defs = {d['tema'] for d in T[c]}
    for t in orden:
        assert t in defs, t
        xs = tema_xs(c, t); m = mads(c, xs)
        top = sorted(m, key=lambda x: -x['reproducciones'])[:2]
        out.append({'tema': t, 'definicion': DEF[c][t], 'reels': len(xs), 'porcentaje': round(100 * len(xs) / len(R[c]), 1),
                    'repro_mediana': int(med([x['reproducciones'] for x in m])), 'porque': porque(c, t),
                    'ejemplos': [ejemplo(c, x) for x in top]})
    return out
def mejores(c):
    m = sorted(mads(c), key=lambda x: -x['reproducciones'])[:5]
    return [{'id': x['id'], 'url': f"https://www.instagram.com/reel/{x['id']}/", 'reproducciones': x['reproducciones'],
             'multiplo': round(x['reproducciones'] / MED[c], 2), 'tema': x['tema'], 'gancho_cita': cita(c, x),
             'estructura_corta': corta(x)} for x in m]
def formas(c):
    g = collections.defaultdict(list)
    for x in R[c]: g[forma(c, x)].append(x)
    out = []
    for f, xs in sorted(g.items(), key=lambda kv: -len(kv[1])):
        m = mads(c, xs)
        out.append({'forma': f, 'reels': len(xs), 'repro_mediana': int(med([x['reproducciones'] for x in m])) if m else None,
                    'a_igual_edad': a_igual_edad(c, f, xs)})
    return out

# --- números para estructura y producción ------------------------------------
def segs(x): return [s['de'] for s in x['estructura']]
def r1(v): return hu(v, 1)
PD = [x for x in R['ramiro'] if x['forma'].startswith('pantalla dividida')]
RC = [x for x in R['ramiro'] if x['forma'] == 'recorte de llamada']
VA = [x for x in R['victor'] if x['gancho_tipo'] == 'persona-a-camara' and x['cta_tipo'] == 'ninguno']
VA_ALL = [x for x in R['victor'] if x['gancho_tipo'] == 'persona-a-camara']
HB = [x for x in R['hormozi'] if x['forma'] == 'a cámara en estudio blanco']
HBC = [x for x in HB if x['cta_inicio_s'] is not None]
assert len(PD) == len(RC) == 12

pd_g, pd_3, pd_cta, pd_dur = med([x['gancho_fin_s'] for x in PD]), med([segs(x)[2] for x in PD]), med([x['cta_inicio_s'] for x in PD]), med([x['duracion_s'] for x in PD])
pd_sop = cnt(PD, lambda x: x['cta_palabra'] == 'SOP')
pd_txt = cnt(PD, lambda x: x['gancho_tipo'] == 'texto-en-pantalla')
va_g, va_3, va_u, va_dur = med([x['gancho_fin_s'] for x in VA]), med([segs(x)[2] for x in VA if len(segs(x)) > 2]), med([segs(x)[-1] for x in VA]), med([x['duracion_s'] for x in VA])
hb_g, hb_dur = med([x['gancho_fin_s'] for x in HB]), med([x['duracion_s'] for x in HB])
hb_pct = med([x['cta_inicio_s'] / x['duracion_s'] for x in HBC]); hb_cta = hb_pct * hb_dur
hb_clip = cnt(HB, lambda x: x['cta_clip_aparte'])

ESTR = {
 'ramiro': [
  {'de': 0, 'a': r1(pd_g), 'que': f'gancho: titular escrito ({pd_txt} de {len(PD)}) o Ramiro a cámara con un titular enorme; Ramiro en cuadro desde el segundo 0', 'tipo': 'persona'},
  {'de': r1(pd_g), 'a': r1(pd_3), 'que': 'planteo o primer caso, con la pizarra cuadriculada arriba y Ramiro abajo', 'tipo': 'persona'},
  {'de': r1(pd_3), 'a': r1(pd_cta), 'que': 'los pasos o los casos de clientes con cifras, numerados y encerrados en la pizarra', 'tipo': 'persona'},
  {'de': r1(pd_cta), 'a': r1(pd_dur), 'que': f'CTA «comentá PALABRA» por un regalo ({pd_sop} de {len(PD)} piden SOP)', 'tipo': 'cta'},
 ],
 'victor': [
  {'de': 0, 'a': r1(va_g), 'que': 'gancho: frase cruda o pregunta a cámara, a veces escrita arriba', 'tipo': 'persona'},
  {'de': r1(va_g), 'a': r1(va_3), 'que': 'lista de ejemplos o un dato (famosos que fallaron, pares «difícil / más difícil»)', 'tipo': 'persona'},
  {'de': r1(va_3), 'a': r1(va_u), 'que': 'giro o lección', 'tipo': 'persona'},
  {'de': r1(va_u), 'a': r1(va_dur), 'que': f'cierre con su historia (de repartir pizzas al Ferrari); sin CTA en {len(VA)} de {len(VA_ALL)}', 'tipo': 'persona'},
 ],
 'hormozi': [
  {'de': 0, 'a': r1(hb_g), 'que': 'gancho: cartel rojo con un número o un dolor («8 formas de evitar un descuento») y la primera frase', 'tipo': 'persona'},
  {'de': r1(hb_g), 'a': r1(hb_cta), 'que': 'lista numerada en casi una sola toma: cada paso con su etiqueta y un dibujo, una placa o un objeto 3D', 'tipo': 'persona'},
  {'de': r1(hb_cta), 'a': r1(hb_dur), 'que': f'CTA «comenta SALES / TEAMS» ({len(HBC)} de {len(HB)}); clip grabado aparte en {hb_clip}', 'tipo': 'cta'},
 ],
}

def fondo(c):
    k = collections.Counter(); pis = []; dif = []
    for x in R[c]:
        f = x['fondo_sonoro']
        if f.startswith('fondo constante'):
            k['constante'] += 1
            m = re.search(r'(-?\d+(?:\.\d+)?) dB', f); m2 = re.search(r'(\d+(?:\.\d+)?) dB debajo', f)
            pis.append(float(m.group(1)));
            if m2: dif.append(float(m2.group(1)))
        elif f.startswith('sin fondo'): k['sin'] += 1
        else: k['otro'] += 1
    return k, med(pis), (med(dif) if dif else None)
def cpm(x): return x['cortes_por_min_recontado'] if x.get('cortes_por_min_recontado') is not None else x['cortes_por_min']
def cortes(c, xs=None): return med([cpm(x) for x in (R[c] if xs is None else xs)])
def pps(c, excl=()):
    return med([META[c][x['id']]['palabras_por_seg'] for x in R[c] if x['n'] not in excl and (META[c][x['id']]['palabras'] or 0) >= 30])
def cta_stats(c):
    cc = [x for x in R[c] if x['cta_inicio_s'] is not None]
    pal = collections.Counter(x['cta_palabra'] for x in R[c] if x['cta_palabra'])
    return len([x for x in R[c] if x['cta_tipo'] == 'comenta-palabra']), med([x['cta_inicio_s'] / x['duracion_s'] for x in cc]), med([x['duracion_s'] - x['cta_inicio_s'] for x in cc]), pal
def gancho(c, xs=None):
    v = [x['gancho_fin_s'] for x in (R[c] if xs is None else xs) if x['gancho_fin_s'] is not None]
    return med(v), min(v), max(v), len(v)
def per_dia(c):
    nf = [fecha(x) for x in R[c] if not fijado(c, x)]
    d0, d1 = min(nf), max(nf); dias = (d1 - d0).days + 1
    cn = collections.Counter(nf); por_dia = [cn.get(d0 + dt.timedelta(i), 0) for i in range(dias)]
    return len(nf) / dias, min(por_dia), max(por_dia), dias

rf, rp, rd = fondo('ramiro'); vf, vp, vd = fondo('victor'); hf, hp, hd = fondo('hormozi')
rcta = cta_stats('ramiro'); vcta = cta_stats('victor'); hcta = cta_stats('hormozi')
rg = gancho('ramiro'); vg = gancho('victor'); hg = gancho('hormozi')
VSINVOZ = (6, 10, 11, 14, 27, 28, 29, 35)  # los 8 sin la voz de Víctor (relevo verificado)
v_pps = med([META['victor'][x['id']]['palabras_por_seg'] for x in R['victor'] if x['n'] not in VSINVOZ])
r_pd, r_min, r_max, r_dias = per_dia('ramiro'); h_pd, h_min, h_max, h_dias = per_dia('hormozi')
vmes = collections.Counter(fecha(x).strftime('%m') for x in R['victor'] if fecha(x).year == 2026)
v_nf = sorted(fecha(x) for x in R['victor'] if not fijado('victor', x))
v_gap = med([(v_nf[i + 1] - v_nf[i]).days for i in range(len(v_nf) - 1)])
v_hueco = max((v_nf[i + 1] - v_nf[i]).days for i in range(len(v_nf) - 1))
r_persona0 = cnt(R['ramiro'], lambda x: x['paso_a_persona_s'] == 0)
r_tarde = [x['paso_a_persona_s'] for x in R['ramiro'] if x['paso_a_persona_s'] not in (0, None)]
r_nunca = cnt(R['ramiro'], lambda x: x['paso_a_persona_s'] is None)
r_film = cnt(R['ramiro'], lambda x: x['persona_real_desde_s'] == 0)
v_0 = cnt(R['victor'], lambda x: x['paso_a_persona_s'] == 0)
v_tarde = [x['paso_a_persona_s'] for x in R['victor'] if x['paso_a_persona_s'] not in (0, None)]
v_nunca = cnt(R['victor'], lambda x: x['paso_a_persona_s'] is None)
h_0 = cnt(R['hormozi'], lambda x: x['paso_a_persona_s'] == 0)
SK = [x for x in R['ramiro'] if x['forma'] == 'sketch entero con IA']
GIA = [x for x in R['ramiro'] if x['forma'] == 'gancho con IA + persona']
AN = [x for x in R['ramiro'] if x['forma'].startswith('animado')]
TA = [x for x in R['hormozi'] if x['forma'].startswith('taller')]
V_SK = [x for x in R['victor'] if x['gancho_tipo'] == 'situacion-actuada']
V_MO = [x for x in R['victor'] if x['gancho_tipo'] == 'texto-en-pantalla']
h_tit = cnt(R['hormozi'], lambda x: x['titulo_rojo'])
h_hablado = cnt(R['hormozi'], lambda x: x['cta_forma'] == 'hablado'); h_clip = cnt(R['hormozi'], lambda x: x['cta_forma'] == 'hablado' and x['cta_clip_aparte'])
h_lanz = [x for x in mads('hormozi') if fecha(x) >= dt.date(2026, 11, 4)]
h_lanz_cta = cnt(h_lanz, lambda x: x['cta_tipo'] != 'ninguno')
v_com = lambda xs: sum(META['victor'][x['id']]['comentarios'] for x in xs) / sum(x['reproducciones'] for x in xs) * 1000
v_nf_cta = [x for x in R['victor'] if not fijado('victor', x) and x['cta_tipo'] != 'ninguno']
v_nf_sin = [x for x in R['victor'] if not fijado('victor', x) and x['cta_tipo'] == 'ninguno']
v_cpk_con = med([META['victor'][x['id']]['comentarios'] / x['reproducciones'] * 1000 for x in v_nf_cta])
v_cpk_sin = med([META['victor'][x['id']]['comentarios'] / x['reproducciones'] * 1000 for x in v_nf_sin])
def top_pal(p, n=3): return ', '.join(f'{k} {v}' for k, v in p.most_common(n))

PROD = {
 'ramiro': {
  'gancho': f"Mediana {dec(rg[0])} s (de {dec(rg[1])} a {dec(rg[2], 0)}). Lo exagerado es la metáfora hecha imagen (la ballena es quien paga) o una escena absurda; con IA dura más: {dec(med([x['gancho_fin_s'] for x in SK]))} s en los sketches y {dec(med([x['gancho_fin_s'] for x in GIA]))} s en los {len(GIA)} ganchos con IA + persona.",
  'persona': f"Ramiro está filmado desde el segundo 0 en {r_film} de 50 y habla en serio desde el 0 en {r_persona0}; en {len(r_tarde)} entra en el segundo {dec(med(r_tarde), 0)} (mediana) y en {r_nunca} nunca (sketches con IA, animados y un b-roll).",
  'plano_luz_lugar': "Escritorio de madera con lámparas de pie para la pizarra (10), videollamadas (11), selfies en casa o en el auto y escenarios generados (7). Luz natural de día en 19 y cálida de estudio en 10.",
  'subtitulos': "En los 50, con un estilo por forma: palabra por palabra en caja negra o amarilla en la pantalla dividida, amarillo en cursiva con un título fijo en las llamadas, la frase gancho en una caja arriba en las selfies.",
  'ritmo': f"{dec(cortes('ramiro'), 2)} cortes por minuto de mediana: casi todo plano continuo ({cnt(R['ramiro'], lambda x: cpm(x) == 0)} de 50 sin ningún corte); los sketches con IA cortan {dec(cortes('ramiro', SK))} por minuto. Habla a {dec(pps('ramiro'))} palabras por segundo.",
  'sonido': f"Fondo constante debajo de la voz en {rf['constante']} de 50 (piso mediano {dec(rp, 0)} dB, la voz unos {dec(rd, 0)} dB arriba); la medición no distingue música de ambiente.",
  'cta': f"«Comentá PALABRA» a cambio de un regalo por DM en {rcta[0]} de 50 ({top_pal(rcta[3])}); empieza en el {dec(100 * rcta[1], 0)} % del video y dura unos {dec(rcta[2], 0)} s. Los {len(RC)} recortes de llamada no tienen CTA.",
 },
 'victor': {
  'gancho': f"Mediana {dec(vg[0])} s (de {dec(vg[1])} a {dec(vg[2])}) en los {vg[3]} que se pueden medir: {dec(gancho('victor', VA_ALL)[0])} s a cámara y {dec(gancho('victor', V_SK)[0])} s en los sketches. Lo exagerado lo hacen actores y su lujo real: IA en 0 de 35.",
  'persona': f"Habla a cámara desde el segundo 0 en {v_0} de 35; en {len(v_tarde)} aparece después (mediana {dec(med(v_tarde))} s, de {dec(min(v_tarde))} a {dec(max(v_tarde))}) y en {v_nunca} nunca habla en serio (montajes y sketches mudos).",
  'plano_luz_lugar': "Estudio en 10 (plano medio sentado; micrófono de podcast en 9), frente a su casa o sus coches en 5, el coche en 3 y el jet en 4. Luz natural de día en 15 y de estudio en 11.",
  'subtitulos': "Frase corta en blanco chico en 20 de 35; palabra por palabra sólo en 4; sólo texto fijo en 8. En el estudio, sobre el b-roll, la frase pasa a grande en serif (8 de 10).",
  'ritmo': f"{dec(cortes('victor'))} cortes por minuto de mediana: {dec(cortes('victor', [x for x in VA_ALL if x['n'] not in (3, 12)]))} a cámara en vertical, {dec(cortes('victor', V_SK))} en los sketches y {dec(cortes('victor', V_MO))} en los montajes. Habla a {dec(v_pps, 2)} palabras por segundo.",
  'sonido': f"Fondo constante en {vf['constante']} de 35 (piso mediano {dec(vp, 0)} dB, unos {dec(vd, 0)} dB debajo de la voz); ningún reel con su voz baja a silencio limpio entre frases.",
  'cta': f"Sólo {vcta[0]} de 35 piden algo, siempre «comenta PALABRA» por algo gratis ({top_pal(vcta[3], 2)}); empieza en el {dec(100 * vcta[1], 0)} % del video. Con CTA, {dec(v_cpk_con)} comentarios por cada 1.000 reproducciones; sin CTA, {dec(v_cpk_sin, 2)}.",
 },
 'hormozi': {
  'gancho': f"Mediana {dec(hg[0])} s (de {dec(hg[1])} a {dec(hg[2])}): el problema dicho por alguien real (taller) o una frase tajante con número (estudio), con el cartel rojo fijo en {h_tit} de 48. Avatar en ninguno; IA probable sólo en un reel (viñetas de cómic).",
  'persona': f"Hormozi está y habla en serio desde el segundo 0 en {h_0} de 48; en el taller, en pantalla dividida mientras habla quien pregunta.",
  'plano_luz_lugar': "Estudio de fondo blanco con mesa de madera, sentado en plano medio corto (21); escenarios y salas de taller (14). Luz de estudio suave y pareja en 22 y de evento en 14.",
  'subtitulos': "En 46 de 48; palabra por palabra en 37, blancos al centro con la palabra clave en negrita (en amarillo en los talleres).",
  'ritmo': f"{dec(cortes('hormozi'))} cortes por minuto de mediana, pero son dos mundos: {dec(cortes('hormozi', HB))} en el estudio blanco (casi una toma) y {dec(cortes('hormozi', TA))} en el taller (multicámara). Habla a {dec(pps('hormozi'))} palabras por segundo.",
  'sonido': f"Silencio entre frases (sin fondo) en {hf['sin']} de 48, los {len(TA)} talleres incluidos; fondo constante en {hf['constante']} (piso mediano {dec(hp, 0)} dB).",
  'cta': f"«Comenta PALABRA» en {hcta[0]} de 48 ({top_pal(hcta[3])}), casi todos desde el lanzamiento del 04/11 ({h_lanz_cta} de {len(h_lanz)} maduros); empieza en el {dec(100 * hcta[1], 0)} % del video, dura unos {dec(hcta[2], 0)} s y en {h_clip} de {h_hablado} hablados es un clip grabado aparte.",
 },
}

def fr(c):
    if c == 'ramiro': return f"{dec(r_pd)} reels por día ({r_dias} días, de {r_min} a {r_max} por día)"
    if c == 'hormozi': return f"{dec(h_pd)} reels por día ({h_dias} días seguidos, de {h_min} a {h_max} por día)"
    return f"A rachas: uno cada {dec(v_gap)} días (mediana), con un hueco de {v_hueco} días; {vmes['08']}, {vmes['09']}, {vmes['10']} y {vmes['11']} por mes de agosto a noviembre"

def m_forma(c, f): return vec_grupo(c, [x for x in R[c] if forma(c, x) == f])
cam_v = [x for x in R['victor'] if forma('victor', x) == 'persona a cámara']
sk_vs_cam = m_forma('victor', 'sketch o situación actuada con gente real') / m_forma('victor', 'persona a cámara')
sk_crudo = med([x['reproducciones'] for x in mads('victor', V_SK)]) / med([x['reproducciones'] for x in mads('victor', cam_v)])

RECETA = {
 'ramiro': f"Los mismos 6 temas cambiados de envoltorio: 8 formas de video, {dec(r_pd)} reels por día y «comentá PALABRA» por un regalo en {rcta[0]} de 50.\nLo que más rinde no es Ramiro hablando: el sketch entero con su avatar de IA y las animaciones hechas con Claude dan {por(m_forma('ramiro', 'sketch entero con IA'))} y {por(m_forma('ramiro', 'animado (motion graphics)'))} a igual fecha; la pizarra y las llamadas, casi la mitad de lo que sube, quedan en {por(m_forma('ramiro', 'pantalla dividida (pizarra + Ramiro)'))} y {por(m_forma('ramiro', 'recorte de llamada'))}.",
 'victor': f"Dos carriles: a cámara (frase cruda en los primeros 4 s, lista de ejemplos, cierre con su historia, casi nunca CTA) y sketches con gente real y su lujo verdadero que viran a Víctor explicando en serio y cierran con «comenta PALABRA».\nLo que más se ve son los sketches y las provocaciones ({mil(med([x['reproducciones'] for x in mads('victor', V_SK)]))} contra {mil(med([x['reproducciones'] for x in cam_v]))} a cámara), pero a igual edad la ventaja baja de {por(sk_crudo, 1)} a entre {por(sk_vs_cam, 1)} y {por(V_AJUSTE['sketch o situación actuada con gente real'], 1)}.",
 'hormozi': f"Dos fábricas: el taller en vivo (alguien del público dice su problema, va de cartel rojo y Hormozi lo resuelve de pie) y el estudio blanco (sentado, cartel con número y lista numerada en casi una toma).\nLo más visto es lo más simple y no pide nada: los 5 de mayor múltiplo no tienen CTA y 3 son una sola toma; el estudio blanco del lanzamiento queda en {por(m_forma('hormozi', 'a cámara en estudio blanco'))} a igual edad.",
}

ref = lambda c, nom, han, seg: {
    'cuenta': c, 'nombre': nom, 'handle': han, 'seguidores': seg, 'reels_mirados': len(R[c]), 'frecuencia': fr(c),
    'receta': RECETA[c], 'estructura': ESTR[c], 'produccion': PROD[c], 'formas': formas(c), 'temas': temas(c),
    'ganchos': ganchos(c), 'mejores': mejores(c)}

v31 = NUM['victor'][31]
ia_r = len(SK) + len(AN) + len(GIA)
gia_m = mads('ramiro', GIA)
COSTO = 0.024
TOP_PCT = [100 * max(collections.Counter(x['tema'] for x in R[c]).values()) / len(R[c]) for c in R]
RECETA_COMUN = [
 f"Pocos temas, siempre los mismos: 6 por cuenta (más un «otros» chico), y el más usado ocupa del {dec(min(TOP_PCT), 0)} al {dec(max(TOP_PCT), 0)} % del feed. Un tema es el dolor o la promesa, no el formato: lo que cambia de un reel a otro es el envoltorio.",
 f"El gancho es corto y arranca en el segundo 0: mediana de {dec(rg[0])} s en Ramiro, {dec(vg[0])} s en Víctor y {dec(hg[0])} s en Hormozi, casi siempre con la frase escrita en pantalla (el cartel rojo de Hormozi está en {h_tit} de 48).",
 f"La persona real está desde el principio: Hormozi en {h_0} de 48, Ramiro filmado desde el 0 en {r_film} de 50 y Víctor hablando a cámara desde el 0 en {v_0} de 35. Cuando hay una escena antes, la persona entra en el segundo {dec(med(v_tarde), 0)} (Víctor) o {dec(med(r_tarde), 0)} (Ramiro) de mediana.",
 "El cuerpo es una lista o unos pasos numerados con un caso real y sus cifras: el «mi cliente» de Ramiro, el Bernardo de Víctor, el negocio y la facturación de quien pregunta en el taller de Hormozi.",
 f"Un solo CTA y siempre el mismo: «comenta PALABRA» a cambio de un regalo concreto (un SOP, una clase, un entrenamiento), al final del video (desde el {dec(100 * rcta[1], 0)} %, el {dec(100 * vcta[1], 0)} % y el {dec(100 * hcta[1], 0)} %). Ninguno manda al link de la bio.",
 f"La forma de todos los días no es la que más rinde: a igual edad, la pizarra de Ramiro da {por(m_forma('ramiro', 'pantalla dividida (pizarra + Ramiro)'))} y el estudio blanco de Hormozi {por(m_forma('hormozi', 'a cámara en estudio blanco'))}, y Víctor a cámara queda debajo de sus sketches. Lo que sale de la rutina rinde más: el sketch con IA ({por(m_forma('ramiro', 'sketch entero con IA'))}), el recorte de podcast ({por(m_forma('hormozi', 'recorte de podcast'))}), el sketch con actores ({por(sk_vs_cam, 1)} a {por(V_AJUSTE['sketch o situación actuada con gente real'], 1)}).",
]
DIFERENCIAS = [
 f"La IA: Ramiro la usa en {ia_r} de 50 ({len(SK)} sketches enteros, {len(AN)} animados hechos con Claude, {len(GIA)} ganchos) y es lo que más le rinde; Víctor en 0 de 35 (lo exagerado lo hacen actores y su lujo real); Hormozi, probable sólo en 1 de 48 (unas viñetas de cómic).",
 f"El ritmo: Ramiro casi no corta ({dec(cortes('ramiro'), 2)} cortes por minuto), Víctor corta {dec(cortes('victor'))} por minuto y Hormozi tiene dos mundos ({dec(cortes('hormozi', HB))} en el estudio, {dec(cortes('hormozi', TA))} en el taller).",
 f"El sonido: Ramiro y Víctor llevan un fondo constante debajo de la voz ({rf['constante']} de 50 y {vf['constante']} de 35); Hormozi deja silencio entre frases en {hf['sin']} de 48.",
 f"El CTA: Ramiro lo pone en {rcta[0]} de 50 (faltan sólo los {len(RC)} recortes de llamada y {50 - rcta[0] - len(RC)} más); Hormozi en {hcta[0]} de 48, casi todo desde su lanzamiento del 04/11; Víctor sólo en {vcta[0]} de 35, cuando vende su método de seguidores.",
 f"El tema y la prueba: Ramiro y Hormozi enseñan oficio con cifras del negocio (anuncios, CRM, cerrar, equipo); Víctor vende aspiración (mentalidad, lujo, dinero) con su Ferrari y su jet como prueba. Duran distinto: {dec(med([x['duracion_s'] for x in R['ramiro']]), 0)}, {dec(med([x['duracion_s'] for x in R['victor']]), 0)} y {dec(med([x['duracion_s'] for x in R['hormozi']]), 0)} s de mediana.",
]
CONTRA = (
 f"El molde pedido (un gancho exagerado de 10 a 15 s con el avatar o animado y después la persona en serio) casi no aparece: "
 f"sólo Ramiro lo usa, en {len(GIA)} de 50 reels, con ganchos de {dec(min(x['gancho_fin_s'] for x in GIA), 0)} a {dec(max(x['gancho_fin_s'] for x in GIA), 0)} s, "
 f"Ramiro filmado desde el segundo 0 y la IA como un elemento encima (no un avatar); {len(GIA) - len(gia_m)} de los {len(GIA)} tienen menos de 48 h "
 f"y el único maduro dio {por(vec_grupo('ramiro', GIA))} contra sus vecinos de fecha. Víctor (0 de 35) y Hormozi (0 de 48) no usan avatar. "
 f"Lo que sí está probado se le parece: el gancho exagerado hecho con actores (el falso noticiero de Víctor, {dec(v31['gancho_fin_s'], 0)} s, y después Víctor explica y pide «comenta CLASE»: "
 f"{por(v31['reproducciones'] / MED['victor'], 1)} sobre su mediana y {por(VEC['victor'][v31['id']], 1)} contra sus vecinos de fecha) "
 f"y el sketch ENTERO con el avatar ({por(m_forma('ramiro', 'sketch entero con IA'))} a igual fecha en {len(SK)} reels), que gasta IA en toda su duración "
 f"(unos US${dec(COSTO * med([x['duracion_s'] for x in SK]), 2)} por {dec(med([x['duracion_s'] for x in SK]), 0)} s, contra US${dec(COSTO * 10, 2)} a {dec(COSTO * 15, 2)} de un gancho de 10 a 15 s). "
 f"Hacerlo como se pidió es una apuesta nueva, no una copia: hay que medirla contra la mediana propia."
)

DATOS = {'referentes': [ref('ramiro', 'Ramiro Cubría', '@ramiro.cubria', '531 mil'),
                        ref('victor', 'Víctor Heras', '@victorherasemprendedor', '494 mil'),
                        ref('hormozi', 'Alex Hormozi', '@hormozi', '5,2 millones')],
         'receta_comun': RECETA_COMUN, 'diferencias': DIFERENCIAS, 'contra_el_pedido': CONTRA}

# --- reglas -------------------------------------------------------------------
def palabras(s): return len(s.replace('·', ' ').split())
for r in DATOS['referentes']:
    for t in r['temas']:
        for e in t['ejemplos']: assert palabras(e['gancho_cita']) <= 15, e
    for g in r['ganchos']: assert palabras(g['cita']) <= 15, g
    for b in r['mejores']: assert palabras(b['gancho_cita']) <= 15, b
    assert len(r['ganchos']) == 6 and len(r['mejores']) == 5
    for t in r['temas']: assert len(t['ejemplos']) == 2
    assert all(s['tipo'] in ('ia', 'persona', 'cta', 'otro') for s in r['estructura'])
assert 4 <= len(RECETA_COMUN) <= 6 and 3 <= len(DIFERENCIAS) <= 5
texto = json.dumps(DATOS, ensure_ascii=False)
for mal in ('bienvenido/a', 'listo/a', 'estate atento'):
    assert mal not in texto

if len(sys.argv) > 2 and sys.argv[1] == '--check':
    escrito = json.load(open(sys.argv[2], encoding='utf-8'))
    print('IGUAL' if escrito == DATOS else 'DISTINTO')
    if escrito != DATOS:
        a, b = json.dumps(escrito, ensure_ascii=False, indent=1).splitlines(), json.dumps(DATOS, ensure_ascii=False, indent=1).splitlines()
        import difflib
        for l in list(difflib.unified_diff(a, b, lineterm=''))[:60]: print(l)
    print('Spearman Ramiro edad-repro (maduros):', round(SPEAR_R, 2))
else:
    print(json.dumps(DATOS, ensure_ascii=False, indent=1))
