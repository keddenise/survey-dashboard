import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const ACCENT = '#6fd3c1';
const DIMMED = '#2b3a3d';
const MUTED = '#8b93a7';
const GRID = '#222836';

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Cleans up the default look of a D3 axis
function styleAxis(axis) {
  axis.select('.domain').remove();
  axis.selectAll('.tick text').attr('fill', '#aab1c3').attr('font-size', 12);
  axis.selectAll('.tick line').attr('stroke', GRID);
}

// Breaks long axis labels into several lines that fit inside maxWidth
function wrapLabels(labels, maxWidth) {
  labels.each(function () {
    const label = d3.select(this);
    const words = label.text().split(/\s+/).reverse();
    const y = label.attr('y');
    const dy = parseFloat(label.attr('dy')) || 0;
    let line = [];
    let lineNumber = 0;
    let word;
    let tspan = label.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', `${dy}em`);
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(' '));
      if (line.length > 1 && tspan.node().getComputedTextLength() > maxWidth) {
        line.pop();
        tspan.text(line.join(' '));
        line = [word];
        lineNumber += 1;
        tspan = label
          .append('tspan')
          .attr('x', 0)
          .attr('y', y)
          .attr('dy', `${lineNumber * 1.1 + dy}em`)
          .text(word);
      }
    }
  });
}

export default function BarChartD3({ options, horizontal, n, height = 320 }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;

    function draw() {
      const width = wrap.clientWidth;
      if (!width) return;

      // Small screens get tighter margins and rotated labels
      const narrow = width < 520;
      const margin = horizontal
        ? {
            top: 12,
            right: 46,
            bottom: 30,
            left: Math.max(96, Math.min(190, Math.round(width * 0.34))),
          }
        : { top: 26, right: 12, bottom: narrow ? 72 : 58, left: 44 };
      const innerW = Math.max(10, width - margin.left - margin.right);
      const innerH = Math.max(10, height - margin.top - margin.bottom);
      const labels = options.map((d) => d.label);
      const maxVal = d3.max(options, (d) => d.percent) || 1;

      // Start fresh on every draw
      const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
      svg.selectAll('*').remove();
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales: one for the categories (band), one for the values (linear)
      const band = d3.scaleBand().domain(labels).padding(0.35);
      const linear = d3.scaleLinear().domain([0, maxVal]).nice();
      if (horizontal) {
        band.range([innerH, 0]);
        linear.range([0, innerW]);
      } else {
        band.range([0, innerW]);
        linear.range([innerH, 0]);
      }

      // Axes (the gridlines come from negative tick sizes)
      const pct = (v) => `${v}%`;
      if (horizontal) {
        styleAxis(
          g
            .append('g')
            .attr('transform', `translate(0,${innerH})`)
            .call(d3.axisBottom(linear).ticks(5).tickSize(-innerH).tickFormat(pct))
        );
        const maxChars = Math.floor((margin.left - 20) / 6.5);
        styleAxis(
          g
            .append('g')
            .call(
              d3
                .axisLeft(band)
                .tickSize(0)
                .tickPadding(12)
                .tickFormat((l) => truncate(l, maxChars))
            )
        );
      } else {
        styleAxis(
          g.append('g').call(d3.axisLeft(linear).ticks(5).tickSize(-innerW).tickFormat(pct))
        );
        const xAxis = g
          .append('g')
          .attr('transform', `translate(0,${innerH})`)
          .call(
            d3
              .axisBottom(band)
              .tickSize(0)
              .tickPadding(10)
              .tickFormat((l) => (narrow ? truncate(l, 14) : l))
          );
        styleAxis(xAxis);
        if (narrow) {
          xAxis
            .selectAll('text')
            .attr('text-anchor', 'end')
            .attr('transform', 'rotate(-40)')
            .attr('dx', '-0.4em')
            .attr('dy', '0.3em');
        } else {
          wrapLabels(xAxis.selectAll('text'), band.step() - 6);
        }
      }

      // Bars: they start at size 0, then grow
      const bars = g
        .selectAll('rect.bar')
        .data(options)
        .join('rect')
        .attr('class', 'bar')
        .attr('rx', 6)
        .attr('fill', ACCENT);

      if (horizontal) {
        bars
          .attr('x', 0)
          .attr('y', (d) => band(d.label))
          .attr('height', band.bandwidth())
          .attr('width', 0)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr('width', (d) => linear(d.percent));
      } else {
        bars
          .attr('x', (d) => band(d.label))
          .attr('width', band.bandwidth())
          .attr('y', innerH)
          .attr('height', 0)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr('y', (d) => linear(d.percent))
          .attr('height', (d) => innerH - linear(d.percent));
      }

      // Value labels, fading in after the bars grow
      g.selectAll('text.value')
        .data(options)
        .join('text')
        .attr('class', 'value')
        .attr('fill', MUTED)
        .attr('font-size', 12)
        .attr('text-anchor', horizontal ? 'start' : 'middle')
        .attr('x', (d) =>
          horizontal ? linear(d.percent) + 8 : band(d.label) + band.bandwidth() / 2
        )
        .attr('y', (d) =>
          horizontal ? band(d.label) + band.bandwidth() / 2 + 4 : linear(d.percent) - 8
        )
        .text((d) => `${d.percent}%`)
        .attr('opacity', 0)
        .transition()
        .delay(400)
        .duration(300)
        .attr('opacity', 1);

      // Hover: dim the other bars and show a tooltip
      const tip = d3.select(tipRef.current);
      bars
        .on('mouseenter', (event, d) => {
          bars.attr('fill', (b) => (b.option_id === d.option_id ? ACCENT : DIMMED));
          tip
            .style('opacity', 1)
            .html(
              `<strong>${d.label}</strong>` +
                `<span><b>${d.count}</b> of ${d.base} respondents</span>` +
                `<span>${d.percent}%</span>`
            );
        })
        .on('mousemove', (event) => {
          const [x, y] = d3.pointer(event, wrap);
          tip
            .style('left', `${Math.min(x + 14, width - 170)}px`)
            .style('top', `${y + 14}px`);
        })
        .on('mouseleave', () => {
          bars.attr('fill', ACCENT);
          tip.style('opacity', 0);
        });
    }

    // Draws once, and again whenever the container size changes
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [options, horizontal, n, height]);

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