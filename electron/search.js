const crypto = require('crypto');

// ============================================================
// NORMALIZACIÓN
// ============================================================

const UNITS = /\b\d+[\.,]?\d*\s*(kg|g|gr|mg|mcg|ui|iu|ml|l|lt|oz|lb|lbs|unid|und|unidades?|paque|paq|docena|doc|lt|cc|mt|mtro|metros?|centimetros?|cm|mm|tab|tabletas?|caps?|capsulas?|comp|comprimidos?|amp|ampollas?|blister|sobres?|fco|frascos?|tubos?|potes?|gotero|gotas?|vial|jeringa|rollos?|pares?)\b/gi;
const STOP_WORDS = /\b(de|del|la|las|el|los|un|una|uns|por|con|para|al|y|o|a|en|no|si|es|su|al|ml|gr|kg|lt|oz|mg|mcg|ui)\b/g;

function normalizeQuery(raw) {
  let q = raw.toLowerCase();
  q = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  q = q.replace(/[^\w\s]/g, ' ');
  q = q.replace(UNITS, ' ');
  q = q.replace(STOP_WORDS, ' ');
  return q.replace(/\s+/g, ' ').trim();
}

function normalizeTitle(raw) {
  let t = raw.toLowerCase();
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(/[^\w\s]/g, ' ');
  t = t.replace(UNITS, ' ');
  t = t.replace(STOP_WORDS, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

// ============================================================
// SINÓNIMOS
// ============================================================

const SYNONYMS = {
  // Farmacia y Medicamentos
  paracetamol: ['acetaminofen', 'atamel', 'tachipirin', 'apiret', 'febrilix', 'febrip', 'anydol', 'anapir', 'ananty', 'tempra'],
  acetaminofen: ['paracetamol', 'atamel', 'tachipirin', 'apiret', 'febrilix', 'febrip', 'anydol', 'anapir', 'ananty'],
  atamel: ['acetaminofen', 'paracetamol', 'atamel forte', 'atamelco'],
  tachipirin: ['acetaminofen', 'paracetamol', 'tachiforte'],
  apiret: ['acetaminofen', 'paracetamol'],
  ibuprofeno: ['ibutan', 'brugesic', 'ibudual', 'motrin', 'advil'],
  diclofenac: ['aflamax', 'otaflan', 'diagesic', 'cataflam', 'voltaren'],
  aflamax: ['diclofenac'],
  simeticona: ['antifom', 'evigax', 'flatoril', 'mylicon'],
  loratadina: ['desloratadina', 'lorecort', 'claritin', 'claricort'],
  cetirizina: ['talzic', 'talerc', 'cetral', 'cetirivax', 'zyrtec'],
  omeprazol: ['esomeprazol', 'omebloc', 'ulgarin', 'losec', 'gastrazole'],
  losartan: ['nefrotal', 'cozaar', 'valsartan', 'candesartan'],
  enoxaparina: ['clexane'],
  sutura: ['catgut', 'vicryl', 'prolene', 'seda', 'nylon', 'monofyl', 'ethicon', 'demetech'],
  vicryl: ['sutura', 'ethicon', 'poliglactina'],
  prolene: ['sutura', 'ethicon', 'polipropileno'],
  catgut: ['sutura', 'cromico', 'simple'],
  
  // Proteínas
  sardina: ['atun', 'pescado', 'bonito'],
  atun: ['sardina', 'pescado', 'bonito'],
  pollo: ['ave', 'muslo', 'pechuga', 'muslos'],
  carne: ['res', 'vaca', 'ternera', 'molida'],
  huevo: ['huevos', 'claras', 'yemas'],

  // Lácteos
  leche: ['lactal', 'entera', 'deslactosada', 'semi'],
  queso: ['mussarela', 'muzzarella', 'gouda', 'blanco', 'rallado'],
  mantequilla: ['manteca', 'crema'],
  yogurt: ['yogur', 'gelado'],

  // Granos
  arroz: ['grano', 'pilado', 'integral', 'sushi'],
  frijol: ['caraotas', 'porotos', 'habichuelas', 'negro', 'caraota'],
  lenteja: ['legumbre', 'pardina'],
  pasta: ['espagueti', 'macarrones', 'fideos', 'tallarines', 'penne'],

  // Aceites
  aceite: ['vegetal', 'girasol', 'maiz', 'oliva', 'canola', 'olivo'],

  // Panadería
  harina: ['premezcla', 'trigo', 'pan', 'precocida'],
  pan: ['harina', 'molde', 'tajado', 'frances', 'sencillo'],

  // Bebidas
  agua: ['mineral', 'purificada', 'potable'],
  jugo: ['zumo', 'nectar', 'concentrado'],
  cerveza: ['lager', 'pilsen', 'pale', 'cervecera'],
  ron: ['añejo', 'carta', 'blanco'],
  whisky: ['whiskey', 'bourbon', 'escoces'],

  // Snacks
  papa: ['papita', 'chips', 'fritas', 'doritos'],
  galleta: ['galletitas', 'cookie', 'salada'],

  // Limpieza
  jabon: ['lavavajillas', 'detergente', 'limpiador'],
  detergente: ['jabon', 'lavavajillas', 'ajeno'],
  suavizante: ['suavizante', 'aromatizante'],

  // Higiene
  shampoo: ['champu', 'shampu', 'capilar'],
  dental: ['crema dental', 'pasta dental', 'enjuague'],
  papel: ['servilleta', 'higienico', 'toallas'],

  // Frutas y verduras
  tomate: ['jitomate', 'pomodoro'],
  cebolla: ['cebollas'],
  ajo: ['ajos'],
};

function expandSynonyms(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (token === key || syns.includes(token)) {
        expanded.add(key);
        syns.forEach(s => expanded.add(s));
      }
    }
  }
  return [...expanded];
}

