import { Fragment } from 'react';
import { colors } from '../lib/theme';

export interface LineSeries {
  color: string;
  label: string;
  values: number[];
}

interface Props {
  series: LineSeries[];
  /** Y-axis domain. */
  yMin: number;
  yMax: number;
  /** Optional x-axis labels (shown sparsely to avoid crowding). */
  xLabels?: string[];
  height?: number;
}

/**
 * Minimal multi-series line chart over a shared x-axis (point index).
 * Responsive: the SVG scales to its container width via a viewBox.
 */
export function LineChart({ series, yMin, yMax, xLabels, height = 180 }: Props) {
  const width = 340;
  const pad = 28;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const count = Math.max(...series.map((s) => s.values.length), 0);

  const x = (i: number) => (count <= 1 ? pad + innerW / 2 : pad + (i / (count - 1)) * innerW);
  const range = yMax - yMin || 1;
  const y = (v: number) => pad + innerH - ((v - yMin) / range) * innerH;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y gridlines at min / mid / max */}
        {[yMin, (yMin + yMax) / 2, yMax].map((v) => (
          <Fragment key={v}>
            <line
              x1={pad}
              y1={y(v)}
              x2={width - pad}
              y2={y(v)}
              stroke={colors.border}
              strokeWidth={1}
            />
            <text x={2} y={y(v) + 3} fill={colors.textMuted} fontSize={9}>
              {Math.round(v)}
            </text>
          </Fragment>
        ))}
        {series.map((s) => (
          <Fragment key={s.label}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
            ))}
          </Fragment>
        ))}
        {xLabels?.map((label, i) =>
          i === 0 || i === xLabels.length - 1 || i === Math.floor(xLabels.length / 2) ? (
            <text
              key={`${label}-${i}`}
              x={x(i)}
              y={height - 6}
              fill={colors.textMuted}
              fontSize={9}
              textAnchor="middle"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-row flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.label} className="text-sm font-semibold" style={{ color: s.color }}>
            ● {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
