// ============================================================================
//  /api/clasificar  —  2 pasos optimizados + Prompt Caching en bulk
// ----------------------------------------------------------------------------
//  FLUJO:
//  Paso 1: IA recibe 333 familias [CACHEADO en bulk] → devuelve TOP 2 familias
//  Paso 2: IA recibe productos de esas familias → código exacto
//
//  Cliente envía:
//    Paso 1: { denominacion, bulk? }
//    Paso 2: { denominacion, familyProducts, bulk? }
// ============================================================================

const { getSessionUser } = require('./_auth');

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const MODEL_FAST     = process.env.ANTHROPIC_MODEL_FAST    || 'claude-haiku-4-5-20251001';
const MODEL_PRECISE  = process.env.ANTHROPIC_MODEL_PRECISE || 'claude-sonnet-4-6';

// 333 familias UNSPSC — bloque fijo y cacheable (~4,500 tokens > mínimo 1,024)
const ALL_FAMILIES_TEXT = `FAM 1013: Recipientes y habitat para animales
FAM 1014: Productos de talabarteria y arreo
FAM 1017: Fertilizantes y nutrientes para plantas y herbicidas
FAM 1019: Productos para el control de plagas
FAM 1110: Minerales, minerales metalicos y metales
FAM 1111: Tierra y piedra
FAM 1112: Productos no comestibles de planta y silvicultura
FAM 1114: Chatarra y materiales de desecho
FAM 1115: Fibra, hilos e hilados
FAM 1116: Tejidos y materiales de cuero
FAM 1117: Aleaciones
FAM 1118: oxido metalico
FAM 1119: Desechos metalicos y chatarra
FAM 1213: Materiales explosivos
FAM 1214: Elementos y gases
FAM 1216: Aditivos
FAM 1217: Colorantes
FAM 1218: Ceras y aceites
FAM 1219: Solventes
FAM 1235: Compuestos y mezclas
FAM 1310: Caucho y elastomeros
FAM 1311: Resinas y colofonias y otros materiales derivados de resina
FAM 1410: Materiales de papel
FAM 1411: Productos de papel
FAM 1412: Papel para uso industrial
FAM 1510: Combustibles
FAM 1511: Combustibles gaseosos y aditivos
FAM 1512: Lubricantes, aceites, grasas y anticorrosivos
FAM 1513: Combustible para reactores nucleares
FAM 2010: Maquinaria y equipo de mineria y explotacion de canteras
FAM 2011: Equipo de perforacion y explotacion de pozos
FAM 2012: Equipo para perforacion y exploracion de petroleo y gas
FAM 2013: Materiales para  perforacion y operaciones de petroleo y gas
FAM 2014: Equipo de produccion y operacion de petroleo y gas
FAM 2110: Maquinaria y equipo para agricultura, silvicultura y paisajismo
FAM 2111: Equipo de pesca y acuicultura
FAM 2210: Maquinaria y equipo pesado de construccion
FAM 2310: Maquinaria para el procesamiento de materias primas
FAM 2311: Maquinaria para el procesamiento de petroleo
FAM 2312: Maquinaria y accesorios de textiles y tejidos
FAM 2313: Maquinaria y equipos lapidarios
FAM 2314: Maquinaria de reparacion y accesorios para marroquineria
FAM 2315: Maquinaria, equipo y suministros de procesos industriales
FAM 2316: Maquinas, equipo y suministros para fundicion
FAM 2318: Equipo industrial para alimentos y bebidas
FAM 2319: Mezcladores y sus partes y accesorios
FAM 2320: Equipamiento para transferencia de masa
FAM 2321: Maquinaria de fabricacion electronica, equipo y accesorios
FAM 2322: Equipo y maquinaria de procesamiento de pollos
FAM 2323: Equipo y maquinaria de procesamiento de madera y aserrado
FAM 2324: Maquinaria y accesorios para cortar metales
FAM 2325: Maquinaria y accesorios para el formado de metales
FAM 2326: Maquinaria y accesorios para hacer prototipos rapidos
FAM 2327: Maquinaria y accesorios y suministros para soldadura de todas las clases
FAM 2328: Maquinaria para el tratamiento de metal
FAM 2329: Herramientas de maquinado industrial
FAM 2330: Maquinaria y equipo para cable
FAM 2410: Maquinaria y equipo para manejo de materiales
FAM 2411: Recipientes y almacenamiento
FAM 2412: Materiales de empaque
FAM 2413: Refrigeracion industrial
FAM 2414: Suministros de embalaje
FAM 2510: Vehiculos de motor
FAM 2512: Maquinaria y equipo para ferrocarril y tranvias
FAM 2516: Bicicletas no motorizadas
FAM 2517: Componentes y sistemas de transporte
FAM 2518: Carrocerias y remolques
FAM 2519: Equipo para servicios de transporte
FAM 2610: Fuentes de energia
FAM 2611: Baterias y generadores y transmision de energia cinetica
FAM 2612: Alambres, cables y arneses
FAM 2613: Generacion de energia
FAM 2614: Maquinaria y equipo para energia atomica o nuclear
FAM 2711: Herramientas de mano
FAM 2712: Maquinaria y equipo hidraulico
FAM 2713: Maquinaria y equipo neumatico
FAM 2714: Herramientas especializadas automotrices
FAM 3010: Componentes estructurales y formas basicas
FAM 3011: Hormigon, cemento y yeso
FAM 3012: Carreteras y paisaje
FAM 3013: Productos de construccion estructurales
FAM 3014: Aislamiento
FAM 3015: Materiales para acabado de exteriores
FAM 3016: Materiales de acabado de interiores
FAM 3017: Puertas y ventanas y vidrio
FAM 3018: Instalaciones de plomeria
FAM 3019: Equipo de apoyo para Construccion y Mantenimiento
FAM 3024: Componentes de construccion de estructura portatil
FAM 3025: Estructuras y materiales de mineria subterranea
FAM 3026: Materiales estructurales
FAM 3110: Piezas de fundicion y ensambles de piezas de fundicion
FAM 3111: Extrusiones
FAM 3112: Piezas fundidas maquinadas
FAM 3113: Forjaduras
FAM 3114: Molduras
FAM 3115: Cuerda, cadena, cable, alambre y correa
FAM 3116: Ferreteria
FAM 3117: Rodamientos, cojinetes ruedas y engranajes
FAM 3118: Empaques, glandulas, fundas y cubiertas
FAM 3119: Materiales de afilado pulido y alisado
FAM 3120: Adhesivos y selladores
FAM 3121: Pinturas y bases y acabados
FAM 3122: Extractos de teñir y de curtir
FAM 3123: Materia prima en placas o barras labradas
FAM 3124: optica industrial
FAM 3125: Sistemas de control neumatico, hidraulico o electrico
FAM 3126: Cubiertas, cajas y envolturas
FAM 3127: Piezas hechas a maquina
FAM 3128: Componentes de placa y estampados
FAM 3129: Extrusiones maquinadas
FAM 3130: Forjas labradas
FAM 3131: Ensambles de tuberia fabricada
FAM 3132: Ensambles fabricados de material en barras
FAM 3133: Ensambles estructurales fabricados
FAM 3134: Ensambles de lamina fabricado
FAM 3135: Ensambles de tuberia fabricada
FAM 3136: Ensambles de placa fabricados
FAM 3137: Refractarios
FAM 3139: Maquinados
FAM 3140: Empaques
FAM 3141: Sellos
FAM 3142: Partes sinterizadas
FAM 3210: Circuitos impresos, circuitos integrados y micro ensamblajes
FAM 3211: Dispositivo semiconductor discreto
FAM 3212: Componentes pasivos discretos
FAM 3213: Piezas de componentes y hardware electronicos y accesorios
FAM 3214: Dispositivos de tubo electronico y accesorios
FAM 3215: Dispositivos y componentes y accesorios de control de automatizacion
FAM 3910: Lamparas y bombillas y componentes para lamparas
FAM 3911: Iluminacion, artefactos y accesorios
FAM 3912: Equipos, suministros y componentes electricos
FAM 3913: Dispositivos y accesorios y suministros de manejo de cable electrico
FAM 4010: Calefaccion, ventilacion y circulacion del aire
FAM 4014: Distribucion de fluidos y gas
FAM 4015: Bombas y compresores industriales
FAM 4016: Filtrado y purificacion industrial
FAM 4017: Instalaciones de tubos y entubamientos
FAM 4018: Instalaciones de tubos y tuberias
FAM 4110: Equipo de laboratorio y cientifico
FAM 4111: Instrumentos de medida, observacion y ensayo
FAM 4112: Suministros y accesorios de laboratorio
FAM 4213: Telas y vestidos medicos
FAM 4214: Suministros, productos de tratamiento y cuidado del enfermo
FAM 4217: Productos para los servicios medicos de urgencias y campo
FAM 4219: Productos de centro medico
FAM 4227: Productos de resucitacion, anestesia y respiratorio
FAM 4228: Productos para la esterilizacion medica
FAM 4230: Suministros para formacion y estudios de medicina
FAM 4231: Productos para el cuidado de heridas
FAM 4319: Dispositivos de comunicaciones y accesorios
FAM 4320: Componentes para tecnologia de la informacion, difusion o telecomunicaciones
FAM 4321: Equipo informatico y accesorios
FAM 4322: Equipos o plataformas y accesorios de redes multimedia o de voz y datos
FAM 4323: Software
FAM 4410: Maquinaria, suministros y accesorios de oficina
FAM 4411: Accesorios de oficina y escritorio
FAM 4412: Suministros de oficina
FAM 4510: Equipo de imprenta y publicacion
FAM 4511: Equipos de audio y video para presentacion y composicion
FAM 4512: Equipo de video, filmacion o fotografia
FAM 4513: Medios fotograficos y de grabacion
FAM 4514: Suministros fotograficos para cine
FAM 4610: Armas ligeras y municion
FAM 4611: Armas de guerra convencionales
FAM 4612: Misiles
FAM 4613: Cohetes y subsistemas
FAM 4614: Lanzadores
FAM 4615: Proteccion del Orden Publico
FAM 4616: Seguridad y control publico
FAM 4617: Seguridad, vigilancia y deteccion
FAM 4618: Seguridad y proteccion personal
FAM 4619: Proteccion contra incendios
FAM 4620: Equipo de entrenamiento de seguridad fisica e industrial, defensa y orden publico
FAM 4710: Tratamiento, suministros y eliminacion de agua y aguas residuales
FAM 4711: Equipo industrial de lavanderia y lavado en seco
FAM 4712: Equipo de aseo
FAM 4713: Suministros de aseo y limpieza
FAM 4810: Equipos de servicios de alimentacion para instituciones
FAM 4811: Maquinas expendedoras
FAM 4812: Equipo de Juego o de Apostar
FAM 4813: Equipo y materiales funerarios
FAM 4910: Coleccionables y condecoraciones
FAM 4912: Equipos y accesorios para acampada y exteriores
FAM 4916: Equipos deportivos para campos y canchas
FAM 4917: Equipos de gimnasia y boxeo
FAM 4918: Juegos, equipo de tiro y mesa
FAM 4920: Equipo para entrenamiento fisico
FAM 4922: Equipo  y accesorios para deportes
FAM 4924: Equipo de recreo, parques infantiles y equipo y suministros de natacion y de spa
FAM 5013: Productos lacteos y huevos
FAM 5015: Aceites y grasas comestibles
FAM 5016: Chocolates, azucares, edulcorantes y productos de confiteria
FAM 5019: Alimentos preparados y conservados
FAM 5020: Bebidas
FAM 5210: Revestimientos de suelos
FAM 5212: Ropa de cama, mantelerias, paños de cocina y toallas
FAM 5213: Tratamientos de ventanas
FAM 5214: Aparatos electrodomesticos
FAM 5215: Utensilios de cocina domesticos
FAM 5216: Electronica de consumo
FAM 5217: Tratamientos de pared domestica
FAM 5310: Ropa
FAM 5311: Calzado
FAM 5312: Maletas, bolsos de mano, mochilas y estuches
FAM 5313: Articulos de tocador y cuidado personal
FAM 5314: Fuentes y accesorios de costura
FAM 5411: Relojes
FAM 5412: Gemas
FAM 5510: Medios impresos
FAM 5511: Material electronico de referencia
FAM 5512: Etiquetado y accesorios
FAM 5610: Muebles de alojamiento
FAM 5611: Muebles comerciales e industriales
FAM 5612: Mobiliario institucional, escolar y educativo y accesorios
FAM 5613: Muebles y accesorios para merchandising
FAM 5614: Adornos para el hogar
FAM 6010: Materiales didacticos profesionales y de desarrollo y accesorios y suministros
FAM 6011: Decoraciones y suministros del aula
FAM 6012: Equipo, accesorios y suministros de arte y manualidades
FAM 6013: Instrumentos musicales, piezas y accesorios
FAM 6014: Juguetes y juegos
FAM 7010: Pesquerias y acuicultura
FAM 7011: Horticultura
FAM 7012: Servicios de animales vivos
FAM 7013: Preparacion, gestion y proteccion del terreno y del suelo
FAM 7014: Produccion, gestion y proteccion de cultivos
FAM 7015: Silvicultura
FAM 7016: Fauna y flora silvestres
FAM 7017: Desarrollo y vigilancia de recursos hidraulicos
FAM 7110: Servicios de mineria
FAM 7111: Servicios de perforacion y prospeccion petrolifera y de gas
FAM 7112: Servicios de construccion y perforacion de pozos
FAM 7113: Servicios de aumento de la extraccion y produccion de gas y petroleo
FAM 7114: Servicios de restauracion y recuperacion de gas y petroleo
FAM 7115: Servicios de procesamiento y gestion de datos de petroleo y gas
FAM 7116: Servicios de gerencia de proyectos en pozos de petroleo y gas
FAM 7210: Servicios de mantenimiento y reparaciones de construcciones e instalaciones
FAM 7211: Servicios de construccion de edificaciones residenciales
FAM 7212: Servicios de construccion de edificaciones no residenciales
FAM 7214: Servicios de construccion pesada
FAM 7215: Servicios de mantenimiento y construccion de comercio especializado
FAM 7310: Industrias de plasticos y productos quimicos
FAM 7311: Industrias de la madera y el papel
FAM 7312: Industrias del metal y de minerales
FAM 7313: Industrias de alimentos y bebidas
FAM 7314: Industrias de fibras, textiles y de tejidos
FAM 7315: Servicios de apoyo a la fabricacion
FAM 7316: Fabricacion de maquinaria y equipo de transporte
FAM 7317: Fabricacion de productos electricos e instrumentos de precision
FAM 7318: Servicios de maquinado y procesado
FAM 7610: Servicios de descontaminacion
FAM 7611: Servicios de aseo y limpieza
FAM 7612: Eliminacion y tratamiento de desechos
FAM 7613: Limpieza de residuos toxicos y peligrosos
FAM 7710: Gestion medioambiental
FAM 7711: Proteccion medioambiental
FAM 7712: Seguimiento, control y rehabilitacion de la contaminacion
FAM 7713: Servicios de seguimiento, control o rehabilitacion de contaminantes
FAM 7810: Transporte de correo y carga
FAM 7811: Transporte de pasajeros
FAM 7812: Manejo y embalaje de material
FAM 7813: Almacenaje
FAM 7814: Servicios de transporte
FAM 7818: Servicios de mantenimiento o reparaciones de transportes
FAM 8010: Servicios de asesoria de gestion
FAM 8011: Servicios de recursos humanos
FAM 8012: Servicios legales
FAM 8013: Servicios inmobiliarios
FAM 8014: Comercializacion y distribucion
FAM 8015: Politica comercial y servicios
FAM 8016: Servicios de administracion de empresas
FAM 8110: Servicios profesionales de ingenieria
FAM 8111: Servicios informaticos
FAM 8112: Economia
FAM 8113: Estadistica
FAM 8114: Tecnologias de fabricacion
FAM 8115: Servicios de pedologia
FAM 8116: Entrega de servicios de tecnologia de informacion
FAM 8210: Publicidad
FAM 8211: Escritura y traducciones
FAM 8212: Servicios de reproduccion
FAM 8213: Servicios fotograficos
FAM 8214: Diseño grafico
FAM 8215: Artistas e interpretes profesionales
FAM 8310: Servicios publicos
FAM 8311: Servicios de medios de telecomunicaciones
FAM 8312: Servicios de informacion
FAM 8410: Finanzas de desarrollo
FAM 8411: Servicios de contabilidad y auditorias
FAM 8412: Banca e inversiones
FAM 8413: Servicios de seguros y pensiones
FAM 8414: Agencias de credito
FAM 8510: Servicios integrales de salud
FAM 8511: Prevencion y control de enfermedades
FAM 8512: Practica medica
FAM 8513: Ciencia medica, investigacion y experimentacion
FAM 8514: Medicina alternativa y holistica
FAM 8515: Servicios alimenticios y de nutricion
FAM 8516: Servicios de mantenimiento, renovacion y reparacion de equipo medico quirurgico
FAM 8517: Servicios de muerte y soporte al fallecimiento
FAM 8610: Formacion profesional
FAM 8611: Sistemas educativos alternativos
FAM 8612: Instituciones educativas
FAM 8613: Servicios educativos especializados
FAM 8614: Instalaciones educativas
FAM 9010: Restaurantes y catering (servicios de comidas y bebidas)
FAM 9011: Instalaciones hoteleras, alojamientos y centros de encuentros
FAM 9012: Facilitacion de viajes
FAM 9013: Artes interpretativas
FAM 9014: Deportes comerciales
FAM 9015: Servicios de entretenimiento
FAM 9110: Aspecto personal
FAM 9111: Asistencia domestica y personal
FAM 9210: Orden publico y seguridad
FAM 9211: Servicios militares o defensa nacional
FAM 9212: Seguridad y proteccion personal
FAM 9310: Sistemas e instituciones politicas
FAM 9311: Condiciones sociopoliticas
FAM 9312: Relaciones internacionales
FAM 9313: Ayuda y asistencia humanitaria
FAM 9314: Servicios comunitarios y sociales
FAM 9315: Servicios de administracion y financiacion publica
FAM 9316: Tributacion
FAM 9317: Politica y regulacion comercial
FAM 9410: Organizaciones laborales
FAM 9411: Organizaciones religiosas
FAM 9412: Clubes
FAM 9413: Organizaciones, asociaciones y movimientos civicos
FAM 9510: Parcelas de tierra
FAM 9511: Vias
FAM 9512: Estructuras y edificios permanentes
FAM 9513: Estructuras y edificios moviles
FAM 9514: Estructuras y edificios prefabricados`;