// ============================================================
// LEVENSHTEIN DISTANCE
// ============================================================

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

// ============================================================
// TF-IDF SCORING
// ============================================================

const corpusFrequency = new Map();
let totalDocuments = 0;

function updateCorpus(titleTokens) {
  totalDocuments++;
  const seen = new Set();
  for (const token of titleTokens) {
    if (!seen.has(token)) {
      corpusFrequency.set(token, (corpusFrequency.get(token) || 0) + 1);
      seen.add(token);
    }
  }
}

function getIDF(word) {
  const freq = corpusFrequency.get(word) || 0;
  if (freq === 0) return 2.0;
  return Math.log((totalDocuments + 1) / (freq + 1)) + 1;
}

function getTFIDFScore(queryTokens, titleTokens) {
  if (queryTokens.length === 0 || titleTokens.length === 0) return 0;

  const titleSet = new Set(titleTokens);
  let score = 0;
  let matchCount = 0;

  for (const qToken of queryTokens) {
    const idf = getIDF(qToken);

    if (titleSet.has(qToken)) {
      score += idf * 1.0;
      matchCount++;
    } else {
      const maxDist = Math.max(1, Math.floor(qToken.length * 0.3));
      const bestFuzzy = titleTokens.some(t =>
        t.includes(qToken) ||
        qToken.includes(t) ||
        levenshtein(qToken, t) <= maxDist
      );
      if (bestFuzzy) {
        score += idf * 0.6;
        matchCount++;
      }
    }
  }

  const coverage = matchCount / queryTokens.length;
  score *= (0.5 + coverage * 0.5);

  const lengthPenalty = Math.max(0.7, 1 - (titleTokens.length - queryTokens.length) * 0.02);
  score *= lengthPenalty;

  return Math.round(score * 100) / 100;
}

// ============================================================
// CATEGORÍAS
// ============================================================

