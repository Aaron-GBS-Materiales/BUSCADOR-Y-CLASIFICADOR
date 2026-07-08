// ============================================================================
//  /api/clasificar  —  Opción A (3 pasos) + Prompt Caching
// ----------------------------------------------------------------------------
//  FLUJO:
//  Paso 1: IA recibe 55 segmentos [CACHEADO] → devuelve TOP 2 segmentos
//  Paso 2: IA recibe familias de esos segmentos [CACHEADO por seg] → TOP 3 familias
//  Paso 3: IA recibe productos de esas familias [CACHEADO por familia] → código exacto
//
//  El cliente envía:
//    Paso 1: { denominacion }
//    Paso 2: { denominacion, segments: ["31","43"] }
//    Paso 3: { denominacion, familyProducts: { "3117": [[...]], ... } }
// ============================================================================

const { getSessionUser } = require('./_auth');

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
// Pasos 1 y 2: Haiku (tarea simple — elegir segmento/familia)
// Paso 3:      Sonnet (tarea precisa — elegir código exacto)
const MODEL_FAST     = process.env.ANTHROPIC_MODEL_FAST    || 'claude-haiku-4-5-20251001';
const MODEL_PRECISE  = process.env.ANTHROPIC_MODEL_PRECISE || 'claude-sonnet-4-6';

// 55 segmentos UNSPSC para el Paso 1
const SEGMENTS_TEXT = `SEG 10: Material Vivo Vegetal y Animal, Accesorios y Suministros
SEG 11: Material Mineral, Textil y  Vegetal y Animal No Comestible
SEG 12: Material Quimico incluyendo Bioquimicos y Materiales de Gas
SEG 13: Materiales de Resina, Colofonia, Caucho, Espuma, Pelicula y Elastomericos
SEG 14: Materiales y Productos de Papel
SEG 15: Materiales Combustibles, Aditivos para Combustibles, Lubricantes y Anticorrosivos
SEG 20: Maquinaria y Accesorios de Mineria y Perforacion de Pozos
SEG 21: Maquinaria y Accesorios para Agricultura, Pesca, Silvicultura y Fauna
SEG 22: Maquinaria y Accesorios para Construccion y Edificacion
SEG 23: Maquinaria y Accesorios para Manufactura y Procesamiento Industrial
SEG 24: Maquinaria, Accesorios y Suministros para Manejo, Acondicionamiento y Almacenamiento de Materiales
SEG 25: Vehiculos Comerciales, Militares y Particulares, Accesorios y Componentes
SEG 26: Maquinaria y Accesorios para Generacion y Distribucion de Energia
SEG 27: Herramientas y Maquinaria General
SEG 30: Componentes y Suministros para Estructuras, Edificacion, Construccion y Obras Civiles
SEG 31: Componentes y Suministros de Manufactura
SEG 32: Componentes y Suministros Electronicos
SEG 39: Componentes, Accesorios y Suministros de Sistemas Electricos e Iluminacion
SEG 40: Componentes y Equipos para Distribucion y Sistemas de Acondicionamiento
SEG 41: Equipos y Suministros de Laboratorio, de Medicion, de Observacion y de Pruebas
SEG 42: Equipo Medico, Accesorios y Suministros
SEG 43: Difusion de Tecnologias de Informacion y Telecomunicaciones
SEG 44: Equipos de Oficina, Accesorios y Suministros
SEG 45: Equipos y Suministros para Impresion, Fotografia y Audiovisuales
SEG 46: Equipos y Suministros de Defensa, Orden Publico, Proteccion, Vigilancia y Seguridad
SEG 47: Equipos de Limpieza y Suministros
SEG 48: Maquinaria, Equipo y Suministros para la Industria de Servicios
SEG 49: Equipos, Suministros y Accesorios para Deportes y Recreacion
SEG 50: Alimentos, Bebidas y Tabaco
SEG 52: Articulos Domesticos, Suministros y Productos Electronicos de Consumo
SEG 53: Ropa, Maletas y Productos de Aseo Personal
SEG 54: Productos para Relojeria, Joyeria y Piedras Preciosas
SEG 55: Publicaciones Impresas, Publicaciones Electronicas y Accesorios
SEG 56: Muebles, Mobiliario y Decoracion
SEG 60: Instrumentos Musicales, Juegos, Juguetes, Artes, Artesanias y Equipo educativo, Materiales, Accesorios y Suministros
SEG 70: Servicios de Contratacion Agricola, Pesquera, Forestal y de Fauna
SEG 71: Servicios de Mineria, Petroleo y Gas
SEG 72: Servicios de Edificacion, Construccion de Instalaciones y Mantenimiento
SEG 73: Servicios de Produccion Industrial y Manufactura
SEG 76: Servicios de Limpieza, Descontaminacion y Tratamiento de Residuos
SEG 77: Servicios Medioambientales
SEG 78: Servicios de Transporte, Almacenaje y Correo
SEG 80: Servicios de Gestion, Servicios Profesionales de Empresa y Servicios Administrativos
SEG 81: Servicios Basados en Ingenieria, Investigacion y Tecnologia
SEG 82: Servicios Editoriales, de Diseño, de Artes Graficas y Bellas Artes
SEG 83: Servicios Publicos y Servicios Relacionados con el Sector Publico
SEG 84: Servicios Financieros y de Seguros
SEG 85: Servicios de Salud
SEG 86: Servicios Educativos y de Formacion
SEG 90: Servicios de Viajes, Alimentacion, Alojamiento y Entretenimiento
SEG 91: Servicios Personales y Domesticos
SEG 92: Servicios de Defensa Nacional, Orden Publico, Seguridad y Vigilancia
SEG 93: Servicios Politicos y de Asuntos Civicos
SEG 94: Organizaciones y Clubes
SEG 95: Terrenos, Edificios, Estructuras y Vias`;