// ── Llamada a Anthropic ────────────────────────────────────────────────────
async function callAnthropic({ systemText, userText, maxTokens = 400, model = MODEL_FAST, bulk = false }) {
  const block = { type: 'text', text: systemText };
  if (bulk) block.cache_control = { type: 'ephemeral' };

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01'
  };
  if (bulk) headers['anthropic-beta'] = 'prompt-caching-2024-07-31';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [block],
      messages: [{ role: 'user', content: userText }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    text: (data.content || []).filter(b => b.type === 'text').map(b => b.text).join(''),
    usage: data.usage || {}
  };
}

// ── Parsear JSON limpiando markdown ────────────────────────────────────────
function parseJSON(text) {
  const clean = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se encontró JSON válido en la respuesta de la IA.');
  return JSON.parse(match[0]);
}

// ── PASO 1: IA elige las 2 familias más probables (de 333) ─────────────────
async function getTopFamilies(denominacion, bulk = false) {
  const data = await callAnthropic({
    bulk,
    systemText: `Experto UNSPSC. Elige las 2 familias más probables para el material.
Clasifica por función principal. Ignora marcas, números de parte y especificaciones.
Equivalencias: RODAMIENTO→3117, VALVULA→4014, MOTOR ELECTRICO→2610, SENSOR/TRANSMISOR→4111, RELE/CONTACTOR/TEMPORIZADOR→3916, BREAKER/DISYUNTOR→3915, CABLE/CONDUCTOR→2612, MANGUERA/FLEXIBLE→4017, FILTRO→4016, BOMBA/BOMBA COMBUSTIBLE/BOMBA HIDRAULICA/COMPRESOR→4015, FUENTE ALIMENTACION→3912, LAPTOP/NOTEBOOK→4321, HERRAMIENTA→2711, EPP/CASCO/ARNES→4618, LUBRICANTE/GRASA→1512, SOLDADURA/ELECTRODO→2327, EMPAQUE/SELLO/JUNTA/ORING→3118, PLACA/TARJETA/PCB→3210, FUSIBLE→3912, SOLENOIDE→3125.
JSON: {"families":["XXXX","YYYY"]}

${ALL_FAMILIES_TEXT}`,
    userText: `Material: ${denominacion}`,
    model: MODEL_FAST
  });

  const parsed = parseJSON(data.text);
  return { families: parsed.families || [], usage: data.usage };
}