const CATEGORIES = {
  farmacia: ['tabletas', 'capsulas', 'jarabe', 'ampolla', 'gotas', 'crema', 'unguento', 'suspension', 'sobre', 'blister', 'mg', 'mcg', 'ovulos', 'medicamento', 'atamel', 'apiret', 'calox', 'acetaminofen', 'paracetamol', 'ibuprofeno', 'diclofenac', 'amoxicilina', 'losartan', 'omeprazol', 'enalapril', 'atorvastatina', 'cetirizina', 'loratadina', 'clexane', 'tachipirin', 'valpron', 'clonazepam', 'alprazolam'],
  quirurgico: ['sutura', 'vicryl', 'prolene', 'catgut', 'seda', 'nylon', 'cateter', 'aguja', 'biopsia', 'malla', 'polipropileno', 'venda', 'gasas'],
  equipos_medicos: ['tensiometro', 'nebulizador', 'glucometro', 'oximetro', 'estetoscopio', 'otoscopio', 'termometro', 'silla', 'ruedas', 'andadera', 'muletas', 'collarin', 'rodillera', 'tobillera', 'faja'],
  suplementos: ['vitamina', 'calcio', 'zinc', 'magnesio', 'colageno', 'biotina', 'melatonina', 'omega', 'acido', 'folico', 'hierro', 'potasio'],
  lacteos: ['leche', 'queso', 'mantequilla', 'yogurt', 'crema', 'nata', 'manteca'],
  granos: ['arroz', 'frijol', 'lenteja', 'chickpea', 'garbanzo', 'pasta', 'espagueti'],
  aceites: ['aceite', 'oliva', 'girasol', 'canola', 'maiz'],
  carnes: ['pollo', 'carne', 'res', 'cerdo', 'pescado', 'sardina', 'atun', 'huevo', 'jamon'],
  panaderia: ['harina', 'pan', 'galleta', 'tortilla', 'arepa', 'premezcla'],
  bebidas: ['agua', 'jugo', 'cerveza', 'refresco', 'soda', 'ron', 'whisky', 'vino'],
  limpieza: ['jabon', 'detergente', 'cloro', 'suavizante', 'papel', 'servilleta'],
  higiene: ['shampoo', 'crema', 'pastilla', 'cepillo', 'desodorante', 'dental'],
  snacks: ['papa', 'chips', 'galleta', 'caramelo', 'chocolate', 'papita'],
  conservas: ['atun', 'sardina', 'champiñones'],
};

function detectCategory(queryTokens) {
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (queryTokens.some(t => keywords.includes(t))) {
      return category;
    }
  }
  return null;
}

// ============================================================
// SCORE FINAL UNIFICADO
// ============================================================

function scoreResult(query, title) {
  const qNorm = normalizeQuery(query);
  const tNorm = normalizeTitle(title);

  const qTokens = expandSynonyms(qNorm.split(' ').filter(Boolean));
  const tTokens = tNorm.split(' ').filter(Boolean);

  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  updateCorpus(tTokens);

  const tfidfScore = getTFIDFScore(qTokens, tTokens);

  // Bonus por posición: si la query aparece al inicio del título
  const titleStart = tTokens.slice(0, qTokens.length).join(' ');
  const queryStr = qTokens.slice(0, tTokens.length).join(' ');
  const positionBonus = titleStart.includes(queryStr) ? 0.3 : 0;

  // Size-aware scoring (Fase 4)
  const sizeBonus = getSizeMatch(qTokens, tTokens);

  return Math.round((tfidfScore + positionBonus + sizeBonus) * 100) / 100;
}

// ============================================================
// CACHE KEY NORMALIZADO
// ============================================================

