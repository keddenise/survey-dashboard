const { MongoClient } = require('mongodb');
const { questions, WAVES } = require('./questions');

// Participation grows every quarter
const RESPONDENTS = { '2025-Q1': 420, '2025-Q2': 480, '2025-Q3': 530, '2025-Q4': 590 };

// Pick one key from { key: weight }
function pick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// Pick up to n different keys
function pickMany(weights, n) {
  const remaining = { ...weights };
  const chosen = [];
  for (let i = 0; i < n && Object.keys(remaining).length > 0; i++) {
    const key = pick(remaining);
    chosen.push(key);
    delete remaining[key];
  }
  return chosen;
}

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Blend two sets of weights: t = 0 gives a, t = 1 gives b
function lerpWeights(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

const EXPERIENCE = { lt1: 5, '1_3': 15, '3_7': 25, '7_12': 25, '12_20': 20, '20_50': 10 };
// gt500 is rare on purpose, so some cells end up with a tiny n
const COMPANY_SIZE = { lt10: 20, '10_20': 20, '21_50': 20, '51_200': 20, '201_500': 12, gt500: 4 };

const TEAM_RANGE = {
  lt10: [2, 6], '10_20': [3, 9], '21_50': [4, 12],
  '51_200': [5, 15], '201_500': [6, 20], gt500: [6, 30],
};

function archWeights(size, waveIdx) {
  let base;
  if (size === '201_500' || size === 'gt500') {
    base = { monolith: 10, layers: 25, services: 50, actors: 5 };
  } else if (size === '51_200') {
    base = { monolith: 25, layers: 30, services: 35, actors: 5 };
  } else {
    base = { monolith: 50, layers: 30, services: 15, actors: 5 };
  }
  if (waveIdx < 2) return base; // Q1, Q2 still offered "actors"
  const { actors, ...rest } = base; // removed from Q3
  return { ...rest, serverless: 8 }; // "serverless" added in Q3
}

const WHY_BY_ARCH = {
  monolith:   { simple: 40, team_knows: 25, easy_to_hire: 15, management: 15, performance: 5, scalability: 5 },
  layers:     { team_knows: 30, simple: 20, management: 20, easy_to_hire: 15, performance: 10, scalability: 5 },
  services:   { scalability: 40, team_knows: 10, performance: 15, management: 10, easy_to_hire: 10, simple: 5 },
  actors:     { performance: 40, scalability: 30, team_knows: 10, simple: 5, management: 5, easy_to_hire: 5 },
  serverless: { scalability: 35, management: 25, simple: 20, performance: 10, team_knows: 5, easy_to_hire: 5 },
};

// AI adoption grows over the year
const AI_CODING_START = { ai_driven: 3, collab: 12, ai_as_tool: 20, optional: 25, rare: 20, never: 15, no_activity: 5 };
const AI_CODING_END = { ai_driven: 8, collab: 26, ai_as_tool: 26, optional: 20, rare: 10, never: 6, no_activity: 4 };
const AI_TESTING_START = { ai_driven: 2, collab: 6, ai_as_tool: 12, optional: 20, rare: 30, never: 25, no_activity: 5 };
const AI_TESTING_END = { ai_driven: 3, collab: 8, ai_as_tool: 14, optional: 22, rare: 28, never: 20, no_activity: 5 };
const AI_TESTGEN_START = { ai_driven: 4, collab: 14, ai_as_tool: 20, optional: 26, rare: 20, never: 12, no_activity: 4 };
const AI_TESTGEN_END = { ai_driven: 7, collab: 20, ai_as_tool: 24, optional: 24, rare: 14, never: 8, no_activity: 3 };

const OTHER_TEXT = [
  'Hexagonal architecture',
  'Modular monolith',
  'Event sourcing',
  'CQRS',
  'Mostly legacy code',
];

function makeRespondent(wave, waveIdx, i) {
  const t = waveIdx / (WAVES.length - 1);
  const size = pick(COMPANY_SIZE);
  const arch = pick(archWeights(size, waveIdx));
  const [minTeam, maxTeam] = TEAM_RANGE[size];

  const answers = [
    { question_id: 'q_experience', values: [pick(EXPERIENCE)], asked_option: null },
    { question_id: 'q_company_size', values: [size], asked_option: null },
    { question_id: 'q_arch', values: [arch], asked_option: null },
    {
      question_id: 'q_arch_why',
      values: pickMany(WHY_BY_ARCH[arch], randInt(1, 3)),
      asked_option: arch, // which option this follow-up was about
    },
    { question_id: 'q_team_size', values: [randInt(minTeam, maxTeam)], asked_option: null },
    {
      question_id: 'q_ai_coding',
      values: [pick(lerpWeights(AI_CODING_START, AI_CODING_END, t))],
      asked_option: null,
    },
  ];

  if (waveIdx < 2) {
    answers.push({
      question_id: 'q_ai_testing',
      values: [pick(lerpWeights(AI_TESTING_START, AI_TESTING_END, waveIdx))],
      asked_option: null,
    });
  } else {
    answers.push({
      question_id: 'q_ai_test_generation',
      values: [pick(lerpWeights(AI_TESTGEN_START, AI_TESTGEN_END, waveIdx - 2))],
      asked_option: null,
    });
  }

  if (Math.random() < 0.3) {
    const text = OTHER_TEXT[randInt(0, OTHER_TEXT.length - 1)];
    answers.push({ question_id: 'q_other', values: [text], asked_option: null });
  }

  return { respondent_id: `${wave}-${i}`, wave, answers };
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('survey');

  // Safe to re-run: clears old data first
  await db.collection('questions').deleteMany({});
  await db.collection('responses').deleteMany({});

  await db.collection('questions').insertMany(questions);

  const responses = [];
  WAVES.forEach((wave, waveIdx) => {
    for (let i = 1; i <= RESPONDENTS[wave]; i++) {
      responses.push(makeRespondent(wave, waveIdx, i));
    }
  });
  await db.collection('responses').insertMany(responses);

  console.log(`Seeded ${questions.length} questions and ${responses.length} responses.`);
  await client.close();
}

main().catch((err) => console.error('Seed failed:', err.message));