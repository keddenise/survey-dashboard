import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';

const API = 'http://localhost:3000';
const WAVES = ['2026-Q1', '2026-Q2'];
const CHARTABLE = ['single', 'multiple', 'up_to_3'];

const theme = {
  text: { fill: '#d1d5db' },
  axis: { ticks: { text: { fill: '#d1d5db' } } },
  grid: { line: { stroke: '#374151' } },
  tooltip: { container: { background: '#1f2937', color: '#f3f4f6' } },
};

function ResultChart({ question, wave }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/results/${question.question_id}?wave=${wave}`)
      .then((res) => res.json())
      .then((json) => setData(json));
  }, [question.question_id, wave]);

  if (!data) return <p>Loading...</p>;

  // Ordered questions keep their order (vertical bars).
  // Unordered questions are sorted and shown as horizontal bars.
  const horizontal = !question.ordered;
  const options = horizontal
    ? [...data.options].sort((a, b) => a.percent - b.percent)
    : data.options;

  return (
    <div>
      <h2>{question.text}</h2>
      <p>n = {data.n} respondents. Values are % of respondents.</p>
      <div style={{ height: 420 }}>
        <ResponsiveBar
          data={options}
          keys={['percent']}
          indexBy="label"
          layout={horizontal ? 'horizontal' : 'vertical'}
          theme={theme}
          margin={{ top: 20, right: 30, bottom: 60, left: horizontal ? 180 : 60 }}
          padding={0.3}
          labelTextColor="#111827"
          motionConfig="gentle"
        />
      </div>
    </div>
  );
}

function App() {
  const [questions, setQuestions] = useState([]);
  const [wave, setWave] = useState(WAVES[0]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch(`${API}/questions`)
      .then((res) => res.json())
      .then((json) => setQuestions(json));
  }, []);

  // Only questions that can be charted and were asked in the chosen wave
  const available = questions.filter(
    (q) => CHARTABLE.includes(q.type) && q.waves.includes(wave)
  );
  const question = available.find((q) => q.question_id === selectedId) || available[0];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select value={wave} onChange={(e) => setWave(e.target.value)}>
          {WAVES.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <select
          value={question ? question.question_id : ''}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {available.map((q) => (
            <option key={q.question_id} value={q.question_id}>{q.text}</option>
          ))}
        </select>
      </div>

      {question && (
        <ResultChart key={question.question_id + wave} question={question} wave={wave} />
      )}
    </div>
  );
}

export default App;