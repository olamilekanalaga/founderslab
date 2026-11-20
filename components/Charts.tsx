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
} from "recharts";
const palette = [
  "#4f685b",
  "#d7b259",
  "#748fa3",
  "#b497a4",
  "#abaf9c",
  "#c6bfb0",
  "#98a69b",
  "#c89475",
  "#7d7e88",
  "#c4cbd0",
];
export default function Chart({
  data,
  type = "bar",
  label,
}: {
  data: { name: string; value: number }[];
  type?: "bar" | "area" | "donut";
  label: string;
}) {
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
            <CartesianGrid vertical={false} stroke="#eeeae2" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#71766e" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#71766e" }}
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
              stroke="#aa8133"
              fill="#f2e8cd"
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
        ) : (
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, left: -20, bottom: 35 }}
          >
            <CartesianGrid vertical={false} stroke="#eeeae2" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#666b64" }}
              angle={-23}
              textAnchor="end"
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#71766e" }}
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
