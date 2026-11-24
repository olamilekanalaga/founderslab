"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";
import { chartPalette } from "@/lib/design";
import { Empty } from "@/components/ui";
const palette = chartPalette;
export default function Chart({
  data,
  type = "bar",
  label,
  center,
  fractional = false,
}: {
  data: { name: string; value: number }[];
  type?: "bar" | "area" | "donut" | "horizontal";
  center?: { value: string | number; label: string };
  label: string;
  fractional?: boolean;
}) {
  if (!data.length)
    return (
      <Empty title="No data to chart yet">
        Recorded programme activity will appear here. Adjust your filters or add
        records to get started.
      </Empty>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${label}: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}
    >
      <ResponsiveContainer width="100%" height={220}>
        {type === "area" ? (
          <AreaChart
            data={data}
            margin={{ top: 15, right: 12, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id="founder-growth-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#a889f6" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#a889f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ececf5" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#65708a" }}
            />
            <YAxis
              allowDecimals={fractional}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#65708a" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e4e4dc",
                fontSize: 12,
              }}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="value"
              stroke="#8758eb"
              fill="url(#founder-growth-fill)"
              dot={data.length === 1}
              strokeWidth={2.5}
            />
          </AreaChart>
        ) : type === "donut" ? (
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={data}
              nameKey="name"
              dataKey="value"
              innerRadius={65}
              outerRadius={91}
              paddingAngle={3}
              stroke="none"
            >
              {center && (
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    const box = viewBox as { cx: number; cy: number };
                    return (
                      <text
                        x={box.cx}
                        y={box.cy}
                        textAnchor="middle"
                        fill="#242441"
                      >
                        <tspan
                          x={box.cx}
                          dy="-3"
                          fontSize="27"
                          fontWeight="700"
                        >
                          {center.value}
                        </tspan>
                        <tspan x={box.cx} dy="21" fontSize="12" fill="#65708a">
                          {center.label}
                        </tspan>
                      </text>
                    );
                  }}
                />
              )}
              {data.map((d, i) => (
                <Cell key={d.name} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e4e4dc",
                fontSize: 12,
              }}
            />
          </PieChart>
        ) : type === "horizontal" ? (
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 26, left: 6, bottom: 8 }}
          >
            <XAxis type="number" hide allowDecimals={fractional} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: "#59637f" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f3efff" }}
              contentStyle={{ borderRadius: 9, border: "1px solid #e4dff3" }}
            />
            <Bar
              dataKey="value"
              fill="#9b72ee"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
              label={{ position: "right", fill: "#5f4d8a", fontSize: 11 }}
            />
          </BarChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, left: -20, bottom: 35 }}
          >
            <CartesianGrid vertical={false} stroke="#ececf5" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#65708a" }}
              angle={-23}
              textAnchor="end"
            />
            <YAxis
              allowDecimals={fractional}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#65708a" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e4e4dc",
                fontSize: 12,
              }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="value"
              radius={[4, 4, 0, 0]}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={palette[i % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