// Familias por segmento para el Paso 2
const FAMILIES_BY_SEG = {"10":{"1013":"Recipientes y habitat para animales","1014":"Productos de talabarteria y arreo","1017":"Fertilizantes y nutrientes para plantas y herbicidas","1019":"Productos para el control de plagas"},"11":{"1110":"Minerales, minerales metalicos y metales","1111":"Tierra y piedra","1112":"Productos no comestibles de planta y silvicultura","1114":"Chatarra y materiales de desecho","1115":"Fibra, hilos e hilados","1116":"Tejidos y materiales de cuero","1117":"Aleaciones","1118":"oxido metalico","1119":"Desechos metalicos y chatarra"},"12":{"1213":"Materiales explosivos","1214":"Elementos y gases","1216":"Aditivos","1217":"Colorantes","1218":"Ceras y aceites","1219":"Solventes","1235":"Compuestos y mezclas"},"13":{"1310":"Caucho y elastomeros","1311":"Resinas y colofonias y otros materiales derivados de resina"},"14":{"1410":"Materiales de papel","1411":"Productos de papel","1412":"Papel para uso industrial"},"15":{"1510":"Combustibles","1511":"Combustibles gaseosos y aditivos","1512":"Lubricantes, aceites, grasas y anticorrosivos","1513":"Combustible para reactores nucleares"},"20":{"2010":"Maquinaria y equipo de mineria y explotacion de canteras","2011":"Equipo de perforacion y explotacion de pozos","2012":"Equipo para perforacion y exploracion de petroleo y gas","2013":"Materiales para  perforacion y operaciones de petroleo y gas","2014":"Equipo de produccion y operacion de petroleo y gas"},"21":{"2110":"Maquinaria y equipo para agricultura, silvicultura y paisajismo","2111":"Equipo de pesca y acuicultura"},"22":{"2210":"Maquinaria y equipo pesado de construccion"},"23":{"2310":"Maquinaria para el procesamiento de materias primas","2311":"Maquinaria para el procesamiento de petroleo","2312":"Maquinaria y accesorios de textiles y tejidos","2313":"Maquinaria y equipos lapidarios","2314":"Maquinaria de reparacion y accesorios para marroquineria","2315":"Maquinaria, equipo y suministros de procesos industriales","2316":"Maquinas, equipo y suministros para fundicion","2318":"Equipo industrial para alimentos y bebidas","2319":"Mezcladores y sus partes y accesorios","2320":"Equipamiento para transferencia de masa","2321":"Maquinaria de fabricacion electronica, equipo y accesorios","2322":"Equipo y maquinaria de procesamiento de pollos","2323":"Equipo y maquinaria de procesamiento de madera y aserrado","2324":"Maquinaria y accesorios para cortar metales","2325":"Maquinaria y accesorios para el formado de metales","2326":"Maquinaria y accesorios para hacer prototipos rapidos","2327":"Maquinaria y accesorios y suministros para soldadura de todas las clases","2328":"Maquinaria para el tratamiento de metal","2329":"Herramientas de maquinado industrial","2330":"Maquinaria y equipo para cable"},"24":{"2410":"Maquinaria y equipo para manejo de materiales","2411":"Recipientes y almacenamiento","2412":"Materiales de empaque","2413":"Refrigeracion industrial","2414":"Suministros de embalaje"},"25":{"2510":"Vehiculos de motor","2512":"Maquinaria y equipo para ferrocarril y tranvias","2516":"Bicicletas no motorizadas","2517":"Componentes y sistemas de transporte","2518":"Carrocerias y remolques","2519":"Equipo para servicios de transporte"},"26":{"2610":"Fuentes de energia","2611":"Baterias y generadores y transmision de energia cinetica","2612":"Alambres, cables y arneses","2613":"Generacion de energia","2614":"Maquinaria y equipo para energia atomica o nuclear"},"27":{"2711":"Herramientas de mano","2712":"Maquinaria y equipo hidraulico","2713":"Maquinaria y equipo neumatico","2714":"Herramientas especializadas automotrices"},"30":{"3010":"Componentes estructurales y formas basicas","3011":"Hormigon, cemento y yeso","3012":"Carreteras y paisaje","3013":"Productos de construccion estructurales","3014":"Aislamiento","3015":"Materiales para acabado de exteriores","3016":"Materiales de acabado de interiores","3017":"Puertas y ventanas y vidrio","3018":"Instalaciones de plomeria","3019":"Equipo de apoyo para Construccion y Mantenimiento","3024":"Componentes de construccion de estructura portatil","3025":"Estructuras y materiales de mineria subterranea","3026":"Materiales estructurales"},"31":{"3110":"Piezas de fundicion y ensambles de piezas de fundicion","3111":"Extrusiones","3112":"Piezas fundidas maquinadas","3113":"Forjaduras","3114":"Molduras","3115":"Cuerda, cadena, cable, alambre y correa","3116":"Ferreteria","3117":"Rodamientos, cojinetes ruedas y engranajes","3118":"Empaques, glandulas, fundas y cubiertas","3119":"Materiales de afilado pulido y alisado","3120":"Adhesivos y selladores","3121":"Pinturas y bases y acabados","3122":"Extractos de teñir y de curtir","3123":"Materia prima en placas o barras labradas","3124":"optica industrial","3125":"Sistemas de control neumatico, hidraulico o electrico","3126":"Cubiertas, cajas y envolturas","3127":"Piezas hechas a maquina","3128":"Componentes de placa y estampados","3129":"Extrusiones maquinadas","3130":"Forjas labradas","3131":"Ensambles de tuberia fabricada","3132":"Ensambles fabricados de material en barras","3133":"Ensambles estructurales fabricados","3134":"Ensambles de lamina fabricado","3135":"Ensambles de tuberia fabricada","3136":"Ensambles de placa fabricados","3137":"Refractarios","3139":"Maquinados","3140":"Empaques","3141":"Sellos","3142":"Partes sinterizadas"},"32":{"3210":"Circuitos impresos, circuitos integrados y micro ensamblajes","3211":"Dispositivo semiconductor discreto","3212":"Componentes pasivos discretos","3213":"Piezas de componentes y hardware electronicos y accesorios","3214":"Dispositivos de tubo electronico y accesorios","3215":"Dispositivos y componentes y accesorios de control de automatizacion"},"39":{"3910":"Lamparas y bombillas y componentes para lamparas","3911":"Iluminacion, artefactos y accesorios","3912":"Equipos, suministros y componentes electricos","3913":"Dispositivos y accesorios y suministros de manejo de cable electrico"},"40":{"4010":"Calefaccion, ventilacion y circulacion del aire","4014":"Distribucion de fluidos y gas","4015":"Bombas y compresores industriales","4016":"Filtrado y purificacion industrial","4017":"Instalaciones de tubos y entubamientos","4018":"Instalaciones de tubos y tuberias"},"41":{"4110":"Equipo de laboratorio y cientifico","4111":"Instrumentos de medida, observacion y ensayo","4112":"Suministros y accesorios de laboratorio"},"42":{"4213":"Telas y vestidos medicos","4214":"Suministros, productos de tratamiento y cuidado del enfermo","4217":"Productos para los servicios medicos de urgencias y campo","4219":"Productos de centro medico","4227":"Productos de resucitacion, anestesia y respiratorio","4228":"Productos para la esterilizacion medica","4230":"Suministros para formacion y estudios de medicina","4231":"Productos para el cuidado de heridas"},"43":{"4319":"Dispositivos de comunicaciones y accesorios","4320":"Componentes para tecnologia de la informacion, difusion o telecomunicaciones","4321":"Equipo informatico y accesorios","4322":"Equipos o plataformas y accesorios de redes multimedia o de voz y datos","4323":"Software"},"44":{"4410":"Maquinaria, suministros y accesorios de oficina","4411":"Accesorios de oficina y escritorio","4412":"Suministros de oficina"},"45":{"4510":"Equipo de imprenta y publicacion","4511":"Equipos de audio y video para presentacion y composicion","4512":"Equipo de video, filmacion o fotografia","4513":"Medios fotograficos y de grabacion","4514":"Suministros fotograficos para cine"},"46":{"4610":"Armas ligeras y municion","4611":"Armas de guerra convencionales","4612":"Misiles","4613":"Cohetes y subsistemas","4614":"Lanzadores","4615":"Proteccion del Orden Publico","4616":"Seguridad y control publico","4617":"Seguridad, vigilancia y deteccion","4618":"Seguridad y proteccion personal","4619":"Proteccion contra incendios","4620":"Equipo de entrenamiento de seguridad fisica e industrial, defensa y orden publico"},"47":{"4710":"Tratamiento, suministros y eliminacion de agua y aguas residuales","4711":"Equipo industrial de lavanderia y lavado en seco","4712":"Equipo de aseo","4713":"Suministros de aseo y limpieza"},"48":{"4810":"Equipos de servicios de alimentacion para instituciones","4811":"Maquinas expendedoras","4812":"Equipo de Juego o de Apostar","4813":"Equipo y materiales funerarios"},"49":{"4910":"Coleccionables y condecoraciones","4912":"Equipos y accesorios para acampada y exteriores","4916":"Equipos deportivos para campos y canchas","4917":"Equipos de gimnasia y boxeo","4918":"Juegos, equipo de tiro y mesa","4920":"Equipo para entrenamiento fisico","4922":"Equipo  y accesorios para deportes","4924":"Equipo de recreo, parques infantiles y equipo y suministros de natacion y de spa"},"50":{"5013":"Productos lacteos y huevos","5015":"Aceites y grasas comestibles","5016":"Chocolates, azucares, edulcorantes y productos de confiteria","5019":"Alimentos preparados y conservados","5020":"Bebidas"},"52":{"5210":"Revestimientos de suelos","5212":"Ropa de cama, mantelerias, paños de cocina y toallas","5213":"Tratamientos de ventanas","5214":"Aparatos electrodomesticos","5215":"Utensilios de cocina domesticos","5216":"Electronica de consumo","5217":"Tratamientos de pared domestica"},"53":{"5310":"Ropa","5311":"Calzado","5312":"Maletas, bolsos de mano, mochilas y estuches","5313":"Articulos de tocador y cuidado personal","5314":"Fuentes y accesorios de costura"},"54":{"5411":"Relojes","5412":"Gemas"},"55":{"5510":"Medios impresos","5511":"Material electronico de referencia","5512":"Etiquetado y accesorios"},"56":{"5610":"Muebles de alojamiento","5611":"Muebles comerciales e industriales","5612":"Mobiliario institucional, escolar y educativo y accesorios","5613":"Muebles y accesorios para merchandising","5614":"Adornos para el hogar"},"60":{"6010":"Materiales didacticos profesionales y de desarrollo y accesorios y suministros","6011":"Decoraciones y suministros del aula","6012":"Equipo, accesorios y suministros de arte y manualidades","6013":"Instrumentos musicales, piezas y accesorios","6014":"Juguetes y juegos"},"70":{"7010":"Pesquerias y acuicultura","7011":"Horticultura","7012":"Servicios de animales vivos","7013":"Preparacion, gestion y proteccion del terreno y del suelo","7014":"Produccion, gestion y proteccion de cultivos","7015":"Silvicultura","7016":"Fauna y flora silvestres","7017":"Desarrollo y vigilancia de recursos hidraulicos"},"71":{"7110":"Servicios de mineria","7111":"Servicios de perforacion y prospeccion petrolifera y de gas","7112":"Servicios de construccion y perforacion de pozos","7113":"Servicios de aumento de la extraccion y produccion de gas y petroleo","7114":"Servicios de restauracion y recuperacion de gas y petroleo","7115":"Servicios de procesamiento y gestion de datos de petroleo y gas","7116":"Servicios de gerencia de proyectos en pozos de petroleo y gas"},"72":{"7210":"Servicios de mantenimiento y reparaciones de construcciones e instalaciones","7211":"Servicios de construccion de edificaciones residenciales","7212":"Servicios de construccion de edificaciones no residenciales","7214":"Servicios de construccion pesada","7215":"Servicios de mantenimiento y construccion de comercio especializado"},"73":{"7310":"Industrias de plasticos y productos quimicos","7311":"Industrias de la madera y el papel","7312":"Industrias del metal y de minerales","7313":"Industrias de alimentos y bebidas","7314":"Industrias de fibras, textiles y de tejidos","7315":"Servicios de apoyo a la fabricacion","7316":"Fabricacion de maquinaria y equipo de transporte","7317":"Fabricacion de productos electricos e instrumentos de precision","7318":"Servicios de maquinado y procesado"},"76":{"7610":"Servicios de descontaminacion","7611":"Servicios de aseo y limpieza","7612":"Eliminacion y tratamiento de desechos","7613":"Limpieza de residuos toxicos y peligrosos"},"77":{"7710":"Gestion medioambiental","7711":"Proteccion medioambiental","7712":"Seguimiento, control y rehabilitacion de la contaminacion","7713":"Servicios de seguimiento, control o rehabilitacion de contaminantes"},"78":{"7810":"Transporte de correo y carga","7811":"Transporte de pasajeros","7812":"Manejo y embalaje de material","7813":"Almacenaje","7814":"Servicios de transporte","7818":"Servicios de mantenimiento o reparaciones de transportes"},"80":{"8010":"Servicios de asesoria de gestion","8011":"Servicios de recursos humanos","8012":"Servicios legales","8013":"Servicios inmobiliarios","8014":"Comercializacion y distribucion","8015":"Politica comercial y servicios","8016":"Servicios de administracion de empresas"},"81":{"8110":"Servicios profesionales de ingenieria","8111":"Servicios informaticos","8112":"Economia","8113":"Estadistica","8114":"Tecnologias de fabricacion","8115":"Servicios de pedologia","8116":"Entrega de servicios de tecnologia de informacion"},"82":{"8210":"Publicidad","8211":"Escritura y traducciones","8212":"Servicios de reproduccion","8213":"Servicios fotograficos","8214":"Diseño grafico","8215":"Artistas e interpretes profesionales"},"83":{"8310":"Servicios publicos","8311":"Servicios de medios de telecomunicaciones","8312":"Servicios de informacion"},"84":{"8410":"Finanzas de desarrollo","8411":"Servicios de contabilidad y auditorias","8412":"Banca e inversiones","8413":"Servicios de seguros y pensiones","8414":"Agencias de credito"},"85":{"8510":"Servicios integrales de salud","8511":"Prevencion y control de enfermedades","8512":"Practica medica","8513":"Ciencia medica, investigacion y experimentacion","8514":"Medicina alternativa y holistica","8515":"Servicios alimenticios y de nutricion","8516":"Servicios de mantenimiento, renovacion y reparacion de equipo medico quirurgico","8517":"Servicios de muerte y soporte al fallecimiento"},"86":{"8610":"Formacion profesional","8611":"Sistemas educativos alternativos","8612":"Instituciones educativas","8613":"Servicios educativos especializados","8614":"Instalaciones educativas"},"90":{"9010":"Restaurantes y catering (servicios de comidas y bebidas)","9011":"Instalaciones hoteleras, alojamientos y centros de encuentros","9012":"Facilitacion de viajes","9013":"Artes interpretativas","9014":"Deportes comerciales","9015":"Servicios de entretenimiento"},"91":{"9110":"Aspecto personal","9111":"Asistencia domestica y personal"},"92":{"9210":"Orden publico y seguridad","9211":"Servicios militares o defensa nacional","9212":"Seguridad y proteccion personal"},"93":{"9310":"Sistemas e instituciones politicas","9311":"Condiciones sociopoliticas","9312":"Relaciones internacionales","9313":"Ayuda y asistencia humanitaria","9314":"Servicios comunitarios y sociales","9315":"Servicios de administracion y financiacion publica","9316":"Tributacion","9317":"Politica y regulacion comercial"},"94":{"9410":"Organizaciones laborales","9411":"Organizaciones religiosas","9412":"Clubes","9413":"Organizaciones, asociaciones y movimientos civicos"},"95":{"9510":"Parcelas de tierra","9511":"Vias","9512":"Estructuras y edificios permanentes","9513":"Estructuras y edificios moviles","9514":"Estructuras y edificios prefabricados"}};

