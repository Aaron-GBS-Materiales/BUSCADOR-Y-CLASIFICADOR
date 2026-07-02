// ============================================================================
//  /api/clasificar  —  Motor de clasificación UNSPSC con IA pura (2 pasos)
// ----------------------------------------------------------------------------
//  FLUJO:
//  1. El cliente envía: { denominacion, familyProducts: { "4321": [[cod,nom],...], ... } }
//     donde familyProducts contiene los productos de las 3 familias más probables
//     (determinadas por la primera llamada IA, realizada también aquí).
//
//  Si el cliente NO envía familyProducts (primera llamada), el servidor:
//    - Llama a la IA con la jerarquía completa para obtener las TOP 3 familias
//    - Devuelve { step: 'families', families: ['4321','4319','4323'] }
//
//  Si el cliente envía familyProducts, el servidor:
//    - Llama a la IA con los productos de esas familias para obtener el código exacto
//    - Devuelve el resultado final con código, confianza y alternativas
// ============================================================================

const { getSessionUser } = require('./_auth');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Jerarquía UNSPSC embebida (segmentos y familias, ~20KB)
const HIERARCHY_TEXT = `SEG 10: Material Vivo Vegetal y Animal, Accesorios y Suministros
  FAM 1013: Recipientes y habitat para animales
  FAM 1014: Productos de talabarteria y arreo
  FAM 1017: Fertilizantes y nutrientes para plantas y herbicidas
  FAM 1019: Productos para el control de plagas
SEG 11: Material Mineral, Textil y  Vegetal y Animal No Comestible
  FAM 1110: Minerales, minerales metalicos y metales
  FAM 1111: Tierra y piedra
  FAM 1112: Productos no comestibles de planta y silvicultura
  FAM 1114: Chatarra y materiales de desecho
  FAM 1115: Fibra, hilos e hilados
  FAM 1116: Tejidos y materiales de cuero
  FAM 1117: Aleaciones
  FAM 1118: oxido metalico
  FAM 1119: Desechos metalicos y chatarra
SEG 12: Material Quimico incluyendo Bioquimicos y Materiales de Gas
  FAM 1213: Materiales explosivos
  FAM 1214: Elementos y gases
  FAM 1216: Aditivos
  FAM 1217: Colorantes
  FAM 1218: Ceras y aceites
  FAM 1219: Solventes
  FAM 1235: Compuestos y mezclas
SEG 13: Materiales de Resina, Colofonia, Caucho, Espuma, Pelicula y Elastomericos
  FAM 1310: Caucho y elastomeros
  FAM 1311: Resinas y colofonias y otros materiales derivados de resina
SEG 14: Materiales y Productos de Papel
  FAM 1410: Materiales de papel
  FAM 1411: Productos de papel
  FAM 1412: Papel para uso industrial
SEG 15: Combustibles y Combustibles Nucleares y Fluidos
  FAM 1510: Combustibles de petroleo y carbon y gas natural
  FAM 1511: Combustibles gaseosos y aditivos
  FAM 1512: Lubricantes y aceites y grasas y fluidos anticorrosion
  FAM 1513: Combustibles nucleares y materiales
SEG 20: Maquinaria para Mineria, Pozos Petroleros y Construccion
  FAM 2010: Maquinaria y equipo minero
  FAM 2011: Maquinaria para perforacion de pozos
  FAM 2012: Servicios de pozos y materiales
  FAM 2013: Fluidos de pozos y materiales
  FAM 2014: Equipo de produccion de campo petrolero
SEG 21: Maquinaria y Accesorios para Agricultura y Silvicultura y Jardineria
  FAM 2110: Equipo agricola
  FAM 2111: Equipos de pesca comercial y acuicultura
SEG 22: Maquinaria para Construccion
  FAM 2210: Maquinaria para movimiento de tierra
SEG 23: Maquinaria Industrial, Manufactura y Proceso
  FAM 2310: Maquinaria de fabricacion y proceso
  FAM 2311: Maquinaria de refineria de petroleo
  FAM 2312: Maquinaria para industria textil
  FAM 2313: Materiales y suministros abrasivos
  FAM 2314: Maquinaria de cuero
  FAM 2315: Maquinaria de plastico y caucho
  FAM 2316: Maquinaria de fabricacion
  FAM 2317: Maquinaria de manufactura de vidrio o ceramica
  FAM 2318: Maquinaria para procesamiento de alimentos y bebidas
  FAM 2319: Maquinaria para mezclado
  FAM 2320: Equipo de separacion y columnas
  FAM 2321: Maquinaria semiconductora y de circuito impreso
  FAM 2322: Maquinaria para procesamiento de carne y aves
  FAM 2323: Herramientas de corte para maquinas
  FAM 2324: Maquinas herramienta de metal
  FAM 2325: Maquinas herramienta de metal para conformado
  FAM 2326: Fabricacion y manufactura aditiva
  FAM 2327: Maquinaria de soldadura
  FAM 2328: Maquinaria de tratamiento superficial
  FAM 2329: Herramientas de corte para maquinas
  FAM 2330: Equipo de corte de cable y alambre
SEG 24: Maquinaria, Accesorios y Suministros para Manejo, Acondicionamiento y Almacenamiento de Materiales
  FAM 2410: Maquinaria y equipo para manejo de materiales
  FAM 2411: Contenedores y almacenamiento
  FAM 2412: Empaques industriales
  FAM 2413: Empaques de consumo
  FAM 2414: Materiales de empaque
SEG 25: Vehiculos Comerciales, Militares y Particulares, Accesorios y Componentes
  FAM 2510: Automoviles y Camiones y Autobuses y Motocicletas y sus Accesorios y Componentes
  FAM 2512: Vehiculos ferroviarios y tranvias y sus accesorios y componentes
  FAM 2516: Bicicletas y sus accesorios y componentes
  FAM 2517: Componentes y sistemas de transporte
  FAM 2518: Chasis y estructuras del cuerpo de vehiculo
  FAM 2519: Equipo para servicios de transporte
SEG 26: Maquinaria y Accesorios para Generacion y Distribucion de Energia
  FAM 2610: Motores electricos y generadores y accesorios
  FAM 2611: Transmision y distribucion de energia
  FAM 2612: Alambres, cables y arneses
  FAM 2613: Equipos y plantas de generacion de energia
  FAM 2614: Equipos nucleares
SEG 27: Herramientas y Maquinaria General
  FAM 2711: Herramientas de mano
  FAM 2712: Equipos de construccion y accesorios
  FAM 2713: Equipo hidraulico y neumático
SEG 30: Componentes y Suministros para Estructuras, Edificacion, Construccion y Obras Civiles
  FAM 3010: Componentes estructurales
  FAM 3011: Materiales de construccion
  FAM 3012: Materiales viales
  FAM 3013: Materiales para albañileria
  FAM 3014: Aislaciones y barreras
  FAM 3015: Materiales de techado, revestimiento y fachada
  FAM 3016: Componentes y accesorios interiores
  FAM 3017: Puertas, ventanas y vidrios
  FAM 3018: Plomeria
  FAM 3019: Andamios
  FAM 3024: Componentes de construccion de estructura portatil
  FAM 3025: Anclaje y sujecion
  FAM 3026: Material metalico
SEG 31: Fabricacion de Piezas y Partes de Repuesto
  FAM 3110: Fundicion
  FAM 3111: Extrusion
  FAM 3112: Maquinado
  FAM 3113: Forja
  FAM 3114: Moldeo de plastico
  FAM 3115: Productos de torcido y cable y cadena y sujetadores
  FAM 3116: Sujetadores
SEG 32: Componentes y Suministros Electronicos
  FAM 3210: Circuitos impresos, circuitos integrados y micro ensamblajes
  FAM 3211: Componentes discretos
  FAM 3212: Componentes de displays
  FAM 3213: Componentes de energia
  FAM 3214: Componentes de sensores
  FAM 3215: Dispositivos y componentes y accesorios de control de automatizacion
SEG 39: Componentes, Accesorios y Suministros de Sistemas Electricos e Iluminacion
  FAM 3911: Iluminacion, artefactos y accesorios
  FAM 3912: Componentes electricos
  FAM 3913: Dispositivos de distribucion de energia
  FAM 3914: Motores y generadores
  FAM 3915: Dispositivos electricos de proteccion
  FAM 3916: Electricos de control
  FAM 3917: Equipo de electricidad
SEG 40: Distribucion y Acondicionamiento de Fluidos y Gas
  FAM 4010: Tubos y tuberias
  FAM 4011: Accesorios de tuberia
  FAM 4012: Bombas y compresores
  FAM 4013: Acondicionamiento de fluidos
  FAM 4014: Valvulas
SEG 41: Equipos y Suministros de Laboratorio, de Medicion, de Observacion y de Pruebas
  FAM 4110: Equipo de laboratorio y cientifico
  FAM 4111: Instrumentos de medida, observacion y ensayo
  FAM 4112: Equipo educativo y artesanal
  FAM 4113: Equipo de prueba e inspeccion industrial
  FAM 4114: Equipo de pruebas de proyectiles y misiles
SEG 42: Equipo Medico, Accesorios y Suministros
  FAM 4210: Equipo diagnostico
  FAM 4211: Equipo terapeutico
  FAM 4212: Suministros medicos
  FAM 4213: Instrumentos medicos
  FAM 4214: Productos y ropa medicos
  FAM 4215: Suministros de laboratorio medico
  FAM 4216: Suministros dentales
  FAM 4217: Productos para los servicios medicos de urgencias y campo
  FAM 4218: Suministros medicos de esterilizacion
  FAM 4219: Equipo de control ambiental
  FAM 4220: Productos de ortopedia y protesis
  FAM 4221: Ayudas para discapacitados
  FAM 4222: Cuidado de pacientes
  FAM 4224: Farmacia
  FAM 4227: Productos de resucitacion, anestesia y respiratorio
  FAM 4228: Productos de rehabilitacion
SEG 43: Difusion de Tecnologias de Informacion y Telecomunicaciones
  FAM 4319: Dispositivos de comunicaciones y accesorios
  FAM 4320: Componentes para tecnologia de la informacion, difusion o telecomunicaciones
  FAM 4321: Equipo informatico y accesorios
  FAM 4322: Equipos o plataformas y accesorios de redes multimedia o de voz y datos
  FAM 4323: Software
SEG 44: Equipos y Suministros de Oficina
  FAM 4410: Maquinaria y equipos de oficina
  FAM 4411: Suministros de oficina
  FAM 4412: Suministros y materiales artesanales y de representacion
SEG 45: Imprenta, Publicacion y Artes Graficas
  FAM 4510: Maquinaria de impresion y publicacion
  FAM 4511: Arte grafico
SEG 46: Defensa, Orden Publico, Proteccion y Seguridad
  FAM 4610: Armas y municiones
  FAM 4611: Componentes de armas y accesorios
  FAM 4612: Equipo de defensa
  FAM 4613: Equipo de orden publico
  FAM 4614: Equipo de proteccion y control de acceso
  FAM 4615: Equipo de salvamento
  FAM 4616: Ropa de seguridad y proteccion
  FAM 4617: Equipo de extincion y control de incendios
  FAM 4618: Equipo de seguridad de emergencia
  FAM 4619: Balizas
SEG 47: Limpieza y Mantenimiento de Instalaciones
  FAM 4710: Quimicos de limpieza
  FAM 4711: Suministros de limpieza
  FAM 4712: Equipos de limpieza
  FAM 4713: Equipos de jardineria y paisajismo
  FAM 4714: Suministros de control de plagas
SEG 48: Servicios de Industrias Especificas
  FAM 4810: Servicios de educacion y formacion
  FAM 4811: Servicios de salud
  FAM 4812: Servicios de finanzas y seguros
  FAM 4813: Servicios de transporte
  FAM 4814: Servicios de bienes raices
SEG 49: Deportes y Recreacion
  FAM 4910: Equipo deportivo
  FAM 4911: Juguetes y juegos
  FAM 4912: Arte y artesanias
  FAM 4913: Equipo de caza y pesca
  FAM 4914: Acampada y aventura al aire libre
SEG 50: Alimentos y Bebidas
  FAM 5010: Alimentos
  FAM 5011: Bebidas
  FAM 5012: Alimentos para animales
SEG 51: Drogas y Productos Farmaceuticos
  FAM 5110: Medicamentos
  FAM 5111: Suplementos nutricionales
  FAM 5112: Agentes de diagnostico
SEG 52: Muebles, Accesorios de Hogar y del Comercio, Electrodomesticos y Equipos Electronicos de Consumo
  FAM 5210: Muebles y accesorios
  FAM 5211: Accesorios de hogar y del comercio
  FAM 5212: Electrodomesticos
  FAM 5213: Equipos electronicos de consumo
SEG 53: Ropa, Maletas y Productos Personales
  FAM 5310: Ropa
  FAM 5311: Accesorios de ropa
  FAM 5312: Maletas y bolsas
  FAM 5313: Productos de higiene y aseo personal
  FAM 5314: Joyeria
SEG 54: Instrumentos Musicales
  FAM 5410: Instrumentos musicales
SEG 55: Publicaciones Impresas, Grabaciones y Medios de Comunicacion
  FAM 5510: Publicaciones impresas
  FAM 5511: Grabaciones y medios
SEG 56: Muebles, Accesorios de Hogar y del Comercio y Equipos Electronicos de Consumo de Segunda Mano
  FAM 5610: Muebles de segunda mano
SEG 60: Construccion y Estructuras y Obras Civiles de Segunda Mano
  FAM 6010: Estructuras prefabricadas
SEG 70: Servicios de Granjas y Jardines y Silvicultura y Vida Silvestre
  FAM 7010: Servicios agricolas
  FAM 7011: Servicios de silvicultura
  FAM 7012: Servicios de pesca y caza
  FAM 7013: Servicios de vida silvestre
SEG 71: Servicios de Mineria y Perforacion de Pozos Petroleros y Gas
  FAM 7110: Servicios de mineria
  FAM 7111: Servicios de pozos de petroleo y gas
SEG 72: Servicios de Construccion y Mantenimiento
  FAM 7210: Servicios de construccion
  FAM 7211: Servicios de mantenimiento y reparacion
  FAM 7212: Servicios de demolicion
SEG 73: Servicios de Produccion Industrial
  FAM 7310: Servicios de manufactura
  FAM 7311: Servicios de produccion
SEG 76: Servicios de Limpieza Industrial
  FAM 7610: Servicios de limpieza
SEG 77: Servicios Medioambientales
  FAM 7710: Servicios de gestion de residuos
  FAM 7711: Servicios de descontaminacion
SEG 78: Servicios de Transporte y Almacenamiento
  FAM 7810: Servicios de transporte
  FAM 7811: Servicios de almacenamiento
SEG 80: Servicios de Gestion, Asesoria Empresarial y Profesionales
  FAM 8010: Servicios de gestion empresarial
  FAM 8011: Servicios de recursos humanos
  FAM 8012: Servicios juridicos
  FAM 8013: Servicios informaticos
SEG 81: Servicios de Ingenieria, Investigacion y Tecnologia
  FAM 8110: Servicios de ingenieria
  FAM 8111: Servicios de investigacion y desarrollo
  FAM 8112: Servicios de calidad
SEG 82: Servicios Editoriales, de Diseno Grafico y de Bellas Artes
  FAM 8210: Servicios editoriales
  FAM 8211: Servicios de diseno
SEG 83: Servicios de Informacion
  FAM 8310: Servicios de informacion y difusion
SEG 84: Servicios Financieros y de Seguros
  FAM 8410: Servicios financieros
  FAM 8411: Servicios de seguros
SEG 85: Servicios de Educacion y Formacion
  FAM 8510: Servicios de educacion
  FAM 8511: Servicios de formacion
SEG 86: Servicios de Politica, Sociales, Comunitarios y Personales
  FAM 8610: Servicios sociales
  FAM 8611: Servicios comunitarios
SEG 90: Servicios de Soporte Politico y Asuntos Publicos
  FAM 9010: Servicios gubernamentales
SEG 91: Defensa y Seguridad Nacional y Orden Publico
  FAM 9110: Servicios de defensa
SEG 92: Organizaciones Benevolentes y Humanitarias
  FAM 9210: Servicios humanitarios
SEG 93: Politica y Asuntos de Comercio Exterior
  FAM 9310: Servicios de comercio
SEG 94: Organizaciones y Afiliaciones
  FAM 9410: Servicios de organizaciones`;

