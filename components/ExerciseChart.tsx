import React, { useState, useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WorkoutSession, ChartMetric, ChartDataPoint, Exercise } from '../types';

const processHistory = (exerciseId: string, history: WorkoutSession[]): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];

  history
    .filter(session => session.ended)
    .sort((a, b) => a.date - b.date)
    .forEach(session => {
      const entry = session.entries.find(e => e.exerciseId === exerciseId);
      if (entry) {
        entry.sets
          .filter(s => s.completed)
          .forEach((set, setIndex) => {
            data.push({
              date: new Date(session.date).toLocaleDateString(),
              sessionDate: session.date,
              setNumber: setIndex + 1,
              weight: set.weight,
              reps: set.reps,
            });
          });
      }
    });
  return data;
};

// FIX: Define the ExerciseChartProps interface.
interface ExerciseChartProps {
  exercise: Exercise;
  history: WorkoutSession[];
}

const SET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const ExerciseChart: React.FC<ExerciseChartProps> = ({ exercise, history }) => {
  const [metric, setMetric] = useState<ChartMetric>('weight');
  const [visibleSet, setVisibleSet] = useState<'all' | number>('all');

  const data = useMemo(() => processHistory(exercise.id, history), [exercise.id, history]);
  
  const groupedData = useMemo(() => {
    const groups: { [key: number]: ChartDataPoint[] } = {};
    data.forEach(point => {
        if (!groups[point.setNumber]) {
            groups[point.setNumber] = [];
        }
        groups[point.setNumber].push(point);
    });
    return groups;
  }, [data]);
  
  const availableSets = useMemo(() => {
    return Array.from(new Set(data.map(d => d.setNumber))).sort((a, b) => a - b);
  }, [data]);

  const filteredGroupedData = useMemo(() => {
    if (visibleSet === 'all') {
        return groupedData;
    }
    return { [visibleSet]: groupedData[visibleSet] || [] };
  }, [groupedData, visibleSet]);


  const metricConfig = {
    weight: { name: 'Weight (kg)' },
    reps: { name: 'Reps' },
  };
  
  if (data.length < 1) {
    return (
        <div className="text-center p-8 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold text-text-primary">{exercise.name} Progress</h3>
            <p className="text-text-secondary mt-2">Not enough data to display a chart. Complete at least one workout with this exercise to see your progress.</p>
        </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-center">{exercise.name} Progress</h3>
      <div className="flex justify-center space-x-2 mb-4">
        {(Object.keys(metricConfig) as ChartMetric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-3 py-1 text-sm rounded-full transition-colors capitalize ${
              metric === m ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
       <div className="flex justify-center flex-wrap gap-2 mb-4">
        <button
            onClick={() => setVisibleSet('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                visibleSet === 'all' ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'
            }`}
        >
            All Sets
        </button>
        {availableSets.map(setNum => (
            <button
                key={setNum}
                onClick={() => setVisibleSet(setNum)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    visibleSet === setNum ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'
                }`}
            >
                Set {setNum}
            </button>
        ))}
    </div>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
             <XAxis
                type="number"
                dataKey="sessionDate"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString()}
                stroke="#9ca3af"
                name="Date"
                fontSize={12}
                padding={{ left: 20, right: 20 }}
            />
            <YAxis
                type="number"
                dataKey={metric}
                name={metricConfig[metric].name}
                stroke="#9ca3af"
                fontSize={12}
                domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                    backgroundColor: '#1f2937',
                    borderColor: '#374151',
                    borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#f9fafb' }}
                formatter={(value, name, props) => {
                    const { payload } = props;
                    if (payload) {
                        return `${payload.weight} kg x ${payload.reps} reps`;
                    }
                    return value;
                }}
                labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
            />
            <Legend verticalAlign="bottom" height={36} iconSize={10} />
            {Object.entries(filteredGroupedData).map(([setNumber, setData]) => (
                <Scatter
                    key={setNumber}
                    name={`Set ${setNumber}`}
                    data={setData}
                    fill={SET_COLORS[(parseInt(setNumber) - 1) % SET_COLORS.length]}
                />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};