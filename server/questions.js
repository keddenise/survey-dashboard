const WAVES = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4'];
const [Q1, Q2, Q3, Q4] = WAVES;
const ALL = WAVES;

const opt = (option_id, label, waves = ALL, extra = {}) => ({
  option_id,
  label,
  waves,
  ...extra,
});

const AI_SCALE = [
  opt('ai_driven', 'AI-driven (no human)'),
  opt('collab', 'Collaboration'),
  opt('ai_as_tool', 'Human-driven (AI as tool)'),
  opt('optional', 'Optional / sometimes'),
  opt('rare', 'Rare'),
  opt('never', 'Never / forbidden'),
  opt('no_activity', 'No such activity'),
];

const questions = [
  {
    question_id: 'q_experience',
    section: 'Demographics',
    type: 'single',
    ordered: true,
    text: 'How much experience designing software architecture do you have?',
    options: [
      opt('lt1', 'less than a year'),
      opt('1_3', '1-3 years'),
      opt('3_7', '3-7 years'),
      opt('7_12', '7-12 years'),
      opt('12_20', '12-20 years'),
      opt('20_50', '20-50 years'),
    ],
    parent_question_id: null,
    waves: ALL,
  },
  {
    question_id: 'q_company_size',
    section: 'Company',
    type: 'single',
    ordered: true,
    text: 'How large is your company?',
    options: [
      opt('lt10', 'below 10 people'),
      opt('10_20', '10 - 20 people'),
      opt('21_50', '21 - 50 people'),
      opt('51_200', '51 - 200 people'),
      opt('201_500', '201 - 500 people'),
      opt('gt500', 'above 500 people'),
    ],
    parent_question_id: null,
    waves: ALL,
  },
  {
    question_id: 'q_arch',
    section: 'Architecture',
    type: 'single',
    ordered: false,
    text: 'What is the primary architecture of your project?',
    options: [
      opt('monolith', 'Monolith'),
      opt('layers', 'Layers / Tiers'),
      // Scenario 1: renamed. Same option_id, different label per quarter
      opt('services', 'Microservices', ALL, {
        labels_by_wave: { [Q1]: 'Services', [Q2]: 'Services' },
      }),
      // Scenario 3: removed after Q2
      opt('actors', 'Actors', [Q1, Q2]),
      // Scenario 2: added in Q3
      opt('serverless', 'Serverless', [Q3, Q4]),
    ],
    parent_question_id: null,
    waves: ALL,
  },
  {
    question_id: 'q_arch_why',
    section: 'Architecture',
    type: 'up_to_3',
    ordered: false,
    text: 'Why do you use <the architecture chosen above>?',
    options: [
      opt('simple', 'It is simple'),
      opt('team_knows', 'Our team knows it'),
      opt('easy_to_hire', 'Easy to find people'),
      opt('performance', 'Performance'),
      opt('scalability', 'Scalability'),
      opt('management', 'Easy to manage'),
    ],
    parent_question_id: 'q_arch',
    waves: ALL,
  },
  {
    question_id: 'q_team_size',
    section: 'Project',
    type: 'number',
    ordered: false,
    text: 'What is the average team size on your project?',
    options: [],
    parent_question_id: null,
    waves: ALL,
  },
  {
    question_id: 'q_ai_coding',
    section: 'AI',
    type: 'single',
    ordered: true,
    text: 'Do you use AI for coding?',
    options: AI_SCALE,
    parent_question_id: null,
    waves: ALL,
  },
  {
    question_id: 'q_ai_testing',
    section: 'AI',
    type: 'single',
    ordered: true,
    text: 'Do you use AI for testing?',
    options: AI_SCALE,
    parent_question_id: null,
    waves: [Q1, Q2],
  },
  {
    // Scenario 4: the meaning changed, so it gets a NEW question_id
    question_id: 'q_ai_test_generation',
    section: 'AI',
    type: 'single',
    ordered: true,
    text: 'Do you use AI to generate tests?',
    options: AI_SCALE,
    parent_question_id: null,
    waves: [Q3, Q4],
  },
  {
    question_id: 'q_other',
    section: 'Architecture',
    type: 'text',
    ordered: false,
    text: 'Other approaches you use (please specify)',
    options: [],
    parent_question_id: null,
    waves: ALL,
  },
];

module.exports = { questions, WAVES };