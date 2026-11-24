"use client";
import { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { AnalyticsPoint } from "@/features/reports/lib/programme-analytics";

export default function AnalyticsChart({
  data,
  label,
  unit = "",
  bars = false,
  height = 210,
}: {
  data: AnalyticsPoint[];
  label: string;
  unit?: string;
  bars?: boolean;
  height?: number;
}) {
  const gradientId = useId().replaceAll(":", "");
  const valueLabel = (value: number) =>
    `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}${unit}`;
  const tick = (value: string) =>
    value.length === 10 ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : value;
  const common = {
    data,
    margin: { top: 12, right: 14, left: -17, bottom: 6 },
    accessibilityLayer: true,
  };
  const axes = (
    <>
      <CartesianGrid
        vertical={false}
        stroke="var(--chart-grid, #e6def0)"
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="name"
        axisLine={false}
        tickLine={false}
        tick={{ fontSize: 10, fill: "var(--chart-label, #71647f)" }}
        tickFormatter={tick}
        minTickGap={25}
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        allowDecimals={unit !== ""}
        tick={{ fontSize: 10, fill: "var(--chart-label, #71647f)" }}
      />
      <Tooltip
        labelFormatter={(value) => String(value)}
        formatter={(value) => [valueLabel(Number(value)), label]}
        contentStyle={{
          background: "var(--chart-surface, #fff)",
          color: "var(--chart-ink, inherit)",
          border: "1px solid var(--chart-grid, #d6c6e9)",
          borderRadius: 10,
          fontSize: 12,
          boxShadow: "0 7px 25px rgba(55,34,83,.1)",
        }}
        cursor={{ fill: "rgba(147,108,198,.06)" }}
      />
    </>
  );
  return (
    <div
      className="studio-chart"
      role="img"
      aria-label={`${label}. ${data.map((d) => `${d.name}: ${d.value === null ? "Not recorded" : valueLabel(d.value)}`).join("; ")}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        {bars ? (
          <BarChart {...common}>
            {axes}
            <Bar
              isAnimationActive={false}
              dataKey="value"
              fill="var(--chart-accent, #9669cf)"
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-accent, #b899df)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-accent, #b899df)"
                  stopOpacity={0.025}
                />
              </linearGradient>
            </defs>
            {axes}
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="value"
              name={label}
              stroke="var(--chart-accent, #8652c5)"
              fill={`url(#${gradientId})`}
              strokeWidth={2.5}
              dot={data.length === 1 ? { r: 4 } : false}
              connectNulls={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
