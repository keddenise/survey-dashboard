import { useEffect, useMemo, useState } from 'react';
import BarChartD3 from './BarChartD3';
import LineChartD3 from './LineChartD3';

const API = 'http://localhost:3000';
const WAVES = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4'];
const VIEWS = ['all', ...WAVES];
const CATEGORIES = WAVES.map((w) => ({ key: w, label: w.slice(5) }));

// Questions that were asked in every quarter
const PANELS = ['q_arch', 'q_ai_coding', 'q_company_size', 'q_experience'];
const AI_REGULAR = ['ai_driven', 'collab', 'ai_as_tool'];
const AI_LOW = ['rare', 'never'];
const ARCH_COLORS = {
  monolith: '#6fd3c1',
  layers: '#8fa8ff',
  services: '#f0b37e',
  actors: '#c79bf2',
  serverless: '#ef8fa6',
};

const viewLabel = (v) => (v === 'all' ? 'Overall' : v.slice(5));
const queryFor = (wave) => (wave === 'all' ? '' : `?wave=${wave}`);
const getResults = (id, wave) =>
  fetch(`${API}/results/${id}${queryFor(wave)}`).then((res) => res.json());

// The AI testing question changed in Q3, so it is a different question per half-year
const testingQuestionFor = (wave) =>
  wave === 'all' ? null : wave <= '2025-Q2' ? 'q_ai_testing' : 'q_ai_test_generation';

const panelIdsFor = (wave) => {
  const extra = testingQuestionFor(wave);
  return extra ? [...PANELS, extra] : PANELS;
};

const round1 = (v) => Math.round(v * 10) / 10;
const sumPercent = (options, ids) =>
  round1(options.filter((o) => ids.includes(o.option_id)).reduce((s, o) => s + o.percent, 0));
const topOption = (options) => [...options].sort((a, b) => b.percent - a.percent)[0];

function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.name} className="legend-item">
          <span className="legend-dot" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

function BarPanel({ question, data, wide }) {
  // Ordered questions keep their order (vertical bars).
  // Unordered questions are sorted and shown as horizontal bars.
  const horizontal = !question.ordered;

  const options = useMemo(() => {
    const labeled = data.options.map((o) => ({
      ...o,
      label: o.partial ? `${o.label} *` : o.label,
    }));
    return horizontal ? [...labeled].sort((a, b) => a.percent - b.percent) : labeled;
  }, [data, horizontal]);

  const hasPartial = data.options.some((o) => o.partial);

  return (
    <div className={`card fade-in ${wide ? 'wide' : ''}`}>
      <div className="card-head">
        <h3 className="card-title">{question.text}</h3>
        <p className="muted">n = {data.n.toLocaleString()} respondents</p>
      </div>
      <BarChartD3 options={options} horizontal={horizontal} n={data.n} height={horizontal ? 300 : 330} />
      {hasPartial && (
        <p className="note">
          * Only offered in some quarters. The percent is based on respondents who saw that option.
        </p>
      )}
    </div>
  );
}