// ── PASO 2: IA elige el código exacto entre los productos ──────────────────
async function getExactCode(denominacion, familyProducts, bulk = false) {
  const productList = Object.entries(familyProducts)
    .map(([, products]) => products.map(([code, name]) => `${code}: ${name}`).join('\n'))
    .join('\n');

  const data = await callAnthropic({
    bulk: false,  // Paso 2 nunca cachea — productos distintos por material
    systemText: `Experto UNSPSC. Elige el código más preciso para el material. Clasifica por función principal, ignora marcas y especificaciones. Si no hay exacto, usa el más cercano con confianza BAJA.
JSON: {"codigo":"XXXXXXXX","nombre":"Nombre UNSPSC","confianza":"ALTA|MEDIA|BAJA","razon":"máx 10 palabras","alternativas":[{"codigo":"XXXXXXXX","nombre":"Nombre","confianza":"MEDIA"}]}

${productList}`,
    userText: `Material: ${denominacion}`,
    maxTokens: 400,
    model: MODEL_PRECISE
  });

  return { result: parseJSON(data.text), usage: data.usage };
}

// ── HANDLER PRINCIPAL ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const username = getSessionUser(req);
  if (!username) return res.status(401).json({ error: 'Sesión no autenticada o expirada.' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  const { denominacion, familyProducts } = body || {};
  if (!denominacion) return res.status(400).json({ error: 'Falta el campo denominacion.' });

  const bulk = body.bulk === true;

  try {
    if (!familyProducts) {
      // PASO 1: elegir 2 familias de 333
      const r = await getTopFamilies(denominacion, bulk);
      return res.status(200).json({ step: 'families', families: r.families, usage: r.usage });
    } else {
      // PASO 2: elegir código exacto
      const r = await getExactCode(denominacion, familyProducts, bulk);
      return res.status(200).json({ step: 'result', result: r.result, usage: r.usage });
    }
  } catch (e) {
    console.error('[CLASIFICAR]', e.message);
    return res.status(500).json({ error: e.message || 'Error interno del servidor.' });
  }
};