function getNormalizedCacheKey(query) {
  const normalized = normalizeQuery(query);
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// ============================================================
// VARIACIONES DE BÚSQUEDA (Fase 1)
// ============================================================

function generateQueryVariations(query) {
  const normalized = normalizeQuery(query);
  const tokens = normalized.split(' ').filter(Boolean);
  const variations = [];

  // Original
  variations.push({ query: query, label: 'original' });

  // Sin números/tamaños específicos
  const withoutNumbers = tokens.filter(t => !/^\d/.test(t) && !/kg|g|ml|l|lt|oz|lb|unid|paque|paq/i.test(t));
  if (withoutNumbers.length > 0 && withoutNumbers.length < tokens.length) {
    variations.push({ query: withoutNumbers.join(' '), label: 'sin números' });
  }

  // Sin complementos (solo primeras 2-3 palabras clave)
  const coreWords = tokens.slice(0, Math.min(3, tokens.length));
  if (coreWords.length > 1 && coreWords.join(' ') !== normalized) {
    variations.push({ query: coreWords.join(' '), label: 'solo marca' });
  }

  // Última palabra removida (ej: "Polar Light Lata" → "Polar Light")
  if (tokens.length > 2) {
    variations.push({ query: tokens.slice(0, -1).join(' '), label: 'sin último término' });
  }

  // Sin variaciones de tamaño: grande/pequeño/lata/retornable
  const sizeWords = ['grande', 'pequeno', 'pequeño', 'lata', 'retornable', 'mediano', 'mini', 'familiar'];
  const withoutSizes = tokens.filter(t => !sizeWords.includes(t));
  if (withoutSizes.length > 0 && withoutSizes.length < tokens.length) {
    variations.push({ query: withoutSizes.join(' '), label: 'sin tamaño' });
  }

  // Duplicar tokens relevantes (ej: "Polar Light" → "Polar Polar Light")
  // Solo para queries cortas
  if (tokens.length <= 2) {
    variations.push({ query: tokens.join(' ') + ' ' + tokens.join(' '), label: 'duplicado' });
  }

  return variations;
}

// ============================================================
// DETECCIÓN DE PRODUCTOS PROBLEMÁTICOS (Fase 3)
// ============================================================

const PROBLEMATIC_CATEGORIES = {
  licores: ['aguardiente', 'brandy', 'ron', 'whisky', 'vodka', 'tequila', 'pisco', 'coñac', 'coñak', 'licor', 'ginebra', 'sangria', 'sangría'],
  regionales: ['cocuy', 'tucacas', 'jhon master', 'country club', 'tercio'],
};

function detectProblematicCategory(queryTokens) {
  for (const [category, keywords] of Object.entries(PROBLEMATIC_CATEGORIES)) {
    if (queryTokens.some(t => keywords.some(k => t.includes(k) || k.includes(t)))) {
      return category;
    }
  }
  return null;
}

// ============================================================
// SIZE-AWARE SCORING (Fase 4)
// ============================================================

const SIZE_TOKENS = ['grande', 'pequeno', 'pequeño', 'lata', 'retornable', 'mediano', 'mini', 'familiar', 'individual', 'doble', 'triple', 'xxl', 'xl'];

function getSizeMatch(queryTokens, titleTokens) {
  const querySizes = queryTokens.filter(t => SIZE_TOKENS.some(s => t.includes(s) || s.includes(t)));
  const titleSizes = titleTokens.filter(t => SIZE_TOKENS.some(s => t.includes(s) || s.includes(t)));

  if (querySizes.length === 0) return 0; // No hay tamaño en query, neutral

  const matchedSizes = querySizes.filter(qs => titleSizes.some(ts => ts.includes(qs) || qs.includes(ts)));
  
  if (matchedSizes.length > 0) return 0.2;  // Bonus por coincidir tamaño
  if (titleSizes.length > 0) return -0.1;    // Malus por tener tamaño diferente
  return 0; // Neutral
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  normalizeQuery,
  normalizeTitle,
  expandSynonyms,
  levenshtein,
  scoreResult,
  detectCategory,
  detectProblematicCategory,
  generateQueryVariations,
  getSizeMatch,
  getNormalizedCacheKey,
  updateCorpus,
};
