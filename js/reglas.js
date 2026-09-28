/* ══════════════════════════════════════════════════════════════
   Reglas de Armisticio — Manual Oficial v1.0.
   Solo datos: tablas del manual tal cual, sin lógica. El cálculo vive
   en motor.js. Si el manual cambia, casi todo se toca aquí.
══════════════════════════════════════════════════════════════ */
'use strict';

const ATRIBUTOS = ['FUE', 'DES', 'VIT', 'MEN'];
const NOMBRE_ATR = { FUE: 'Fuerza', DES: 'Destreza', VIT: 'Vitalidad', MEN: 'Mente' };
const DESC_ATR = {
  FUE: 'Atacar cuerpo a cuerpo, trepar, romper cosas, resistir un empujón, minería',
  DES: 'Disparar, defenderse, esconderse, abrir cerraduras, esquivar trampas, actuar antes',
  VIT: 'Resistir venenos, enfermedades, frío y cansancio',
  MEN: 'Lanzar hechizos, resistir la magia y el miedo, orientarse, rastrear, convencer',
};

/* Cap. 3 · Modificadores. Ojo: no hay +0; 9–11 da −1. */
const TABLA_MOD = [[3, 5, -3], [6, 8, -2], [9, 11, -1], [12, 14, 1], [15, 17, 2], [18, 18, 3]];
const ATR_MAX = 18;

/* Cap. 3 · Escala de dificultad */
const CDS = [
  [8, 'Muy fácil'], [10, 'Fácil'], [12, 'Moderada'], [14, 'Difícil'], [16, 'Muy difícil'],
  [18, 'Extrema'], [20, 'Heroica'], [22, 'Legendaria'], [25, 'Mítica'],
];

