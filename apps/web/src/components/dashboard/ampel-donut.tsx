"use client";

import * as React from "react";

interface AmpelSegment {
  status: string;
  count: number;
  color: string;
}

interface AmpelDonutProps {
  data: AmpelSegment[];
}

export function AmpelDonut({ data }: AmpelDonutProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="none"
            stroke="var(--color-border-default)"
            strokeWidth="20"
          />
          <text
            x="80"
            y="80"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[var(--color-text-tertiary)] text-sm font-medium"
          >
            No data
          </text>
        </svg>
      </div>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const fraction = d.count / total;
      const dashLength = fraction * circumference;
      const dashOffset = -accumulated * circumference + circumference * 0.25;
      accumulated += fraction;

      return {
        ...d,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset,
        percentage: Math.round(fraction * 1000) / 10,
      };
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160" aria-label="Ampel classification donut chart">
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
            className="transition-all duration-500"
          />
        ))}
        <text
          x="80"
          y="74"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[var(--color-text-primary)] text-2xl font-bold"
        >
          {total.toLocaleString("de-DE")}
        </text>
        <text
          x="80"
          y="94"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[var(--color-text-tertiary)] text-xs"
        >
          Total TX
        </text>
      </svg>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 1000) / 10 : 0;
          return (
            <div key={d.status} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: d.color }}
                aria-hidden="true"
              />
              <span className="text-[var(--color-text-secondary)]">
                {d.status}
              </span>
              <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                {d.count}
              </span>
              <span className="text-[var(--color-text-tertiary)]">
                ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
