const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('survey');

app.get('/questions', async (req, res) => {
  const questions = await db.collection('questions').find({}).toArray();
  res.json(questions);
});

// No ?wave= means "overall" (all waves together)
app.get('/results/:question_id', async (req, res) => {
  const { question_id } = req.params;
  const { wave } = req.query;

  const question = await db.collection('questions').findOne({ question_id });
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }
  if (wave && !question.waves.includes(wave)) {
    return res.json({ question_id, wave, n: 0, options: [] });
  }

  const match = { 'answers.question_id': question_id };
  if (wave) match.wave = wave;

  // How many respondents answered this question, per wave
  const nRows = await db.collection('responses').aggregate([
    { $match: match },
    { $group: { _id: '$wave', n: { $sum: 1 } } },
  ]).toArray();
  const nByWave = {};
  nRows.forEach((r) => {
    nByWave[r._id] = r.n;
  });
  const n = nRows.reduce((sum, r) => sum + r.n, 0);

  // How many times each option was picked, per wave
  const countRows = await db.collection('responses').aggregate([
    { $match: match },
    { $unwind: '$answers' },
    { $match: { 'answers.question_id': question_id } },
    { $unwind: '$answers.values' },
    { $group: { _id: { wave: '$wave', value: '$answers.values' }, count: { $sum: 1 } } },
  ]).toArray();
  const countByOption = {}; // option_id -> { wave: count }
  countRows.forEach((r) => {
    const value = r._id.value;
    countByOption[value] = countByOption[value] || {};
    countByOption[value][r._id.wave] = r.count;
  });

  const wavesInView = wave ? [wave] : question.waves;

  const options = question.options
    .filter((o) => wavesInView.some((w) => o.waves.includes(w)))
    .map((o) => {
      // Only count the waves where this option was actually offered
      const shownIn = wavesInView.filter((w) => o.waves.includes(w));
      const perWave = countByOption[o.option_id] || {};
      const count = shownIn.reduce((sum, w) => sum + (perWave[w] || 0), 0);
      const base = shownIn.reduce((sum, w) => sum + (nByWave[w] || 0), 0);
      const label = (wave && o.labels_by_wave && o.labels_by_wave[wave]) || o.label;
      return {
        option_id: o.option_id,
        label,
        count,
        base,
        percent: base ? Math.round((count / base) * 1000) / 10 : 0,
        partial: shownIn.length < wavesInView.length,
      };
    });

  res.json({ question_id, wave: wave || null, n, options });
});

async function start() {
  await client.connect();
  app.listen(3000, () => console.log('Server running on http://localhost:3000'));
}

start();