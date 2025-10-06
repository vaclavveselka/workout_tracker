
export interface Exercise {
  id: string;
  name: string;
}

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface SessionEntry {
  id: string;
  exerciseId: string;
  notes: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: number;
  routineId: string | null;
  entries: SessionEntry[];
  ended: boolean;
}

export type ChartMetric = 'weight' | 'reps';

export interface ChartDataPoint {
    date: string;
    sessionDate: number;
    setNumber: number;
    weight: number;
    reps: number;
}