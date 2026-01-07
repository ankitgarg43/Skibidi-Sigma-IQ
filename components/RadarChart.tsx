import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface DataPoint {
  category: string;
  score: number;
  fullMark: number;
}

interface RadarChartProps {
  data: DataPoint[];
}

export const SkillsRadar: React.FC<RadarChartProps> = ({ data }) => {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis 
            dataKey="category" 
            tick={{ fill: '#a3e635', fontSize: 11, fontWeight: 'bold' }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false} 
            axisLine={false} 
          />
          <Radar
            name="Cognitive Skills"
            dataKey="score"
            stroke="#d946ef"
            strokeWidth={3}
            fill="#d946ef"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};