"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function SubjectAccuracyBarChart({
  data,
}: {
  data: Array<{
    subjectId: string;
    subjectName: string;
    attempts: number;
    accuracy: number;
  }>;
}) {
  if (data.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center text-xs text-muted border border-dashed border-border rounded-lg">
        Sem dados históricos registrados para renderizar o gráfico de disciplinas.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 16, right: 20, left: 0, bottom: 52 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E4E8ED" />
          <XAxis
            dataKey="subjectName"
            tick={{ fontSize: 11, fill: "#687585" }}
            tickFormatter={(val: string) =>
              val.length > 36 ? `${val.slice(0, 34)}…` : val
            }
            interval={0}
            angle={-10}
            textAnchor="end"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#687585" }}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E4E8ED",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="accuracy"
            name="Taxa de Acerto (%)"
            fill="#14877B"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