/* Cap. 3 · Bono de Competencia por nivel (índice = nivel) */
const COMPETENCIA = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4];
/* Cap. 5 · Rango personal por nivel: I (1–2) … V (9–10) */
const RANGO_PERSONAL = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
const ROMANO = ['—', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const RANGO_MAX = 8;

/* Cap. 3 · Escalera de dados */
const ESCALERA = ['d4', 'd6', 'd8', 'd10', 'd12', '2d8', '2d10', '2d12', '3d10', '3d12'];

/* Cap. 3 · Distancias */
const DISTANCIAS = [
  ['Cerca', 'Lo bastante cerca para golpear con una espada'],
  ['Próximo', 'A unos pasos; se llega moviéndose una vez'],
  ['Lejos', 'A tiro de arco'],
  ['Lejano', 'Fuera del combate'],
];

/* Cap. 4 · Razas */
const RAZAS = {
  humano:     { nombre: 'Humano', atr: null, rasgo: 'Una vez por sesión, puedes repetir una tirada.', como: 'Adaptables y tercos; están en todas partes.' },
  enano:      { nombre: 'Enano', atr: 'VIT', rasgo: 'Ventaja contra venenos y al orientarte bajo tierra.', como: 'Mineros y herreros, duros como la roca.' },
  elfo:       { nombre: 'Elfo', atr: 'DES', rasgo: 'Ves en la oscuridad; ventaja al esconderte en un bosque.', como: 'Silenciosos y antiguos, cazadores del bosque.' },
  orco:       { nombre: 'Orco', atr: 'FUE', rasgo: 'Una vez por combate, al recibir daño, tu recurso de clase sube un escalón extra.', como: 'Guerreros orgullosos que se crecen con el dolor.' },
  resucitado: { nombre: 'Resucitado', atr: 'MEN', rasgo: 'No sientes miedo; no necesitas respirar.', como: 'Muertos que volvieron sin saber por qué.' },
};

/* Cap. 4 · Clases. dado = índice en ESCALERA; vida = dado de vida por nivel.
   recurso.inicio: índice de escalón al empezar (−1 = vacío). */
const CLASES = {
  guerrero: {
    nombre: 'Guerrero', principal: 'FUE', pv: 10, vida: 'd10', dado: 2,
    armadura: ['ligera', 'media', 'pesada'], escudo: true, escudos: ['estandar', 'torre'],
    recurso: { nombre: 'Furia', sube: true, inicio: 0, min: 0, max: 4,
      regla: 'Empieza cada combate en d4 y sube un escalón cada vez que recibes daño (hasta d12). Gastar Furia la baja un escalón; en d4 no se puede gastar.' },
    resumen: 'En primera línea: aguanta golpes y los devuelve. Sencillo y directo.',
    habilidades: [
      ['Aguante', 'Tu Guardia usa tu modificador de Vitalidad en lugar del de Destreza.'],
      ['Furia', 'Empieza cada combate en d4 y sube un escalón cada vez que recibes daño (hasta d12).'],
      ['Golpe Brutal', 'Cuando tu ataque hace daño, suma tu dado de Furia; después la Furia baja un escalón.'],
    ],
  },
  picaro: {
    nombre: 'Pícaro', principal: 'DES', pv: 8, vida: 'd6', dado: 1,
    armadura: ['ligera'], escudo: false, escudos: [],
    recurso: { nombre: 'Combo', sube: true, inicio: -1, min: -1, max: 4,
      regla: 'Cada ataque tuyo que hace daño lo sube un escalón. Empieza vacío: el primero te da d4. Gastar el Combo lo vacía.' },
    resumen: 'Ágil y sigiloso: golpea donde duele o dispara desde lejos.',
    habilidades: [
      ['Combo', 'Cada ataque tuyo que hace daño lo sube un escalón. Empieza vacío: el primero te da d4.'],
      ['Eviscerar', 'Suma tu dado de Combo al daño y lo vacía.'],
      ['Emboscada', 'Si atacas sin que te hayan visto, haces el daño máximo del dado, sin tirarlo.'],
    ],
  },
  mago: {
    nombre: 'Mago', principal: 'MEN', pv: 6, vida: 'd4', dado: 1,
    armadura: [], escudo: false, escudos: [],
    recurso: { nombre: 'Maná', sube: false, inicio: 2, min: -1, max: 4,
      regla: 'Empieza en d8. Al usar un poder que cuesta Maná, tira el dado: con 1 o 2 baja un escalón; en d4, se agota hasta que descanses. Se recupera con una noche de descanso. Sube a d10 en el nivel 5 y a d12 en el 9.' },
    resumen: 'Hechizos devastadores, pero frágil. Pensar antes de actuar.',
    habilidades: [
      ['Descarga', 'Ataque mágico a distancia (Lejos): tirada de combate mágica contra la Guardia del objetivo. No gasta Maná.'],
      ['Nova de Escarcha', 'Cuesta Maná. Todos los enemigos Cerca: una tirada de combate mágica contra la Guardia más alta. Si la supera, todos reciben tu daño y quedan congelados un turno; si no, la mitad. No se puede bloquear.'],
    ],
  },
  clerigo: {
    nombre: 'Clérigo', principal: 'MEN', pv: 8, vida: 'd8', dado: 1,
    armadura: ['ligera', 'media'], escudo: true, escudos: ['estandar'],
    recurso: { nombre: 'Fe', sube: false, inicio: 2, min: -1, max: 4,
      regla: 'Empieza en d8. Al usar un poder que cuesta Fe, tira el dado: con 1 o 2 baja un escalón; en d4, se agota hasta que descanses. Se recupera con una noche de descanso. Sube a d10 en el nivel 5 y a d12 en el 9.' },
    resumen: 'Cura a sus compañeros y castiga a los muertos.',
    habilidades: [
      ['Sanar', 'Cuesta Fe. Un aliado Próximo recupera tu dado de clase en PV, más los escalones de tu símbolo sagrado.'],
      ['Luz Sagrada', 'Ataque con tu Combate mágico contra la Guardia del objetivo; ventaja contra muertos vivientes y demonios.'],
    ],
  },
};

/* Cap. 4 · Estilos: habilidades que se eligen en los niveles 3, 5, 7 y 9 */
const NIVELES_HABILIDAD = [3, 5, 7, 9];
const ESTILOS = {
  guerrero: [
    { estilo: 'Devastador', nota: 'arma a dos manos', hab: [
      ['torbellino', 'Torbellino', 'Gasta Furia; atacas a todos los enemigos que tengas Cerca.'],
      ['ejecutar', 'Ejecutar', 'Contra un enemigo con la mitad de sus PV o menos, haces daño máximo.'],
      ['sed_sangre', 'Sed de sangre', 'Con arma a dos manos, cada enemigo que abates sube tu Furia un escalón.'],
    ] },
    { estilo: 'Baluarte', nota: 'arma y escudo', hab: [
      ['muro_escudos', 'Muro de escudos', 'Un aliado Cerca suma tu Armadura a la suya este turno (sin pasar de su máximo).'],
      ['provocacion', 'Provocación', 'Gasta Furia; hasta tu próximo turno, los enemigos Cerca solo pueden atacarte a ti.'],
      ['represalia', 'Represalia', 'Cuando bloqueas un ataque con escudo, el atacante recibe tu dado de Furia en daño.'],
    ] },
    { estilo: 'Comunes', hab: [
      ['carga', 'Carga', 'Te mueves hasta Próximo y atacas con ventaja.'],
      ['grito', 'Grito de guerra', 'Gasta Furia; los aliados Próximos tienen ventaja en su siguiente tirada.'],
    ] },
  ],
  picaro: [
    { estilo: 'Sombra', nota: 'cuerpo a cuerpo y sigilo', hab: [
      ['paso_sombrio', 'Paso sombrío', 'Apareces junto a un enemigo Próximo.'],
      ['veneno', 'Veneno', 'Gasta una dosis de veneno; tus próximos 3 golpes suman d4.'],
      ['golpe_bajo', 'Golpe bajo', 'Gasta el Combo; el enemigo pierde su siguiente ataque.'],
    ] },
    { estilo: 'Tirador', nota: 'a distancia', hab: [
      ['lluvia', 'Lluvia de flechas', 'Disparas a 3 objetivos a la vez; gasta 3 flechas.'],
      ['certero', 'Disparo certero', 'Tu siguiente disparo ignora la Armadura del objetivo.'],
      ['retirada', 'Retirada', 'Después de disparar, te mueves hasta Próximo sin que puedan atacarte.'],
    ] },
    { estilo: 'Comunes', hab: [
      ['evasion', 'Evasión', 'En las salvaciones de Destreza, si tienes éxito no recibes nada y si fallas recibes la mitad.'],
      ['ojo_ladron', 'Ojo de ladrón', 'Ventaja con cerraduras y trampas; siempre notas los cofres ocultos.'],
    ] },
  ],
  mago: [
    { estilo: 'Piromante', nota: 'destrucción', hab: [
      ['bola_fuego', 'Bola de Fuego', 'Cuesta Maná; como la Nova, pero Lejos y en una zona.'],
      ['combustion', 'Combustión', 'Cuesta Maná; tu siguiente hechizo hace daño máximo.'],
      ['muro_llamas', 'Muro de llamas', 'Cuesta Maná; una línea de fuego Próxima quema con tu dado de clase a quien la cruce, durante 3 turnos.'],
    ] },
    { estilo: 'Arcanista', nota: 'control', hab: [
      ['polimorfia', 'Polimorfia', 'Cuesta Maná; un enemigo con DG iguales o menores que tu nivel (o un personaje de nivel igual o menor) se convierte en oveja durante 3 turnos.'],
      ['parpadeo', 'Parpadeo', 'Te teletransportas hasta Próximo.'],
      ['contrahechizo', 'Contrahechizo', 'Cuesta Maná; un monstruo pierde su poder especial hasta el final del turno.'],
    ] },
    { estilo: 'Comunes', hab: [
      ['escudo_mana', 'Escudo de Maná', 'Al recibir daño, tira tu dado de Maná y réstalo del daño.'],
      ['elemental', 'Elemental', 'Cuesta Maná; invocas un aliado con DG iguales a la mitad de tu nivel, hasta el final del combate.'],
    ] },
  ],
  clerigo: [
    { estilo: 'Misericordia', nota: 'curación', hab: [
      ['consagrar', 'Consagrar', 'Cuesta Fe; los aliados de la zona recuperan 1 PV por turno durante 3 turnos.'],
      ['escudo_luz', 'Escudo de Luz', 'Cuesta Fe; un aliado queda protegido y absorbe tu dado de Fe en daño.'],
      ['intercesion', 'Intercesión', 'Una vez por sesión, un aliado caído repite su tirada de Fuera de Combate.'],
    ] },
    { estilo: 'Juicio', nota: 'combate', hab: [
      ['martillo', 'Martillo sagrado', 'Cuando tu ataque cuerpo a cuerpo hace daño, gasta Fe y suma su dado al daño.'],
      ['expulsar', 'Expulsar', 'Los muertos vivientes con DG iguales o menores que tu nivel huyen.'],
      ['marca', 'Marca del juicio', 'Cuesta Fe; tus aliados atacan con ventaja al enemigo marcado hasta que caiga.'],
    ] },
    { estilo: 'Comunes', hab: [
      ['bendicion', 'Bendición', 'Cuesta Fe; tus aliados tienen +1 Armadura durante el combate (sin pasar de su máximo).'],
      ['vigilia', 'Plegaria de vigilia', 'Tras una noche de descanso contigo, tus aliados recuperan todos sus PV.'],
    ] },
  ],
};

/* Cap. 4 / 7 · Profesiones */
const PROFESIONES = {
  herrero:    { nombre: 'Herrero', recolecta: 'Minería', atrR: 'FUE', donde: 'Colinas, montañas, minas', fabrica: 'Armas, armaduras y escudos; abre engastes', atrF: 'FUE', material: 'mineral' },
  alquimista: { nombre: 'Alquimista', recolecta: 'Herboristería', atrR: 'MEN', donde: 'Bosques, pantanos', fabrica: 'Pociones', atrF: 'MEN', material: 'hierba' },
  peletero:   { nombre: 'Peletero', recolecta: 'Desuello', atrR: 'DES', donde: 'Al vencer a bestias', fabrica: 'Armadura ligera y bolsas', atrF: 'DES', material: 'piel' },
  joyero:     { nombre: 'Joyero', recolecta: 'Prospección', atrR: 'MEN', donde: 'Ríos, vetas, estanques', fabrica: 'Gemas, anillos y amuletos', atrF: 'DES', material: 'piedra en bruto' },
  encantador: { nombre: 'Encantador', recolecta: 'Esencias', atrR: 'MEN', donde: 'Ruinas, menhires, lugares mágicos', fabrica: 'Encantamientos', atrF: 'MEN', material: 'esencia' },
};
/* CD de fabricar según el Rango de lo que se fabrica */
const CD_FABRICAR = [0, 12, 12, 14, 14, 16, 16, 18, 18];

/* Cap. 5 · Armaduras y escudos */
const ARMADURAS = [
  { id: 'ninguna', nombre: 'Sin armadura', tipo: null, valor: 0 },
  { id: 'cuero', nombre: 'Cuero tachonado', tipo: 'ligera', valor: 1 },
  { id: 'escamas', nombre: 'Cota de escamas', tipo: 'media', valor: 2 },
  { id: 'malla', nombre: 'Cota de malla', tipo: 'media', valor: 3 },
  { id: 'coraza', nombre: 'Coraza completa', tipo: 'pesada', valor: 4 },
  { id: 'placas', nombre: 'Armadura de placas', tipo: 'pesada', valor: 5 },
];
const ESCUDOS = [
  { id: 'estandar', nombre: 'Escudo estándar', guardia: 1, bloqueo: 2 },
  { id: 'torre', nombre: 'Escudo de torre', guardia: 2, bloqueo: 2 },
];
/* Tipos de arma (el manual no los detalla: el daño es el dado de clase) */
const TIPOS_ARMA = {
  cac:   'Cuerpo a cuerpo',
  dos:   'Cuerpo a cuerpo, a dos manos',
  dist:  'A distancia',
  foco:  'Foco (varita, bastón o símbolo sagrado)',
};

/* Cap. 5 · Fuera de Combate (d6) */
const FUERA_COMBATE = [
  null,
  ['Muerto', 'Tu personaje ha caído para siempre.'],
  ['Herida grave', 'Pierdes 1 punto de un atributo para siempre.'],
  ['Maltrecho', 'Desventaja en las tiradas de un atributo hasta que descanses en la ciudad.'],
  ['Inconsciente', 'Inconsciente hasta el final del día.'],
  ['Aturdido', 'Te levantas con 1 PV.'],
  ['Solo un rasguño', 'Te levantas con d4 PV.'],
];

/* Cap. 5 · Descansos */
const DESCANSOS = [
  { id: 'corto', nombre: 'Corto', dur: 'Una hora', coste: 'Nada', txt: 'Una tirada de tu dado de vida de clase en PV.' },
  { id: 'largo', nombre: 'Largo', dur: 'Una noche', coste: 'Una ración', txt: 'La mitad de tus PV, más todo tu Maná o Fe.' },
  { id: 'ciudad', nombre: 'Ciudad', dur: 'En la ciudad', coste: 'Nada', txt: 'Todo.' },
];

/* Cap. 6 · Equipo puesto: 6 ranuras */
const RANURAS = [
  { id: 'arma', nombre: 'Arma', tipo: 'arma' },
  { id: 'armadura', nombre: 'Armadura', tipo: 'armadura' },
  { id: 'escudo', nombre: 'Escudo o secundaria', tipo: 'escudo' },
  { id: 'amuleto', nombre: 'Amuleto', tipo: 'joya' },
  { id: 'anillo1', nombre: 'Anillo', tipo: 'joya' },
  { id: 'anillo2', nombre: 'Anillo', tipo: 'joya' },
];

/* Cap. 6 · Rareza */
const RAREZAS = {
  comun:      { nombre: 'Común', color: 'blanco', props: 0 },
  magico:     { nombre: 'Mágico', color: 'azul', props: 1 },
  raro:       { nombre: 'Raro', color: 'amarillo', props: 2 },
  legendario: { nombre: 'Legendario', color: 'naranja', props: 2, unico: true },
  conjunto:   { nombre: 'De conjunto', color: 'verde', props: 2 },
};

/* Cap. 6 · Propiedades (d12). La 1 depende de la ranura. */
const PROPIEDADES = [
  null,
  { id: 'mejora', nombre: 'Mejora', txt: 'Arma o foco: +1 escalón de daño · Armadura: +1 Armadura · Escudo: +1 Guardia · Anillo o amuleto: +1 a un atributo' },
  { id: 'atributo', nombre: '+1 a un atributo', txt: '+1 a un atributo (máximo 18).', elige: 'atr' },
  { id: 'pv', nombre: '+2 PV máximos', txt: '+2 PV máximos.' },
  { id: 'resistencia', nombre: 'Resistencia', txt: 'Ventaja en las salvaciones contra fuego, frío, veneno o mente.', elige: 'res' },
  { id: 'robo', nombre: 'Robo de vida', txt: 'Recuperas 1 PV cada vez que tu ataque hace daño.' },
  { id: 'critico', nombre: 'Crítico ampliado', txt: 'Sacas crítico con 19 o 20 natural.' },
  { id: 'engaste', nombre: 'Engaste', txt: 'Tiene un hueco para poner una gema.' },
  { id: 'recurso', nombre: 'Recurso ampliado', txt: 'Tu recurso de clase empieza un escalón más alto.' },
  { id: 'hallazgo', nombre: 'Hallazgo', txt: '+1 a tus tiradas de rareza.' },
  { id: 'espinas', nombre: 'Espinas', txt: 'Quien te hace daño desde Cerca recibe 1 de daño.' },
  { id: 'agil', nombre: 'Ágil', txt: 'Ventaja al tirar quién actúa primero.' },
];
const RESISTENCIAS = { fuego: 'Fuego', frio: 'Frío', veneno: 'Veneno', mente: 'Mente' };

/* Cap. 6 · Gemas: efecto según dónde se engasten */
const GEMAS = {
  rubi:     { nombre: 'Rubí', arma: '+1 escalón de daño', armadura: '+2 PV máximos', joya: '+1 Fuerza' },
  zafiro:   { nombre: 'Zafiro', arma: 'Con un crítico, congelas al enemigo un turno', armadura: 'Armadura: +1 Armadura · Escudo: +1 Guardia', joya: 'Resistencia al frío' },
  calavera: { nombre: 'Calavera', arma: 'Recuperas 1 PV cada vez que tu ataque hace daño', armadura: 'Recuperas 1 PV al inicio de tu turno', joya: '+1 Vitalidad' },
  topacio:  { nombre: 'Topacio', arma: 'Tiras dos veces la rareza del botín de un jefe', armadura: '+1 a tus tiradas de hallazgo', joya: '+1 Mente' },
};

/* Cap. 6 · Consumibles y precios */
const CONSUMIBLES = {
  raciones: { nombre: 'Raciones', porRanura: 3, txt: 'Cada personaje come una al acampar.' },
  flechas:  { nombre: 'Flechas', porRanura: 20, txt: 'Una por disparo; tras el combate recuperas la mitad de las disparadas.' },
  pociones: { nombre: 'Pociones', porRanura: 2, txt: 'Una por uso. Curan según su Rango.' },
  /* El manual v1.0 no dice cuánto ocupan: la app no les cuenta ranuras */
  veneno:   { nombre: 'Dosis de veneno', porRanura: null, txt: 'Para la habilidad Veneno del pícaro; el alquimista las fabrica.' },
  portal:   { nombre: 'Pergaminos de Portal', porRanura: 1, txt: 'Abre una puerta mágica de vuelta a la ciudad.' },
};
/* Curación de pociones por Rango (cap. 6 y 10) */
const POCION_CURA = [null, 'd6', 'd8', 'd10', 'd12', '2d8', '2d10', '2d12', '3d10'];
/* Consumibles con dado de Uso: índice de escalón inicial al comprarlos */
const DADOS_USO = {
  antorchas: { nombre: 'Antorchas', nuevo: 1, txt: 'Tira al entrar en cada sala nueva de una mazmorra.' },
  aceite:    { nombre: 'Aceite de linterna', nuevo: 2, txt: 'Como las antorchas, pero te deja las manos libres.' },
};

/* Cap. 9 · Hitos: hacen falta 2 × nivel actual para subir */
const hitosParaSubir = nivel => 2 * nivel;

/* Personajes pregenerados (final del manual) */
const PREGENERADOS = [
  { nombre: 'Durn Martillo-Gris', raza: 'enano', clase: 'guerrero', profesion: 'herrero',
    base: { FUE: 14, DES: 9, VIT: 15, MEN: 10 }, motivo: 'Mi clan perdió su mina ante los muertos. Vengo a recuperarla.',
    arma: { nombre: 'Hacha común', sub: 'cac' }, armadura: 'malla', escudo: 'estandar',
    consumibles: { raciones: 5 }, antorchas: 1, oro: 80, materiales: [{ nombre: 'Hierro', rango: 1, cantidad: 2 }] },
  { nombre: 'Selen Vareda', raza: 'elfo', clase: 'picaro', profesion: 'peletero',
    base: { FUE: 8, DES: 15, VIT: 11, MEN: 12 }, motivo: 'Busco fortuna en la frontera.',
    arma: { nombre: 'Arco corto común', sub: 'dist' }, armadura: 'cuero', escudo: null,
    consumibles: { raciones: 5, flechas: 20 }, antorchas: null, oro: 110, materiales: [{ nombre: 'Piel', rango: 1, cantidad: 1 }] },
  { nombre: 'Vess de la Segunda Tumba', raza: 'resucitado', clase: 'mago', profesion: 'encantador',
    base: { FUE: 7, DES: 12, VIT: 9, MEN: 16 }, motivo: 'Volví de la tumba y quiero saber por qué.',
    arma: { nombre: 'Varita común', sub: 'foco' }, armadura: 'ninguna', escudo: null,
    consumibles: { raciones: 5 }, antorchas: 1, oro: 60, materiales: [{ nombre: 'Esencia', rango: 1, cantidad: 1 }] },
  { nombre: 'Ottmar Brand', raza: 'humano', atrHumano: 'MEN', clase: 'clerigo', profesion: 'alquimista',
    base: { FUE: 11, DES: 10, VIT: 13, MEN: 14 }, motivo: 'Mi fe me trajo a la frontera, donde los muertos no descansan.',
    arma: { nombre: 'Maza común', sub: 'cac' }, armadura: 'escamas', escudo: 'estandar',
    consumibles: { raciones: 5, pociones: 2 }, antorchas: null, oro: 90, materiales: [{ nombre: 'Hierba', rango: 1, cantidad: 2 }] },
];
