"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PriceHistoryPoint = {
  createdAt: string;
  price: number;
};

type PriceChartProps = {
  priceHistory: PriceHistoryPoint[];
};

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function PriceChart({ priceHistory }: PriceChartProps) {
  const chartData = [...priceHistory]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map((point) => ({
      date: formatShortDate(point.createdAt),
      price: point.price,
      createdAt: point.createdAt,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No price history yet.
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#71717a"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#71717a"
            tickLine={false}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "USD",
                notation: "compact",
              }).format(value)
            }
          />
          <Tooltip
            formatter={(value) => formatPrice(Number(value))}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as
                | { createdAt?: string }
                | undefined;
              if (!point?.createdAt) return "";
              return new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(point.createdAt));
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#18181b"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