// Lista completa de 333 familias para el Paso 2 (~4,500 tokens — supera mínimo cache)
const ALL_FAMILIES_TEXT = `FAM 1013 (SEG 10): Recipientes y habitat para animales
FAM 1014 (SEG 10): Productos de talabarteria y arreo
FAM 1017 (SEG 10): Fertilizantes y nutrientes para plantas y herbicidas
FAM 1019 (SEG 10): Productos para el control de plagas
FAM 1110 (SEG 11): Minerales, minerales metalicos y metales
FAM 1111 (SEG 11): Tierra y piedra
FAM 1112 (SEG 11): Productos no comestibles de planta y silvicultura
FAM 1114 (SEG 11): Chatarra y materiales de desecho
FAM 1115 (SEG 11): Fibra, hilos e hilados
FAM 1116 (SEG 11): Tejidos y materiales de cuero
FAM 1117 (SEG 11): Aleaciones
FAM 1118 (SEG 11): oxido metalico
FAM 1119 (SEG 11): Desechos metalicos y chatarra
FAM 1213 (SEG 12): Materiales explosivos
FAM 1214 (SEG 12): Elementos y gases
FAM 1216 (SEG 12): Aditivos
FAM 1217 (SEG 12): Colorantes
FAM 1218 (SEG 12): Ceras y aceites
FAM 1219 (SEG 12): Solventes
FAM 1235 (SEG 12): Compuestos y mezclas
FAM 1310 (SEG 13): Caucho y elastomeros
FAM 1311 (SEG 13): Resinas y colofonias y otros materiales derivados de resina
FAM 1410 (SEG 14): Materiales de papel
FAM 1411 (SEG 14): Productos de papel
FAM 1412 (SEG 14): Papel para uso industrial
FAM 1510 (SEG 15): Combustibles
FAM 1511 (SEG 15): Combustibles gaseosos y aditivos
FAM 1512 (SEG 15): Lubricantes, aceites, grasas y anticorrosivos
FAM 1513 (SEG 15): Combustible para reactores nucleares
FAM 2010 (SEG 20): Maquinaria y equipo de mineria y explotacion de canteras
FAM 2011 (SEG 20): Equipo de perforacion y explotacion de pozos
FAM 2012 (SEG 20): Equipo para perforacion y exploracion de petroleo y gas
FAM 2013 (SEG 20): Materiales para  perforacion y operaciones de petroleo y gas
FAM 2014 (SEG 20): Equipo de produccion y operacion de petroleo y gas
FAM 2110 (SEG 21): Maquinaria y equipo para agricultura, silvicultura y paisajismo
FAM 2111 (SEG 21): Equipo de pesca y acuicultura
FAM 2210 (SEG 22): Maquinaria y equipo pesado de construccion
FAM 2310 (SEG 23): Maquinaria para el procesamiento de materias primas
FAM 2311 (SEG 23): Maquinaria para el procesamiento de petroleo
FAM 2312 (SEG 23): Maquinaria y accesorios de textiles y tejidos
FAM 2313 (SEG 23): Maquinaria y equipos lapidarios
FAM 2314 (SEG 23): Maquinaria de reparacion y accesorios para marroquineria
FAM 2315 (SEG 23): Maquinaria, equipo y suministros de procesos industriales
FAM 2316 (SEG 23): Maquinas, equipo y suministros para fundicion
FAM 2318 (SEG 23): Equipo industrial para alimentos y bebidas
FAM 2319 (SEG 23): Mezcladores y sus partes y accesorios
FAM 2320 (SEG 23): Equipamiento para transferencia de masa
FAM 2321 (SEG 23): Maquinaria de fabricacion electronica, equipo y accesorios
FAM 2322 (SEG 23): Equipo y maquinaria de procesamiento de pollos
FAM 2323 (SEG 23): Equipo y maquinaria de procesamiento de madera y aserrado
FAM 2324 (SEG 23): Maquinaria y accesorios para cortar metales
FAM 2325 (SEG 23): Maquinaria y accesorios para el formado de metales
FAM 2326 (SEG 23): Maquinaria y accesorios para hacer prototipos rapidos
FAM 2327 (SEG 23): Maquinaria y accesorios y suministros para soldadura de todas las clases
FAM 2328 (SEG 23): Maquinaria para el tratamiento de metal
FAM 2329 (SEG 23): Herramientas de maquinado industrial
FAM 2330 (SEG 23): Maquinaria y equipo para cable
FAM 2410 (SEG 24): Maquinaria y equipo para manejo de materiales
FAM 2411 (SEG 24): Recipientes y almacenamiento
FAM 2412 (SEG 24): Materiales de empaque
FAM 2413 (SEG 24): Refrigeracion industrial
FAM 2414 (SEG 24): Suministros de embalaje
FAM 2510 (SEG 25): Vehiculos de motor
FAM 2512 (SEG 25): Maquinaria y equipo para ferrocarril y tranvias
FAM 2516 (SEG 25): Bicicletas no motorizadas
FAM 2517 (SEG 25): Componentes y sistemas de transporte
FAM 2518 (SEG 25): Carrocerias y remolques
FAM 2519 (SEG 25): Equipo para servicios de transporte
FAM 2610 (SEG 26): Fuentes de energia
FAM 2611 (SEG 26): Baterias y generadores y transmision de energia cinetica
FAM 2612 (SEG 26): Alambres, cables y arneses
FAM 2613 (SEG 26): Generacion de energia
FAM 2614 (SEG 26): Maquinaria y equipo para energia atomica o nuclear
FAM 2711 (SEG 27): Herramientas de mano
FAM 2712 (SEG 27): Maquinaria y equipo hidraulico
FAM 2713 (SEG 27): Maquinaria y equipo neumatico
FAM 2714 (SEG 27): Herramientas especializadas automotrices
FAM 3010 (SEG 30): Componentes estructurales y formas basicas
FAM 3011 (SEG 30): Hormigon, cemento y yeso
FAM 3012 (SEG 30): Carreteras y paisaje
FAM 3013 (SEG 30): Productos de construccion estructurales
FAM 3014 (SEG 30): Aislamiento
FAM 3015 (SEG 30): Materiales para acabado de exteriores
FAM 3016 (SEG 30): Materiales de acabado de interiores
FAM 3017 (SEG 30): Puertas y ventanas y vidrio
FAM 3018 (SEG 30): Instalaciones de plomeria
FAM 3019 (SEG 30): Equipo de apoyo para Construccion y Mantenimiento
FAM 3024 (SEG 30): Componentes de construccion de estructura portatil
FAM 3025 (SEG 30): Estructuras y materiales de mineria subterranea
FAM 3026 (SEG 30): Materiales estructurales
FAM 3110 (SEG 31): Piezas de fundicion y ensambles de piezas de fundicion
FAM 3111 (SEG 31): Extrusiones
FAM 3112 (SEG 31): Piezas fundidas maquinadas
FAM 3113 (SEG 31): Forjaduras
FAM 3114 (SEG 31): Molduras
FAM 3115 (SEG 31): Cuerda, cadena, cable, alambre y correa
FAM 3116 (SEG 31): Ferreteria
FAM 3117 (SEG 31): Rodamientos, cojinetes ruedas y engranajes
FAM 3118 (SEG 31): Empaques, glandulas, fundas y cubiertas
FAM 3119 (SEG 31): Materiales de afilado pulido y alisado
FAM 3120 (SEG 31): Adhesivos y selladores
FAM 3121 (SEG 31): Pinturas y bases y acabados
FAM 3122 (SEG 31): Extractos de teñir y de curtir
FAM 3123 (SEG 31): Materia prima en placas o barras labradas
FAM 3124 (SEG 31): optica industrial
FAM 3125 (SEG 31): Sistemas de control neumatico, hidraulico o electrico
FAM 3126 (SEG 31): Cubiertas, cajas y envolturas
FAM 3127 (SEG 31): Piezas hechas a maquina
FAM 3128 (SEG 31): Componentes de placa y estampados
FAM 3129 (SEG 31): Extrusiones maquinadas
FAM 3130 (SEG 31): Forjas labradas
FAM 3131 (SEG 31): Ensambles de tuberia fabricada
FAM 3132 (SEG 31): Ensambles fabricados de material en barras
FAM 3133 (SEG 31): Ensambles estructurales fabricados
FAM 3134 (SEG 31): Ensambles de lamina fabricado
FAM 3135 (SEG 31): Ensambles de tuberia fabricada
FAM 3136 (SEG 31): Ensambles de placa fabricados
FAM 3137 (SEG 31): Refractarios
FAM 3139 (SEG 31): Maquinados
FAM 3140 (SEG 31): Empaques
FAM 3141 (SEG 31): Sellos
FAM 3142 (SEG 31): Partes sinterizadas
FAM 3210 (SEG 32): Circuitos impresos, circuitos integrados y micro ensamblajes
FAM 3211 (SEG 32): Dispositivo semiconductor discreto
FAM 3212 (SEG 32): Componentes pasivos discretos
FAM 3213 (SEG 32): Piezas de componentes y hardware electronicos y accesorios
FAM 3214 (SEG 32): Dispositivos de tubo electronico y accesorios
FAM 3215 (SEG 32): Dispositivos y componentes y accesorios de control de automatizacion
FAM 3910 (SEG 39): Lamparas y bombillas y componentes para lamparas
FAM 3911 (SEG 39): Iluminacion, artefactos y accesorios
FAM 3912 (SEG 39): Equipos, suministros y componentes electricos
FAM 3913 (SEG 39): Dispositivos y accesorios y suministros de manejo de cable electrico
FAM 4010 (SEG 40): Calefaccion, ventilacion y circulacion del aire
FAM 4014 (SEG 40): Distribucion de fluidos y gas
FAM 4015 (SEG 40): Bombas y compresores industriales
FAM 4016 (SEG 40): Filtrado y purificacion industrial
FAM 4017 (SEG 40): Instalaciones de tubos y entubamientos
FAM 4018 (SEG 40): Instalaciones de tubos y tuberias
FAM 4110 (SEG 41): Equipo de laboratorio y cientifico
FAM 4111 (SEG 41): Instrumentos de medida, observacion y ensayo
FAM 4112 (SEG 41): Suministros y accesorios de laboratorio
FAM 4213 (SEG 42): Telas y vestidos medicos
FAM 4214 (SEG 42): Suministros, productos de tratamiento y cuidado del enfermo
FAM 4217 (SEG 42): Productos para los servicios medicos de urgencias y campo
FAM 4219 (SEG 42): Productos de centro medico
FAM 4227 (SEG 42): Productos de resucitacion, anestesia y respiratorio
FAM 4228 (SEG 42): Productos para la esterilizacion medica
FAM 4230 (SEG 42): Suministros para formacion y estudios de medicina
FAM 4231 (SEG 42): Productos para el cuidado de heridas
FAM 4319 (SEG 43): Dispositivos de comunicaciones y accesorios
FAM 4320 (SEG 43): Componentes para tecnologia de la informacion, difusion o telecomunicaciones
FAM 4321 (SEG 43): Equipo informatico y accesorios
FAM 4322 (SEG 43): Equipos o plataformas y accesorios de redes multimedia o de voz y datos
FAM 4323 (SEG 43): Software
FAM 4410 (SEG 44): Maquinaria, suministros y accesorios de oficina
FAM 4411 (SEG 44): Accesorios de oficina y escritorio
FAM 4412 (SEG 44): Suministros de oficina
FAM 4510 (SEG 45): Equipo de imprenta y publicacion
FAM 4511 (SEG 45): Equipos de audio y video para presentacion y composicion
FAM 4512 (SEG 45): Equipo de video, filmacion o fotografia
FAM 4513 (SEG 45): Medios fotograficos y de grabacion
FAM 4514 (SEG 45): Suministros fotograficos para cine
FAM 4610 (SEG 46): Armas ligeras y municion
FAM 4611 (SEG 46): Armas de guerra convencionales
FAM 4612 (SEG 46): Misiles
FAM 4613 (SEG 46): Cohetes y subsistemas
FAM 4614 (SEG 46): Lanzadores
FAM 4615 (SEG 46): Proteccion del Orden Publico
FAM 4616 (SEG 46): Seguridad y control publico
FAM 4617 (SEG 46): Seguridad, vigilancia y deteccion
FAM 4618 (SEG 46): Seguridad y proteccion personal
FAM 4619 (SEG 46): Proteccion contra incendios
FAM 4620 (SEG 46): Equipo de entrenamiento de seguridad fisica e industrial, defensa y orden publico
FAM 4710 (SEG 47): Tratamiento, suministros y eliminacion de agua y aguas residuales
FAM 4711 (SEG 47): Equipo industrial de lavanderia y lavado en seco
FAM 4712 (SEG 47): Equipo de aseo
FAM 4713 (SEG 47): Suministros de aseo y limpieza
FAM 4810 (SEG 48): Equipos de servicios de alimentacion para instituciones
FAM 4811 (SEG 48): Maquinas expendedoras
FAM 4812 (SEG 48): Equipo de Juego o de Apostar
FAM 4813 (SEG 48): Equipo y materiales funerarios
FAM 4910 (SEG 49): Coleccionables y condecoraciones
FAM 4912 (SEG 49): Equipos y accesorios para acampada y exteriores
FAM 4916 (SEG 49): Equipos deportivos para campos y canchas
FAM 4917 (SEG 49): Equipos de gimnasia y boxeo
FAM 4918 (SEG 49): Juegos, equipo de tiro y mesa
FAM 4920 (SEG 49): Equipo para entrenamiento fisico
FAM 4922 (SEG 49): Equipo  y accesorios para deportes
FAM 4924 (SEG 49): Equipo de recreo, parques infantiles y equipo y suministros de natacion y de spa
FAM 5013 (SEG 50): Productos lacteos y huevos
FAM 5015 (SEG 50): Aceites y grasas comestibles
FAM 5016 (SEG 50): Chocolates, azucares, edulcorantes y productos de confiteria
FAM 5019 (SEG 50): Alimentos preparados y conservados
FAM 5020 (SEG 50): Bebidas
FAM 5210 (SEG 52): Revestimientos de suelos
FAM 5212 (SEG 52): Ropa de cama, mantelerias, paños de cocina y toallas
FAM 5213 (SEG 52): Tratamientos de ventanas
FAM 5214 (SEG 52): Aparatos electrodomesticos
FAM 5215 (SEG 52): Utensilios de cocina domesticos
FAM 5216 (SEG 52): Electronica de consumo
FAM 5217 (SEG 52): Tratamientos de pared domestica
FAM 5310 (SEG 53): Ropa
FAM 5311 (SEG 53): Calzado
FAM 5312 (SEG 53): Maletas, bolsos de mano, mochilas y estuches
FAM 5313 (SEG 53): Articulos de tocador y cuidado personal
FAM 5314 (SEG 53): Fuentes y accesorios de costura
FAM 5411 (SEG 54): Relojes
FAM 5412 (SEG 54): Gemas
FAM 5510 (SEG 55): Medios impresos
FAM 5511 (SEG 55): Material electronico de referencia
FAM 5512 (SEG 55): Etiquetado y accesorios
FAM 5610 (SEG 56): Muebles de alojamiento
FAM 5611 (SEG 56): Muebles comerciales e industriales
FAM 5612 (SEG 56): Mobiliario institucional, escolar y educativo y accesorios
FAM 5613 (SEG 56): Muebles y accesorios para merchandising
FAM 5614 (SEG 56): Adornos para el hogar
FAM 6010 (SEG 60): Materiales didacticos profesionales y de desarrollo y accesorios y suministros
FAM 6011 (SEG 60): Decoraciones y suministros del aula
FAM 6012 (SEG 60): Equipo, accesorios y suministros de arte y manualidades
FAM 6013 (SEG 60): Instrumentos musicales, piezas y accesorios
FAM 6014 (SEG 60): Juguetes y juegos
FAM 7010 (SEG 70): Pesquerias y acuicultura
FAM 7011 (SEG 70): Horticultura
FAM 7012 (SEG 70): Servicios de animales vivos
FAM 7013 (SEG 70): Preparacion, gestion y proteccion del terreno y del suelo
FAM 7014 (SEG 70): Produccion, gestion y proteccion de cultivos
FAM 7015 (SEG 70): Silvicultura
FAM 7016 (SEG 70): Fauna y flora silvestres
FAM 7017 (SEG 70): Desarrollo y vigilancia de recursos hidraulicos
FAM 7110 (SEG 71): Servicios de mineria
FAM 7111 (SEG 71): Servicios de perforacion y prospeccion petrolifera y de gas
FAM 7112 (SEG 71): Servicios de construccion y perforacion de pozos
FAM 7113 (SEG 71): Servicios de aumento de la extraccion y produccion de gas y petroleo
FAM 7114 (SEG 71): Servicios de restauracion y recuperacion de gas y petroleo
FAM 7115 (SEG 71): Servicios de procesamiento y gestion de datos de petroleo y gas
FAM 7116 (SEG 71): Servicios de gerencia de proyectos en pozos de petroleo y gas
FAM 7210 (SEG 72): Servicios de mantenimiento y reparaciones de construcciones e instalaciones
FAM 7211 (SEG 72): Servicios de construccion de edificaciones residenciales
FAM 7212 (SEG 72): Servicios de construccion de edificaciones no residenciales
FAM 7214 (SEG 72): Servicios de construccion pesada
FAM 7215 (SEG 72): Servicios de mantenimiento y construccion de comercio especializado
FAM 7310 (SEG 73): Industrias de plasticos y productos quimicos
FAM 7311 (SEG 73): Industrias de la madera y el papel
FAM 7312 (SEG 73): Industrias del metal y de minerales
FAM 7313 (SEG 73): Industrias de alimentos y bebidas
FAM 7314 (SEG 73): Industrias de fibras, textiles y de tejidos
FAM 7315 (SEG 73): Servicios de apoyo a la fabricacion
FAM 7316 (SEG 73): Fabricacion de maquinaria y equipo de transporte
FAM 7317 (SEG 73): Fabricacion de productos electricos e instrumentos de precision
FAM 7318 (SEG 73): Servicios de maquinado y procesado
FAM 7610 (SEG 76): Servicios de descontaminacion
FAM 7611 (SEG 76): Servicios de aseo y limpieza
FAM 7612 (SEG 76): Eliminacion y tratamiento de desechos
FAM 7613 (SEG 76): Limpieza de residuos toxicos y peligrosos
FAM 7710 (SEG 77): Gestion medioambiental
FAM 7711 (SEG 77): Proteccion medioambiental
FAM 7712 (SEG 77): Seguimiento, control y rehabilitacion de la contaminacion
FAM 7713 (SEG 77): Servicios de seguimiento, control o rehabilitacion de contaminantes
FAM 7810 (SEG 78): Transporte de correo y carga
FAM 7811 (SEG 78): Transporte de pasajeros
FAM 7812 (SEG 78): Manejo y embalaje de material
FAM 7813 (SEG 78): Almacenaje
FAM 7814 (SEG 78): Servicios de transporte
FAM 7818 (SEG 78): Servicios de mantenimiento o reparaciones de transportes
FAM 8010 (SEG 80): Servicios de asesoria de gestion
FAM 8011 (SEG 80): Servicios de recursos humanos
FAM 8012 (SEG 80): Servicios legales
FAM 8013 (SEG 80): Servicios inmobiliarios
FAM 8014 (SEG 80): Comercializacion y distribucion
FAM 8015 (SEG 80): Politica comercial y servicios
FAM 8016 (SEG 80): Servicios de administracion de empresas
FAM 8110 (SEG 81): Servicios profesionales de ingenieria
FAM 8111 (SEG 81): Servicios informaticos
FAM 8112 (SEG 81): Economia
FAM 8113 (SEG 81): Estadistica
FAM 8114 (SEG 81): Tecnologias de fabricacion
FAM 8115 (SEG 81): Servicios de pedologia
FAM 8116 (SEG 81): Entrega de servicios de tecnologia de informacion
FAM 8210 (SEG 82): Publicidad
FAM 8211 (SEG 82): Escritura y traducciones
FAM 8212 (SEG 82): Servicios de reproduccion
FAM 8213 (SEG 82): Servicios fotograficos
FAM 8214 (SEG 82): Diseño grafico
FAM 8215 (SEG 82): Artistas e interpretes profesionales
FAM 8310 (SEG 83): Servicios publicos
FAM 8311 (SEG 83): Servicios de medios de telecomunicaciones
FAM 8312 (SEG 83): Servicios de informacion
FAM 8410 (SEG 84): Finanzas de desarrollo
FAM 8411 (SEG 84): Servicios de contabilidad y auditorias
FAM 8412 (SEG 84): Banca e inversiones
FAM 8413 (SEG 84): Servicios de seguros y pensiones
FAM 8414 (SEG 84): Agencias de credito
FAM 8510 (SEG 85): Servicios integrales de salud
FAM 8511 (SEG 85): Prevencion y control de enfermedades
FAM 8512 (SEG 85): Practica medica
FAM 8513 (SEG 85): Ciencia medica, investigacion y experimentacion
FAM 8514 (SEG 85): Medicina alternativa y holistica
FAM 8515 (SEG 85): Servicios alimenticios y de nutricion
FAM 8516 (SEG 85): Servicios de mantenimiento, renovacion y reparacion de equipo medico quirurgico
FAM 8517 (SEG 85): Servicios de muerte y soporte al fallecimiento
FAM 8610 (SEG 86): Formacion profesional
FAM 8611 (SEG 86): Sistemas educativos alternativos
FAM 8612 (SEG 86): Instituciones educativas
FAM 8613 (SEG 86): Servicios educativos especializados
FAM 8614 (SEG 86): Instalaciones educativas
FAM 9010 (SEG 90): Restaurantes y catering (servicios de comidas y bebidas)
FAM 9011 (SEG 90): Instalaciones hoteleras, alojamientos y centros de encuentros
FAM 9012 (SEG 90): Facilitacion de viajes
FAM 9013 (SEG 90): Artes interpretativas
FAM 9014 (SEG 90): Deportes comerciales
FAM 9015 (SEG 90): Servicios de entretenimiento
FAM 9110 (SEG 91): Aspecto personal
FAM 9111 (SEG 91): Asistencia domestica y personal
FAM 9210 (SEG 92): Orden publico y seguridad
FAM 9211 (SEG 92): Servicios militares o defensa nacional
FAM 9212 (SEG 92): Seguridad y proteccion personal
FAM 9310 (SEG 93): Sistemas e instituciones politicas
FAM 9311 (SEG 93): Condiciones sociopoliticas
FAM 9312 (SEG 93): Relaciones internacionales
FAM 9313 (SEG 93): Ayuda y asistencia humanitaria
FAM 9314 (SEG 93): Servicios comunitarios y sociales
FAM 9315 (SEG 93): Servicios de administracion y financiacion publica
FAM 9316 (SEG 93): Tributacion
FAM 9317 (SEG 93): Politica y regulacion comercial
FAM 9410 (SEG 94): Organizaciones laborales
FAM 9411 (SEG 94): Organizaciones religiosas
FAM 9412 (SEG 94): Clubes
FAM 9413 (SEG 94): Organizaciones, asociaciones y movimientos civicos
FAM 9510 (SEG 95): Parcelas de tierra
FAM 9511 (SEG 95): Vias
FAM 9512 (SEG 95): Estructuras y edificios permanentes
FAM 9513 (SEG 95): Estructuras y edificios moviles
FAM 9514 (SEG 95): Estructuras y edificios prefabricados`;

