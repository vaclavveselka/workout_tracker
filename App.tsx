// FIX: Import 'useRef' and 'useMemo' from React to fix 'Cannot find name' errors.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import { Exercise, Routine, WorkoutSession, WorkoutSet, SessionEntry } from './types';
import { PlusIcon, ChartBarIcon, TrashIcon, PencilIcon, ChevronLeftIcon, CheckIcon, Cog6ToothIcon, EllipsisVerticalIcon } from './components/Icons';
import { Modal } from './components/Modal';
import { ExerciseChart } from './components/ExerciseChart';
// Recharts needs to be imported, but since we don't have a package manager,
// we will assume it is globally available from a CDN in a real scenario.
// For this code to be valid, we add the imports.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// --- Helper Functions ---
const createId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// --- Sub-components defined outside App to prevent re-rendering issues ---

interface HeaderProps {
    title: string;
    onBack?: () => void;
    children?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, onBack, children }) => (
    <header className="bg-surface sticky top-0 z-20 shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center">
            {onBack && (
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-secondary transition-colors">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
            )}
            <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <div>{children}</div>
    </header>
);

// --- Main App Component ---

export default function App() {
    // --- State Management ---
    const [exercises, setExercises] = useLocalStorage<Exercise[]>('exercises', []);
    const [routines, setRoutines] = useLocalStorage<Routine[]>('routines', []);
    const [workoutHistory, setWorkoutHistory] = useLocalStorage<WorkoutSession[]>('workoutHistory', []);
    const [restDuration, setRestDuration] = useLocalStorage<number>('restDuration', 60);

    const [currentView, setCurrentView] = useState('routines'); // routines, workout, history, routineEditor, historyDetail
    const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [viewingHistoryItem, setViewingHistoryItem] = useState<WorkoutSession | null>(null);

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);
    const [chartExercise, setChartExercise] = useState<Exercise | null>(null);
    
    // --- Drag & Drop State ---
    const [draggedItem, setDraggedItem] = useState<{ list: 'routineEditor' | 'workout', index: number } | null>(null);
    const [draggedOverItem, setDraggedOverItem] = useState<{ list: 'routineEditor' | 'workout', index: number } | null>(null);
    
    // --- Import/Export ---
    const fileInputRef = useRef<HTMLInputElement>(null);


    // --- Timer Logic ---
    const timerAudioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        // FIX: Replace the empty audio file with a valid beep sound.
        timerAudioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU0AAAAKBgYHBwcICAgJCQkJChQUFBUVFRYWFhcWGBgYGRkZGxscHB0eHh8gISIiJCQkJSYmKCgpKissLS4uLzIyMjQ1NTY2ODg4ODk5Ojs7PD09Pj4/QEFCQ0RFRkhJSUpMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8=');
    }, []);

    const onTimerComplete = useCallback(() => {
        timerAudioRef.current?.play();
        // Simple visual feedback
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.classList.add('bg-success', 'text-white');
            setTimeout(() => {
                timerDisplay.classList.remove('bg-success', 'text-white');
            }, 2000);
        }
    }, []);

    const { timeLeft, isActive, startTimer, stopTimer } = useTimer(restDuration, onTimerComplete);

    // --- Data Calculation ---
    const personalRecords = useMemo(() => {
        const records = new Map<string, { weight: number; reps: number }>();
        const history = activeWorkout ? workoutHistory.concat([activeWorkout]) : workoutHistory;

        history
            .filter(session => session.ended)
            .forEach(session => {
                session.entries.forEach(entry => {
                    let pr = records.get(entry.exerciseId) || { weight: 0, reps: 0 };
                    entry.sets
                        .filter(s => s.completed)
                        .forEach(set => {
                            if (set.weight > pr.weight) {
                                pr = { weight: set.weight, reps: set.reps };
                            }
                        });
                    records.set(entry.exerciseId, pr);
                });
            });
        return records;
    }, [activeWorkout, workoutHistory]);

    // --- Data Handlers ---

    // Exercises
    const addExercise = (name: string) => {
        if (name && !exercises.find(e => e.name.toLowerCase() === name.toLowerCase())) {
            setExercises(prev => [...prev, { id: createId(), name }]);
        }
    };
    const deleteExercise = (id: string) => {
        setExercises(prev => prev.filter(e => e.id !== id));
        // Also remove from routines
        setRoutines(prev => prev.map(r => ({
            ...r,
            exerciseIds: r.exerciseIds.filter(eId => eId !== id)
        })));
    };

    // Routines
    const saveRoutine = (routine: Routine) => {
        setRoutines(prev => {
            const existing = prev.find(r => r.id === routine.id);
            if (existing) {
                return prev.map(r => r.id === routine.id ? routine : r);
            }
            return [...prev, routine];
        });
        setCurrentView('routines');
        setEditingRoutine(null);
    };

    const deleteRoutine = (id: string) => {
        setRoutines(prev => prev.filter(r => r.id !== id));
    };

    const startRoutineEditor = (routine: Routine | null) => {
        setEditingRoutine(routine || { id: createId(), name: '', exerciseIds: [] });
        setCurrentView('routineEditor');
    };

    // Workouts
    const startWorkout = (routine: Routine | null) => {
        const lastSession = routine ? workoutHistory.find(s => s.ended && s.routineId === routine.id) : null;

        const newWorkout: WorkoutSession = {
            id: createId(),
            date: Date.now(),
            routineId: routine?.id || null,
            entries: routine ? routine.exerciseIds.map(exerciseId => {
                const lastEntry = lastSession?.entries.find(e => e.exerciseId === exerciseId);
                
                return {
                    id: createId(),
                    exerciseId,
                    notes: '',
                    sets: lastEntry && lastEntry.sets.filter(s => s.completed).length > 0
                        ? lastEntry.sets.filter(s => s.completed).map(s => ({
                            id: createId(),
                            weight: s.weight,
                            reps: s.reps,
                            completed: false,
                          }))
                        : [{ id: createId(), weight: 0, reps: 0, completed: false }]
                };
            }) : [],
            ended: false
        };
        setActiveWorkout(newWorkout);
        setCurrentView('workout');
        stopTimer();
    };

    const updateActiveWorkout = (updatedWorkout: WorkoutSession) => {
        setActiveWorkout(updatedWorkout);
    };
    
    const addSet = (entryIndex: number) => {
        const updatedWorkout = { ...activeWorkout! };
        const lastSet = updatedWorkout.entries[entryIndex].sets[updatedWorkout.entries[entryIndex].sets.length - 1];
        const newSet: WorkoutSet = {
            id: createId(),
            weight: lastSet?.weight || 0,
            reps: lastSet?.reps || 0,
            completed: false,
        };
        updatedWorkout.entries[entryIndex].sets.push(newSet);
        updateActiveWorkout(updatedWorkout);
    };

    const updateSet = (entryIndex: number, setIndex: number, newSetData: Partial<WorkoutSet>) => {
        const updatedWorkout = { ...activeWorkout! };
        const originalSet = updatedWorkout.entries[entryIndex].sets[setIndex];
        updatedWorkout.entries[entryIndex].sets[setIndex] = { ...originalSet, ...newSetData };
        
        // If set is marked complete, start timer
        if (newSetData.completed && !originalSet.completed) {
            startTimer();
        }

        updateActiveWorkout(updatedWorkout);
    };

    const deleteSet = (entryIndex: number, setIndex: number) => {
        const updatedWorkout = { ...activeWorkout! };
        updatedWorkout.entries[entryIndex].sets.splice(setIndex, 1);
        updateActiveWorkout(updatedWorkout);
    };
    
    const addExerciseToWorkout = (exerciseId: string) => {
        const updatedWorkout = { ...activeWorkout! };
        if (!updatedWorkout.entries.find(e => e.exerciseId === exerciseId)) {
            const newEntry: SessionEntry = {
                id: createId(),
                exerciseId: exerciseId,
                notes: '',
                sets: [{ id: createId(), weight: 0, reps: 0, completed: false }]
            };
            updatedWorkout.entries.push(newEntry);
            updateActiveWorkout(updatedWorkout);
        }
    };
    
    const updateNotes = (entryIndex: number, notes: string) => {
        const updatedWorkout = { ...activeWorkout! };
        updatedWorkout.entries[entryIndex].notes = notes;
        updateActiveWorkout(updatedWorkout);
    };


    const finishWorkout = () => {
        if (activeWorkout) {
            const finishedWorkout = { ...activeWorkout, ended: true, date: Date.now() };
            // Filter out empty entries
            finishedWorkout.entries = finishedWorkout.entries.filter(entry => entry.sets.some(s => s.completed));
            if (finishedWorkout.entries.length > 0) {
                 setWorkoutHistory(prev => [finishedWorkout, ...prev]);
            }
            setActiveWorkout(null);
            setCurrentView('routines');
            stopTimer();
        }
    };

    // History
    const viewHistoryDetail = (session: WorkoutSession) => {
        setViewingHistoryItem(session);
        setCurrentView('historyDetail');
    };

    const deleteHistoryItem = (id: string) => {
        setWorkoutHistory(prev => prev.filter(s => s.id !== id));
        if (viewingHistoryItem?.id === id) {
            setCurrentView('history');
            setViewingHistoryItem(null);
        }
    };
    
    const showChart = (exercise: Exercise) => {
        setChartExercise(exercise);
        setIsChartModalOpen(true);
    };

    // --- Import/Export Logic ---
    const handleExport = () => {
        try {
            const data = JSON.stringify({
                exercises,
                routines,
                workoutHistory,
                restDuration
            }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'progress-tracker-backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export data:", error);
            alert("Error exporting data.");
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File could not be read");
                const data = JSON.parse(text);

                if (Array.isArray(data.exercises) && Array.isArray(data.routines) && Array.isArray(data.workoutHistory) && typeof data.restDuration === 'number') {
                    setExercises(data.exercises);
                    setRoutines(data.routines);
                    setWorkoutHistory(data.workoutHistory);
                    setRestDuration(data.restDuration);
                    alert('Data imported successfully!');
                    setIsSettingsModalOpen(false);
                } else {
                    throw new Error("Invalid or corrupted data file.");
                }
            } catch (error) {
                console.error("Failed to import data:", error);
                alert(`Error importing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        };
        reader.onerror = () => {
            alert('Failed to read the file.');
        };
        reader.readAsText(file);
        event.target.value = ''; // Allow re-importing the same file
    };

    // --- Render Logic ---

    const renderRoutines = () => (
        <>
            <Header title="Routines">
                 <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-secondary transition-colors"><Cog6ToothIcon /></button>
            </Header>
            <main className="p-4 space-y-4">
                <button
                    onClick={() => startWorkout(null)}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                    <PlusIcon className="w-5 h-5 mr-2" /> Start Blank Workout
                </button>
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Your Routines</h2>
                    <button onClick={() => startRoutineEditor(null)} className="text-primary font-semibold">New Routine</button>
                </div>
                {routines.length === 0 ? (
                    <p className="text-center text-text-secondary py-8">No routines yet. Create one!</p>
                ) : (
                    <div className="space-y-3">
                        {routines.map(routine => (
                            <div key={routine.id} className="bg-surface rounded-lg shadow p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg">{routine.name}</h3>
                                    <p className="text-sm text-text-secondary">{routine.exerciseIds.length} exercises</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                     <button onClick={() => startRoutineEditor(routine)} className="p-2 rounded-full hover:bg-secondary"><PencilIcon className="w-5 h-5 text-text-secondary" /></button>
                                     <button onClick={() => deleteRoutine(routine.id)} className="p-2 rounded-full hover:bg-secondary"><TrashIcon className="w-5 h-5 text-danger" /></button>
                                    <button onClick={() => startWorkout(routine)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">Start</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <button onClick={() => setCurrentView('history')} className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-lg transition-colors">View Workout History</button>
            </main>
        </>
    );

    const renderRoutineEditor = () => {
        if (!editingRoutine) return null;
        const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setEditingRoutine({ ...editingRoutine, name: e.target.value });

        const onAddExercise = (exerciseId: string) => {
            if (!editingRoutine.exerciseIds.includes(exerciseId)) {
                setEditingRoutine({ ...editingRoutine, exerciseIds: [...editingRoutine.exerciseIds, exerciseId] });
            }
        };

        const onRemoveExercise = (exerciseId: string) => {
            setEditingRoutine({ ...editingRoutine, exerciseIds: editingRoutine.exerciseIds.filter(id => id !== exerciseId) });
        };
        
        const handleRoutineExerciseReorder = (dragIndex: number, dropIndex: number) => {
            const reorderedIds = [...editingRoutine.exerciseIds];
            const [movedItem] = reorderedIds.splice(dragIndex, 1);
            reorderedIds.splice(dropIndex, 0, movedItem);
            setEditingRoutine({ ...editingRoutine, exerciseIds: reorderedIds });
        };

        return (
            <>
                <Header title={editingRoutine.id ? 'Edit Routine' : 'New Routine'} onBack={() => setCurrentView('routines')}>
                    <button onClick={() => saveRoutine(editingRoutine)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">Save</button>
                </Header>
                <main className="p-4 space-y-4">
                    <input type="text" value={editingRoutine.name} onChange={onNameChange} placeholder="Routine Name" className="w-full bg-secondary p-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"/>
                    <h3 className="text-lg font-semibold mt-4">Exercises</h3>
                     <div className="space-y-2">
                        {editingRoutine.exerciseIds.map((id, index) => {
                            const exercise = exercises.find(e => e.id === id);
                            const isDraggedOver = draggedOverItem?.list === 'routineEditor' && draggedOverItem.index === index;
                            return (
                                <div 
                                    key={id} 
                                    className={`bg-surface p-3 rounded-lg flex justify-between items-center transition-all ${draggedItem?.list === 'routineEditor' && draggedItem.index === index ? 'opacity-30' : ''} ${isDraggedOver ? 'ring-2 ring-primary' : ''}`}
                                    draggable
                                    onDragStart={() => setDraggedItem({ list: 'routineEditor', index })}
                                    onDragEnter={() => setDraggedOverItem({ list: 'routineEditor', index })}
                                    onDragEnd={() => { setDraggedItem(null); setDraggedOverItem(null); }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                        if (draggedItem && draggedItem.list === 'routineEditor') {
                                            handleRoutineExerciseReorder(draggedItem.index, index);
                                        }
                                        setDraggedOverItem(null);
                                    }}
                                >
                                    <div className="flex items-center">
                                        <EllipsisVerticalIcon className="w-5 h-5 text-text-secondary cursor-grab mr-2"/>
                                        <span>{exercise?.name || 'Unknown Exercise'}</span>
                                    </div>
                                    <button onClick={() => onRemoveExercise(id)}><TrashIcon className="w-5 h-5 text-danger"/></button>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={() => setIsExerciseModalOpen(true)} className="w-full border-2 border-dashed border-gray-600 text-text-secondary hover:bg-secondary py-3 rounded-lg flex items-center justify-center transition-colors">
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Exercise
                    </button>
                </main>
                 <Modal isOpen={isExerciseModalOpen} onClose={() => setIsExerciseModalOpen(false)} title="Select Exercise">
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {exercises.map(ex => (
                            <button key={ex.id} onClick={() => { onAddExercise(ex.id); setIsExerciseModalOpen(false); }} className="w-full text-left p-3 bg-secondary hover:bg-secondary-hover rounded-lg transition-colors">
                                {ex.name}
                            </button>
                        ))}
                    </div>
                    <div className="mt-4">
                        <p className="font-semibold mb-2">Or create a new one:</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const newName = (e.currentTarget.elements.namedItem('exerciseName') as HTMLInputElement).value;
                            addExercise(newName);
                            (e.currentTarget.elements.namedItem('exerciseName') as HTMLInputElement).value = '';
                        }} className="flex gap-2">
                            <input type="text" name="exerciseName" placeholder="New Exercise Name" className="flex-grow bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"/>
                            <button type="submit" className="bg-primary hover:bg-primary-hover p-2 rounded-lg text-white"><PlusIcon/></button>
                        </form>
                    </div>
                </Modal>
            </>
        );
    };

    const renderActiveWorkout = () => {
        if (!activeWorkout) return null;

        const activeRoutine = routines.find(r => r.id === activeWorkout.routineId);
        const workoutTitle = activeRoutine?.name || (activeWorkout.routineId === null ? 'Blank Workout' : 'Workout');
        
        const lastSessionForRoutine = workoutHistory.find(session =>
            session.ended && session.routineId === activeWorkout.routineId
          );

        const handleWorkoutExerciseReorder = (dragIndex: number, dropIndex: number) => {
            const reorderedEntries = [...activeWorkout.entries];
            const [movedItem] = reorderedEntries.splice(dragIndex, 1);
            reorderedEntries.splice(dropIndex, 0, movedItem);
            updateActiveWorkout({ ...activeWorkout, entries: reorderedEntries });
        };
        
        return (
            <div className="flex flex-col h-screen">
                <Header title={workoutTitle} onBack={() => setCurrentView('routines')}>
                    <button onClick={finishWorkout} className="bg-success text-white font-bold py-2 px-4 rounded-lg">Finish</button>
                </Header>
                <main className="flex-grow p-4 space-y-6 overflow-y-auto pb-24">
                    <div className="mb-4">
                        <label htmlFor="restDurationWorkout" className="block text-sm font-medium text-text-secondary">Rest Timer (seconds)</label>
                        <input
                            id="restDurationWorkout"
                            type="number"
                            value={restDuration}
                            onChange={e => setRestDuration(parseInt(e.target.value) || 60)}
                            className="mt-1 w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    {activeWorkout.entries.map((entry, entryIndex) => {
                        const exercise = exercises.find(e => e.id === entry.exerciseId);
                        const lastPerformance = lastSessionForRoutine?.entries.find(
                            lastEntry => lastEntry.exerciseId === entry.exerciseId
                        );
                        const pr = personalRecords.get(entry.exerciseId);
                        const isDraggedOver = draggedOverItem?.list === 'workout' && draggedOverItem.index === entryIndex;

                        return (
                            <div 
                                key={entry.id} 
                                className={`bg-surface p-4 rounded-lg transition-all ${draggedItem?.list === 'workout' && draggedItem.index === entryIndex ? 'opacity-30' : ''} ${isDraggedOver ? 'ring-2 ring-primary' : ''}`}
                                draggable
                                onDragStart={() => setDraggedItem({ list: 'workout', index: entryIndex })}
                                onDragEnter={() => setDraggedOverItem({ list: 'workout', index: entryIndex })}
                                onDragEnd={() => { setDraggedItem(null); setDraggedOverItem(null); }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                    if (draggedItem && draggedItem.list === 'workout') {
                                        handleWorkoutExerciseReorder(draggedItem.index, entryIndex);
                                    }
                                    setDraggedOverItem(null);
                                }}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center">
                                        <EllipsisVerticalIcon className="w-5 h-5 text-text-secondary cursor-grab mr-2"/>
                                        <h3 className="text-xl font-bold">{exercise?.name}</h3>
                                    </div>
                                    {exercise && (
                                        <button onClick={() => showChart(exercise)} className="p-2 rounded-full hover:bg-secondary text-primary">
                                            <ChartBarIcon />
                                        </button>
                                    )}
                                </div>

                                {lastPerformance && lastPerformance.sets.some(s => s.completed) && (
                                    <div className="mb-4 p-3 bg-secondary rounded-lg">
                                        <p className="text-sm font-semibold text-text-secondary mb-1">
                                            Last time ({new Date(lastSessionForRoutine!.date).toLocaleDateString()}):
                                        </p>
                                        <div className="text-sm text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
                                            {lastPerformance.sets.filter(s => s.completed).map((set, index) => (
                                                <span key={index}>{set.weight} kg x {set.reps} reps</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sets Table */}
                                <div className="space-y-2 text-center">
                                    <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-text-secondary">
                                        <div className="col-span-1">SET</div>
                                        <div className="col-span-3 text-left">PR</div>
                                        <div className="col-span-3">WEIGHT (kg)</div>
                                        <div className="col-span-3">REPS</div>
                                        <div className="col-span-2">✓</div>
                                    </div>
                                    {entry.sets.map((set, setIndex) => (
                                        <div key={set.id} className={`grid grid-cols-12 gap-2 items-center p-1 rounded-md ${set.completed ? 'bg-green-900 bg-opacity-30' : ''}`}>
                                            <div className="col-span-1 font-bold">{setIndex + 1}</div>
                                            <div className="col-span-3 text-left text-xs text-text-secondary pl-1">
                                                {pr ? `${pr.weight}kg x ${pr.reps}` : 'n/a'}
                                            </div>
                                            <div className="col-span-3"><input type="number" value={set.weight} onChange={e => updateSet(entryIndex, setIndex, { weight: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} className="w-full text-center bg-secondary p-2 rounded-lg"/></div>
                                            <div className="col-span-3"><input type="number" value={set.reps} onChange={e => updateSet(entryIndex, setIndex, { reps: parseInt(e.target.value) || 0 })} onFocus={e => e.target.select()} className="w-full text-center bg-secondary p-2 rounded-lg"/></div>
                                            <div className="col-span-2 flex justify-center">
                                                <button onClick={() => updateSet(entryIndex, setIndex, { completed: !set.completed })} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${set.completed ? 'bg-success text-white' : 'border-2 border-gray-500'}`}>
                                                    {set.completed && <CheckIcon />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => addSet(entryIndex)} className="w-full mt-3 bg-secondary hover:bg-secondary-hover py-2 rounded-lg font-semibold">Add Set</button>
                                 <textarea
                                    value={entry.notes}
                                    onChange={e => updateNotes(entryIndex, e.target.value)}
                                    placeholder="Add notes for this exercise..."
                                    className="w-full bg-secondary p-2 rounded-lg mt-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary h-20"
                                />
                            </div>
                        );
                    })}
                     <button onClick={() => setIsExerciseModalOpen(true)} className="w-full border-2 border-dashed border-gray-600 text-text-secondary hover:bg-secondary py-3 rounded-lg flex items-center justify-center transition-colors">
                        <PlusIcon className="w-5 h-5 mr-2" /> Add Exercise to Workout
                    </button>
                </main>
                 {isActive && (
                    <div id="timer-display" className="fixed bottom-0 left-0 right-0 bg-surface p-4 text-center z-30 shadow-lg border-t-2 border-primary">
                        <p className="text-2xl font-mono font-bold">
                            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                        </p>
                        <button onClick={stopTimer} className="mt-2 text-sm text-danger font-semibold">Stop Timer</button>
                    </div>
                )}
                <Modal isOpen={isExerciseModalOpen} onClose={() => setIsExerciseModalOpen(false)} title="Select Exercise">
                    {/* Simplified for workout context */}
                    <div className="space-y-2">
                        {exercises.map(ex => (
                            <button key={ex.id} onClick={() => { addExerciseToWorkout(ex.id); setIsExerciseModalOpen(false); }} className="w-full text-left p-3 bg-secondary hover:bg-secondary-hover rounded-lg transition-colors">
                                {ex.name}
                            </button>
                        ))}
                    </div>
                </Modal>
            </div>
        );
    };

    const renderHistory = () => (
        <>
            <Header title="History" onBack={() => setCurrentView('routines')} />
            <main className="p-4 space-y-3">
                {workoutHistory.length === 0 ? (
                    <p className="text-center text-text-secondary py-8">No completed workouts yet.</p>
                ) : (
                    workoutHistory.map(session => {
                        const routineForSession = routines.find(r => r.id === session.routineId);
                        const sessionName = routineForSession?.name || (session.routineId === null ? 'Blank Workout' : 'Deleted Routine');
                        return (
                             <div key={session.id} className="bg-surface rounded-lg p-4 cursor-pointer hover:bg-secondary-hover transition-colors" onClick={() => viewHistoryDetail(session)}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-lg">{sessionName}</p>
                                        <p className="text-sm text-text-secondary">{new Date(session.date).toLocaleString()}</p>
                                    </div>
                                    <ChevronLeftIcon className="w-5 h-5 transform rotate-180" />
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </>
    );

    const renderHistoryDetail = () => {
        if (!viewingHistoryItem) return null;
        
        const routineForDetail = routines.find(r => r.id === viewingHistoryItem.routineId);
        const detailTitle = routineForDetail?.name || (viewingHistoryItem.routineId === null ? 'Blank Workout' : 'Deleted Routine');

        return (
            <>
                <Header title={detailTitle} onBack={() => setCurrentView('history')}>
                    <button onClick={() => deleteHistoryItem(viewingHistoryItem.id)} className="p-2 rounded-full hover:bg-secondary text-danger"><TrashIcon /></button>
                </Header>
                <main className="p-4 space-y-4">
                     <p className="text-center text-text-secondary mb-4">{new Date(viewingHistoryItem.date).toLocaleString()}</p>
                     {viewingHistoryItem.entries.map(entry => {
                         const exercise = exercises.find(e => e.id === entry.exerciseId);
                         if (!exercise) return null;
                         return (
                            <div key={entry.id} className="bg-surface p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-bold">{exercise.name}</h3>
                                    <button onClick={() => showChart(exercise)} className="p-2 rounded-full hover:bg-secondary text-primary"><ChartBarIcon /></button>
                                </div>
                                {entry.notes && <p className="text-sm italic text-text-secondary mb-3 p-2 bg-secondary rounded-md">"{entry.notes}"</p>}
                                <div className="text-sm space-y-1">
                                    {entry.sets.map((set, i) => (
                                        <p key={set.id} className="text-text-secondary"><span className="font-semibold text-text-primary">{i+1}.</span> {set.weight} kg x {set.reps} reps</p>
                                    ))}
                                </div>
                            </div>
                         )
                     })}
                </main>
            </>
        );
    };

    const renderView = () => {
        switch (currentView) {
            case 'workout': return renderActiveWorkout();
            case 'history': return renderHistory();
            case 'routineEditor': return renderRoutineEditor();
            case 'historyDetail': return renderHistoryDetail();
            case 'routines':
            default: return renderRoutines();
        }
    };

    return (
        <div className="bg-background min-h-screen">
            {renderView()}
            <Modal isOpen={isChartModalOpen} onClose={() => setIsChartModalOpen(false)} title="Progress Chart">
                {chartExercise && <ExerciseChart exercise={chartExercise} history={workoutHistory} />}
            </Modal>
             <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="restDuration" className="block text-sm font-medium text-text-secondary">Rest Timer Duration (seconds)</label>
                        <input
                            id="restDuration"
                            type="number"
                            value={restDuration}
                            onChange={e => setRestDuration(parseInt(e.target.value) || 60)}
                            className="mt-1 w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Data Management</h3>
                         <button onClick={handleExport} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            Export Data
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            Import Data
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                    </div>
                </div>
             </Modal>
        </div>
    );
}