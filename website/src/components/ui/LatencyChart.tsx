import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'Direct Eval', latency: 2.77, unit: 'ms', color: '#7638FA' },
  { name: 'Verification', latency: 250, unit: 'ms', color: '#A886FF' },
  { name: 'GPU Proving', latency: 15000, unit: 'ms', color: '#F3C35D' },
  { name: 'CPU Proving', latency: 267700, unit: 'ms', color: '#E63888' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const displayValue = data.latency > 1000 ? `${(data.latency / 1000).toFixed(2)}s` : `${data.latency}ms`;
    
    return (
      <div className="bg-[#0a0a0a] border border-white/20 p-3 rounded-md shadow-md text-white font-mono text-sm">
        <p className="font-bold mb-1">{data.name}</p>
        <p className="text-accent" style={{ color: data.color }}>{displayValue}</p>
      </div>
    );
  }
  return null;
};

export const LatencyChart = () => {
  return (
    <div className="w-full h-[300px] mt-8 mb-6 font-mono text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="rgba(0,0,0,0.3)" 
            tick={{ fill: 'rgba(0,0,0,0.7)', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            scale="log" 
            domain={[1, 1000000]} 
            stroke="rgba(0,0,0,0.2)" 
            tickFormatter={(val) => {
              if (val === 1) return '1ms';
              if (val === 10) return '10ms';
              if (val === 100) return '100ms';
              if (val === 1000) return '1s';
              if (val === 10000) return '10s';
              if (val === 100000) return '100s';
              if (val === 1000000) return '1000s';
              return '';
            }}
            tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
