import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GRID = '#222836';

// Cleans up the default look of a D3 axis
function styleAxis(axis) {
  axis.select('.domain').remove();
  axis.selectAll('.tick text').attr('fill', '#aab1c3').attr('font-size', 12);
  axis.selectAll('.tick line').attr('stroke', GRID);
}

// series: [{ name, color, values: [{ x, y }] }]  (y = null means "not asked", so the line has a gap)
// categories: [{ key, label }]  (the x positions, in order)
export default function LineChartD3({ series, categories, height = 300 }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;

    function draw() {
      const width = wrap.clientWidth;
      if (!width) return;

      const margin = { top: 16, right: 24, bottom: 34, left: 46 };
      const innerW = Math.max(10, width - margin.left - margin.right);
      const innerH = Math.max(10, height - margin.top - margin.bottom);
      const labelOf = {};
      categories.forEach((c) => {
        labelOf[c.key] = c.label;
      });

      const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
      svg.selectAll('*').remove();
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3
        .scalePoint()
        .domain(categories.map((c) => c.key))
        .range([0, innerW])
        .padding(0.4);
      const maxVal = d3.max(series, (s) => d3.max(s.values, (d) => d.y)) || 1;
      const y = d3
        .scaleLinear()
        .domain([0, maxVal * 1.1])
        .nice()
        .range([innerH, 0]);

      styleAxis(
        g
          .append('g')
          .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat((v) => `${v}%`))
      );
      styleAxis(
        g
          .append('g')
          .attr('transform', `translate(0,${innerH})`)
          .call(
            d3
              .axisBottom(x)
              .tickSize(0)
              .tickPadding(10)
              .tickFormat((k) => labelOf[k])
          )
      );

      // defined() makes the line skip points where y is null
      const line = d3
        .line()
        .defined((d) => d.y != null)
        .x((d) => x(d.x))
        .y((d) => y(d.y))
        .curve(d3.curveMonotoneX);

      series.forEach((s) => {
        const path = g
          .append('path')
          .datum(s.values)
          .attr('fill', 'none')
          .attr('stroke', s.color)
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round')
          .attr('d', line);

        // Draw-in animation
        const length = path.node().getTotalLength();
        if (length) {
          path
            .attr('stroke-dasharray', `${length} ${length}`)
            .attr('stroke-dashoffset', length)
            .transition()
            .duration(900)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0);
        }
      });

      // One dot per real data point
      const dots = [];
      series.forEach((s) => {
        s.values.forEach((d) => {
          if (d.y != null) dots.push({ ...d, name: s.name, color: s.color });
        });
      });

      const tip = d3.select(tipRef.current);
      g.selectAll('circle.dot')
        .data(dots)
        .join('circle')
        .attr('class', 'dot')
        .attr('cx', (d) => x(d.x))
        .attr('cy', (d) => y(d.y))
        .attr('r', 4.5)
        .attr('fill', '#0e1015')
        .attr('stroke', (d) => d.color)
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
          d3.select(this).attr('r', 7);
          tip
            .style('opacity', 1)
            .html(
              `<strong>${d.name}</strong>` +
                `<span>${labelOf[d.x]}: <b>${d.y}%</b></span>`
            );
        })
        .on('mousemove', (event) => {
          const [px, py] = d3.pointer(event, wrap);
          tip
            .style('left', `${Math.min(px + 14, width - 170)}px`)
            .style('top', `${py + 14}px`);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('r', 4.5);
          tip.style('opacity', 0);
        });
    }

    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [series, categories, height]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height }}>
      <svg ref={svgRef} />
      <div
        ref={tipRef}
        className="tip"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s ease',
        }}
      />
    </div>
  );
}