function App() {
  const [questions, setQuestions] = useState({});
  const [wave, setWave] = useState('all');
  const [results, setResults] = useState({});
  const [trend, setTrend] = useState(null);

  // Question metadata (text, ordered, type) comes from the database
  useEffect(() => {
    fetch(`${API}/questions`)
      .then((res) => res.json())
      .then((list) => {
        const byId = {};
        list.forEach((q) => {
          byId[q.question_id] = q;
        });
        setQuestions(byId);
      });
  }, []);

  // Results for every panel, whenever the selected view changes
  useEffect(() => {
    let cancelled = false;
    const ids = panelIdsFor(wave);
    Promise.all(ids.map((id) => getResults(id, wave))).then((list) => {
      if (cancelled) return;
      const next = {};
      ids.forEach((id, i) => {
        next[id] = list[i];
      });
      setResults(next);
    });
    return () => {
      cancelled = true;
    };
  }, [wave]);

  // Per-quarter results for the trend lines (fetched once)
  useEffect(() => {
    Promise.all(
      WAVES.map((w) => Promise.all([getResults('q_arch', w), getResults('q_ai_coding', w)]))
    ).then((rows) => {
      setTrend(rows.map(([arch, ai], i) => ({ wave: WAVES[i], arch, ai })));
    });
  }, []);

  // One line per architecture option. A missing option becomes null, so the line has a gap.
  const archSeries = useMemo(() => {
    if (!trend) return [];
    return Object.keys(ARCH_COLORS).map((id) => {
      const found = trend.map((t) => t.arch.options.find((o) => o.option_id === id));
      const latest = [...found].reverse().find(Boolean);
      return {
        name: latest ? latest.label : id,
        color: ARCH_COLORS[id],
        values: trend.map((t, i) => ({ x: t.wave, y: found[i] ? found[i].percent : null })),
      };
    });
  }, [trend]);

  const aiSeries = useMemo(() => {
    if (!trend) return [];
    return [
      {
        name: 'Regular use',
        color: '#6fd3c1',
        values: trend.map((t) => ({ x: t.wave, y: sumPercent(t.ai.options, AI_REGULAR) })),
      },
      {
        name: 'Rare or never',
        color: '#f0a58f',
        values: trend.map((t) => ({ x: t.wave, y: sumPercent(t.ai.options, AI_LOW) })),
      },
    ];
  }, [trend]);

  // KPI numbers
  const arch = results.q_arch;
  const ai = results.q_ai_coding;
  const exp = results.q_experience;
  const topArch = arch ? topOption(arch.options) : null;
  const topExp = exp ? topOption(exp.options) : null;
  const regular = ai ? sumPercent(ai.options, AI_REGULAR) : null;

  let delta = null;
  const idx = WAVES.indexOf(wave);
  if (idx > 0 && trend) {
    delta = round1(
      sumPercent(trend[idx].ai.options, AI_REGULAR) -
        sumPercent(trend[idx - 1].ai.options, AI_REGULAR)
    );
  }

  return (
    <div className="dash">
      <header className="topbar">
        <div>
          <h1 className="brand">State of Architecture</h1>
          <p className="muted">Practice dashboard, 2025</p>
        </div>
        <div className="wave-toggle">
          {VIEWS.map((v) => (
            <button
              key={v}
              className={`wave-btn ${v === wave ? 'active' : ''}`}
              onClick={() => setWave(v)}
            >
              {viewLabel(v)}
            </button>
          ))}
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-label">Respondents</div>
          <div className="kpi-value">{exp ? exp.n.toLocaleString() : '-'}</div>
          <div className="kpi-sub">{wave === 'all' ? 'all four quarters' : wave}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Top architecture</div>
          <div className="kpi-value">{topArch ? topArch.label : '-'}</div>
          <div className="kpi-sub">{topArch ? `${topArch.percent}%` : ''}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Regular AI use in coding</div>
          <div className="kpi-value">{regular != null ? `${regular}%` : '-'}</div>
          <div className={`kpi-sub ${delta !== null && delta < 0 ? 'down' : ''}`}>
            {delta !== null
              ? `${delta > 0 ? '+' : ''}${delta} pts vs ${viewLabel(WAVES[idx - 1])}`
              : ''}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Most common experience</div>
          <div className="kpi-value">{topExp ? topExp.label : '-'}</div>
          <div className="kpi-sub">{topExp ? `${topExp.percent}%` : ''}</div>
        </div>
      </section>

      <h2 className="section-title">Breakdown</h2>
      <section className="grid">
        {panelIdsFor(wave).map((id, i, all) =>
          questions[id] && results[id] ? (
            <BarPanel
              key={id}
              question={questions[id]}
              data={results[id]}
              wide={i === all.length - 1 && all.length % 2 === 1}
            />
          ) : null
        )}
        {wave === 'all' && (
          <div className="card fade-in wide">
            <div className="card-head">
              <h3 className="card-title">AI in testing</h3>
              <p className="muted">
                This question changed in Q3 (from "Do you use AI for testing?" to "Do you use AI to
                generate tests?"), so the two versions are not combined. Pick a quarter to see the
                version that was asked then.
              </p>
            </div>
          </div>
        )}
      </section>

      <h2 className="section-title">Trends across 2025</h2>
      <section className="grid">
        <div className="card fade-in">
          <div className="card-head">
            <h3 className="card-title">Architecture mix by quarter</h3>
            <p className="muted">
              A line that stops or starts means the option was removed or added. A gap is not zero.
            </p>
          </div>
          <Legend items={archSeries} />
          <LineChartD3 series={archSeries} categories={CATEGORIES} height={300} />
        </div>
        <div className="card fade-in">
          <div className="card-head">
            <h3 className="card-title">AI use in coding by quarter</h3>
            <p className="muted">
              Regular use = AI-driven, collaboration, or human-driven with AI as a tool.
            </p>
          </div>
          <Legend items={aiSeries} />
          <LineChartD3 series={aiSeries} categories={CATEGORIES} height={300} />
        </div>
      </section>
    </div>
  );
}

export default App;