// ── Llamada a Anthropic con soporte de prompt caching ──────────────────────
async function callAnthropic({ systemBlocks, userText, maxTokens = 400, model = MODEL_PRECISE, bulk = false }) {
  // Si es búsqueda masiva, agregar cache_control al último bloque del system
  const systemToSend = bulk
    ? systemBlocks.map((b, i) =>
        i === systemBlocks.length - 1
          ? { ...b, cache_control: { type: 'ephemeral' } }
          : b
      )
    : systemBlocks;

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
      system: systemToSend,
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

// ── Parsear JSON de la respuesta IA (limpia markdown si viene) ─────────────
function parseJSON(text) {
  const clean = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se encontró JSON válido en la respuesta de la IA.');
  return JSON.parse(match[0]);
}

// Acumular tokens de uso de Anthropic
function mergeUsage(acc, u) {
  return {
    input_tokens:              (acc.input_tokens              || 0) + (u.input_tokens              || 0),
    output_tokens:             (acc.output_tokens             || 0) + (u.output_tokens             || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    cache_read_input_tokens:   (acc.cache_read_input_tokens   || 0) + (u.cache_read_input_tokens   || 0)
  };
}

// ── PASO 1: IA identifica TOP 2 segmentos ─────────────────────────────────
// Paso 1: IA identifica TOP 2 segmentos
async function getTopSegments(denominacion, bulk = false) {
  const data = await callAnthropic({
    bulk,
    systemBlocks: [
      {
        type: 'text',
        text: `Eres un experto en clasificación UNSPSC para industria minera, eléctrica, mecánica e instrumentación. Dado un material o producto, identifica los 2 segmentos UNSPSC más probables de la lista proporcionada.

INSTRUCCIONES DE CLASIFICACIÓN:
- Analiza la FUNCIÓN PRINCIPAL del material, no su nombre literal ni su marca comercial.
- Ignora marcas comerciales (SKF, ABB, Siemens, HP, etc.), números de parte y especificaciones técnicas.
- Considera sinónimos y modismos industriales regionales.
- Si el material claramente pertenece a un solo segmento, repite ese segmento dos veces.
- Prioriza la categoría más específica y representativa de la función del material.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown:
{"segments":["XX","YY"]}

LISTA COMPLETA DE SEGMENTOS UNSPSC DISPONIBLES:
${SEGMENTS_TEXT}`
      }
    ],
    userText: `Material: ${denominacion}`,
    model: MODEL_FAST
  });

  const parsed = parseJSON(data.text);
  return { segments: parsed.segments || [], usage: data.usage };
}

// ── PASO 2: IA elige TOP 3 familias dentro de los segmentos ───────────────
// Paso 2: IA elige TOP 3 familias dentro de los segmentos
async function getTopFamilies(denominacion, segCodes, bulk = false) {
  // Usar lista completa de 333 familias — bloque fijo, cacheable, mayor precisión
  const data = await callAnthropic({
    bulk,
    systemBlocks: [
      {
        type: 'text',
        text: `Eres un experto en clasificación UNSPSC para industria minera, eléctrica, mecánica, instrumentación y tecnología. Dado un material, identifica las 3 familias UNSPSC más probables de la lista completa.

REGLAS DE CLASIFICACIÓN:
- Clasifica por la FUNCIÓN PRINCIPAL del material, nunca por coincidencia literal de palabras.
- Ignora completamente: marcas comerciales (SKF, ABB, Siemens, HP, etc.), números de parte, especificaciones técnicas.
- Interpreta sinónimos y equivalencias industriales:
  * RODAMIENTO = COJINETE = BEARING → FAM 3117
  * VALVULA = LLAVE DE PASO = GRIFO → FAM 4014
  * MOTOR ELECTRICO = MOTOREDUCTOR → FAM 2610
  * SENSOR = TRANSMISOR = DETECTOR = INSTRUMENTO → FAM 4111
  * CONTACTO = RELE = CONTACTOR → FAM 3912 o 3916
  * LAPTOP = NOTEBOOK = COMPUTADOR PORTATIL → FAM 4321
  * CABLE = CONDUCTOR = ALAMBRE → FAM 2612
  * MANGUERA = FLEXIBLE = TUBO HIDRAULICO → FAM 4017 o 4018
  * FILTRO = ELEMENTO FILTRANTE → FAM 4016
  * BOMBA = COMPRESOR → FAM 4015
  * PLACA ELECTRONICA = TARJETA = PCB → FAM 3210 o 3215
  * FUENTE DE ALIMENTACION = TRANSFORMADOR → FAM 3912 o 3913
  * HERRAMIENTA = LLAVE = ALICATE → FAM 2711
  * EPP = CASCO = GUANTES = ARNES → FAM 4618
- El primer elemento debe ser la familia MÁS probable.
- Incluye siempre exactamente 2 familias.

FORMATO — responde ÚNICAMENTE con JSON válido, sin markdown:
{"families":["XXXX","YYYY"]}

LISTA COMPLETA DE 333 FAMILIAS UNSPSC:
${ALL_FAMILIES_TEXT}`
      }
    ],
    userText: `Material: ${denominacion}`,
    model: MODEL_FAST
  });

  const parsed = parseJSON(data.text);
  return { families: parsed.families || [], usage: data.usage };
}

// ── PASO 3: IA elige el código exacto entre productos de las familias ──────
// Paso 3: IA elige el código exacto entre productos de las familias
async function getExactCode(denominacion, familyProducts, bulk = false) {
  let productList = '';
  for (const [famCode, products] of Object.entries(familyProducts)) {
    productList += `\n--- Familia ${famCode} ---\n`;
    for (const [code, name] of products) {
      productList += `${code}: ${name}\n`;
    }
  }

  const data = await callAnthropic({
    bulk,
    systemBlocks: [
      {
        type: 'text',
        text: `Eres un experto en clasificación UNSPSC. Clasifica el material en el código más preciso.

INSTRUCCIONES:
- Elige el código que mejor represente la FUNCIÓN PRINCIPAL del material.
- Ignora marcas, números de parte y especificaciones técnicas.
- Si ningún código es exacto, elige el más cercano con confianza BAJA.
- Incluye máximo 2 alternativas relevantes.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "codigo": "XXXXXXXX",
  "nombre": "Nombre del producto UNSPSC",
  "confianza": "ALTA|MEDIA|BAJA",
  "razon": "Justificación en máximo 12 palabras",
  "alternativas": [
    {"codigo": "XXXXXXXX", "nombre": "Nombre", "confianza": "MEDIA"}
  ]
}

PRODUCTOS UNSPSC DISPONIBLES:
${productList}`
      }
    ],
    userText: `Material: ${denominacion}`,
    maxTokens: 500,
    model: MODEL_PRECISE
  });

  return { result: parseJSON(data.text), usage: data.usage };
}

// ── HANDLER PRINCIPAL ──────────────────────────────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const username = getSessionUser(req);
  if (!username) {
    return res.status(401).json({ error: 'Sesión no autenticada o expirada.' });
  }

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { denominacion, segments, familyProducts } = body || {};

  if (!denominacion) {
    return res.status(400).json({ error: 'Falta el campo denominacion.' });
  }

  try {
    const bulk = body.bulk === true;

    if (!segments && !familyProducts) {
      // PASO 1: identificar top 2 segmentos
      const r = await getTopSegments(denominacion, bulk);
      return res.status(200).json({ step: 'segments', segments: r.segments, usage: r.usage });

    } else if (segments && !familyProducts) {
      // PASO 2: identificar top 3 familias
      const r = await getTopFamilies(denominacion, segments, bulk);
      return res.status(200).json({ step: 'families', families: r.families, usage: r.usage });

    } else if (familyProducts) {
      // PASO 3: identificar código exacto
      const r = await getExactCode(denominacion, familyProducts, bulk);
      return res.status(200).json({ step: 'result', result: r.result, usage: r.usage });

    } else {
      return res.status(400).json({ error: 'Parámetros inválidos.' });
    }
  } catch (e) {
    console.error('[CLASIFICAR]', e.message);
    return res.status(500).json({ error: e.message || 'Error interno del servidor.' });
  }
};
