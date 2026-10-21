import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

export interface RadarPoint {
  category: string;
  score: number;
  opponent?: number;
  fullMark: number;
}

interface RadarChartProps {
  data: RadarPoint[];
  pro?: boolean;
  opponentName?: string;
}

// Radar with an optional second series (duel opponent overlay).
export const SkillsRadar: React.FC<RadarChartProps> = ({ data, pro = false, opponentName }) => {
  const hasOpponent = data.some((d) => typeof d.opponent === 'number');
  // Shorten long labels so chapter titles fit.
  const display = data.map((d) => ({ ...d, label: d.category.length > 18 ? `${d.category.slice(0, 18)}…` : d.category }));
  return (
    <div className="w-full h-[300px]" role="img" aria-label="Score breakdown radar chart">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={display}>
          <PolarGrid stroke={pro ? '#cbd5e1' : '#334155'} />
          <PolarAngleAxis dataKey="label" tick={{ fill: pro ? '#0f766e' : '#a3e635', fontSize: 11, fontWeight: 'bold' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar name="You" dataKey="score" stroke={pro ? '#0f766e' : '#d946ef'} strokeWidth={3} fill={pro ? '#0f766e' : '#d946ef'} fillOpacity={0.35} />
          {hasOpponent && (
            <Radar name={opponentName || 'Challenger'} dataKey="opponent" stroke={pro ? '#2563eb' : '#22d3ee'} strokeWidth={2} fill={pro ? '#2563eb' : '#22d3ee'} fillOpacity={0.2} />
          )}
          {hasOpponent && <Legend wrapperStyle={{ fontSize: 12 }} />}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