async function callAnthropic(messages, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Paso 1: identificar las TOP 3 familias UNSPSC
async function getTopFamilies(denominacion) {
  const system = `Eres un experto en clasificación UNSPSC. Se te dará una denominación de material o producto y debes identificar las 3 familias UNSPSC más probables de la jerarquía proporcionada.

JERARQUÍA UNSPSC (Segmentos → Familias):
${HIERARCHY_TEXT}

Responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional:
{"families":["XXXX","YYYY","ZZZZ"]}

Donde cada valor es el código de 4 dígitos de una familia UNSPSC.
Ordena las familias de más a menos probable.`;

  const data = await callAnthropic([
    { role: 'user', content: `Clasifica este material: ${denominacion}` }
  ], system);

  const raw = data.content[0].text.trim();
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Extraer el primer objeto JSON completo
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se encontró JSON válido en la respuesta de la IA.');
  const parsed = JSON.parse(match[0]);
  return parsed.families || [];
}

// Paso 2: identificar el código exacto dentro de las familias seleccionadas
async function getExactCode(denominacion, familyProducts) {
  // Construir lista de productos de las familias
  let productList = '';
  for (const [famCode, products] of Object.entries(familyProducts)) {
    productList += `\n--- Familia ${famCode} ---\n`;
    for (const [code, name] of products) {
      productList += `${code}: ${name}\n`;
    }
  }

  const system = `Eres un experto en clasificación UNSPSC. Se te dará una denominación de material y una lista de códigos de producto UNSPSC. Debes identificar el código más preciso.

LISTA DE PRODUCTOS UNSPSC:
${productList}

Responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional:
{
  "codigo": "XXXXXXXX",
  "nombre": "Nombre del producto UNSPSC",
  "confianza": "ALTA|MEDIA|BAJA",
  "razon": "Breve explicación de por qué este código es el más adecuado",
  "alternativas": [
    {"codigo": "XXXXXXXX", "nombre": "Nombre alternativo", "confianza": "MEDIA"}
  ]
}

Si ningún código corresponde con precisión, elige el más cercano y usa confianza BAJA.
Incluye máximo 2 alternativas relevantes.`;

  const data = await callAnthropic([
    { role: 'user', content: `Clasifica este material: ${denominacion}` }
  ], system);

  const raw = data.content[0].text.trim();
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Extraer el primer objeto JSON completo
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se encontró JSON válido en la respuesta de la IA.');
  return JSON.parse(match[0]);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const username = getSessionUser(req);
  if (!username) {
    res.status(401).json({ error: 'Sesión no autenticada o expirada.' });
    return;
  }

  if (!ANTHROPIC_KEY) {
    res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { denominacion, familyProducts } = body || {};

  if (!denominacion) {
    res.status(400).json({ error: 'Falta el campo denominacion.' });
    return;
  }

  try {
    if (!familyProducts) {
      // PASO 1: Identificar las top 3 familias
      const families = await getTopFamilies(denominacion);
      res.status(200).json({ step: 'families', families });
    } else {
      // PASO 2: Identificar el código exacto
      const result = await getExactCode(denominacion, familyProducts);
      res.status(200).json({ step: 'result', result });
    }
  } catch (e) {
    console.error('[CLASIFICAR]', e.message);
    res.status(500).json({ error: e.message || 'Error interno del servidor.' });
  }
};
