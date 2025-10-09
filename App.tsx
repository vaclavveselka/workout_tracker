import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import { Exercise, Routine, WorkoutSession, WorkoutSet, SessionEntry, BodyPart } from './types';
import { PlusIcon, ChartBarIcon, TrashIcon, PencilIcon, ChevronLeftIcon, CheckIcon, Cog6ToothIcon, Bars3Icon, ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from './components/Icons';
import { Modal } from './components/Modal';
import { ExerciseChart } from './components/ExerciseChart';
// Recharts needs to be imported, but since we don't have a package manager,
// we will assume it is globally available from a CDN in a real scenario.
// For this code to be valid, we add the imports.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// --- Helper Functions ---
const createId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const BODY_PARTS: BodyPart[] = ['chest', 'back', 'legs', 'arms', 'shoulders', 'belly', 'other'];

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
    const [unfinishedWorkouts, setUnfinishedWorkouts] = useLocalStorage<WorkoutSession[]>('unfinishedWorkouts', []);


    const [currentView, setCurrentView] = useState('routines'); // routines, workout, history, routineEditor, historyDetail, exerciseManagement
    const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
    const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
    const [viewingHistoryItem, setViewingHistoryItem] = useState<WorkoutSession | null>(null);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [exerciseManagementFilter, setExerciseManagementFilter] = useState<BodyPart | 'all'>('all');
    const [activeInput, setActiveInput] = useState<{ entryIndex: number; setIndex: number; type: 'weight' | 'reps' } | null>(null);


    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isEditExerciseModalOpen, setIsEditExerciseModalOpen] = useState(false);
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);
    const [chartExercise, setChartExercise] = useState<Exercise | null>(null);
    const [isDeleteSetConfirmModalOpen, setIsDeleteSetConfirmModalOpen] = useState(false);
    const [setToDelete, setSetToDelete] = useState<{entryIndex: number, setIndex: number} | null>(null);

    // --- Drag and Drop State ---
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    
    // --- Refs ---
    const importFileRef = useRef<HTMLInputElement>(null);

    // --- Data Migration for Exercises ---
    useEffect(() => {
        setExercises(prev => {
            const needsMigration = prev.some(ex => !ex.bodyPart);
            if (needsMigration) {
                return prev.map(ex => ex.bodyPart ? ex : { ...ex, bodyPart: 'other' });
            }
            return prev;
        });
    }, [setExercises]);

    // --- Automatic Workout Save & Resume ---
    useEffect(() => {
        // When activeWorkout changes, update it in the unfinished list
        if (activeWorkout) {
            setUnfinishedWorkouts(prev => {
                const existingIndex = prev.findIndex(w => w.id === activeWorkout.id);
                // Create a deep copy to avoid mutation issues
                const newActiveWorkout = JSON.parse(JSON.stringify(activeWorkout));
                const newWorkouts = [...prev];
                if (existingIndex !== -1) {
                    newWorkouts[existingIndex] = newActiveWorkout;
                } else {
                    newWorkouts.push(newActiveWorkout);
                }
                return newWorkouts;
            });
        }
    }, [activeWorkout, setUnfinishedWorkouts]);

    const resumeWorkout = (workout: WorkoutSession) => {
        setActiveWorkout(JSON.parse(JSON.stringify(workout)));
        setCurrentView('workout');
    };

    const discardWorkout = (workoutId: string) => {
        if (activeWorkout?.id === workoutId) {
            setActiveWorkout(null);
        }
        setUnfinishedWorkouts(prev => prev.filter(w => w.id !== workoutId));
    };

    // --- Timer Logic ---
    const timerAudioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
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
        const allHistory = [...workoutHistory, activeWorkout].filter(Boolean) as WorkoutSession[];
    
        exercises.forEach(exercise => {
            let pr = { weight: 0, reps: 0 };
            allHistory
                .filter(session => session.ended)
                .forEach(session => {
                    const historyEntry = session.entries.find(e => e.exerciseId === exercise.id);
                    if (historyEntry) {
                        historyEntry.sets
                            .filter(s => s.completed)
                            .forEach(set => {
                                if (set.weight > pr.weight) {
                                    pr = { weight: set.weight, reps: set.reps };
                                }
                            });
                    }
                });
            if (pr.weight > 0) {
                records.set(exercise.id, pr);
            }
        });
        return records;
    }, [exercises, workoutHistory, activeWorkout]);
    
    const groupedExercises = useMemo(() => {
        const groups: { [key in BodyPart]?: Exercise[] } = {};
        exercises.forEach(ex => {
            if (!groups[ex.bodyPart]) {
                groups[ex.bodyPart] = [];
            }
            groups[ex.bodyPart]?.push(ex);
        });
        return groups;
    }, [exercises]);

    // --- Data Handlers ---

    // Exercises
    const createAndSaveExercise = (name: string, bodyPart: BodyPart): Exercise | undefined => {
        const exerciseToSave: Exercise = {
            id: createId(),
            name,
            bodyPart,
        };
        if (!name) return undefined;
        
        let success = false;
        setExercises(prev => {
            const existingByName = prev.find(e => e.name.toLowerCase() === name.toLowerCase());
            if (existingByName) {
                alert("An exercise with this name already exists.");
                return prev;
            }
            success = true;
            return [...prev, exerciseToSave];
        });

        return success ? exerciseToSave : undefined;
    };

    const saveExercise = (exercise: Omit<Exercise, 'id'> & { id?: string }) => {
        const exerciseToSave: Exercise = {
            id: exercise.id || createId(),
            name: exercise.name,
            bodyPart: exercise.bodyPart,
        };

        if (!exerciseToSave.name) return; // Basic validation

        setExercises(prev => {
            const existingById = prev.find(e => e.id === exerciseToSave.id);
            const existingByName = prev.find(e => e.name.toLowerCase() === exerciseToSave.name.toLowerCase() && e.id !== exerciseToSave.id);
            if (existingByName) {
                alert("An exercise with this name already exists.");
                return prev;
            }

            if (existingById) {
                return prev.map(e => e.id === exerciseToSave.id ? exerciseToSave : e);
            }
            return [...prev, exerciseToSave];
        });
        setIsEditExerciseModalOpen(false);
        setEditingExercise(null);
    };

    const deleteExercise = (id: string) => {
        if (window.confirm("Are you sure you want to delete this exercise? This will remove it from all routines.")) {
            setExercises(prev => prev.filter(e => e.id !== id));
            // Also remove from routines
            setRoutines(prev => prev.map(r => ({
                ...r,
                exerciseIds: r.exerciseIds.filter(eId => eId !== id)
            })));
        }
    };
    
    const startEditExercise = (exercise: Exercise | null) => {
        setEditingExercise(exercise);
        setIsEditExerciseModalOpen(true);
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
        const lastSession = routine ? workoutHistory
            .filter(s => s.ended && s.routineId === routine.id)
            .sort((a, b) => b.date - a.date)[0]
            : null;

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
        const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout!));
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
        const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout!));
        const originalSet = updatedWorkout.entries[entryIndex].sets[setIndex];
        updatedWorkout.entries[entryIndex].sets[setIndex] = { ...originalSet, ...newSetData };
        
        if (newSetData.completed && !originalSet.completed) {
            startTimer();
        }

        updateActiveWorkout(updatedWorkout);
    };

    const deleteSet = (entryIndex: number, setIndex: number) => {
        const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout!));
        updatedWorkout.entries[entryIndex].sets.splice(setIndex, 1);
        updateActiveWorkout(updatedWorkout);
    };
    
    const handleDeleteSetClick = (entryIndex: number, setIndex: number) => {
        if (!activeWorkout) return;

        const exerciseId = activeWorkout.entries[entryIndex].exerciseId;
        const lastSession = workoutHistory
            .filter(s => s.ended)
            .sort((a,b) => b.date - a.date)
            .find(s => s.entries.some(e => e.exerciseId === exerciseId));
        
        const lastPerformance = lastSession?.entries.find(e => e.exerciseId === exerciseId);
        const lastTimeSet = lastPerformance?.sets.filter(s => s.completed)[setIndex];

        if (lastTimeSet) {
            setSetToDelete({ entryIndex, setIndex });
            setIsDeleteSetConfirmModalOpen(true);
        } else {
            deleteSet(entryIndex, setIndex);
        }
    };

    const addExerciseToWorkout = (exerciseId: string) => {
        const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout!));
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
        const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout!));
        updatedWorkout.entries[entryIndex].notes = notes;
        updateActiveWorkout(updatedWorkout);
    };


    const finishWorkout = () => {
        if (activeWorkout) {
            const finishedWorkout = { ...activeWorkout, ended: true, date: Date.now() };
            finishedWorkout.entries = finishedWorkout.entries.filter(entry => entry.sets.some(s => s.completed));
            if (finishedWorkout.entries.length > 0) {
                 setWorkoutHistory(prev => [finishedWorkout, ...prev]);
            }
            
            setUnfinishedWorkouts(prev => prev.filter(w => w.id !== activeWorkout.id));
            
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

    // --- Drag and Drop Handlers ---
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDrop = (targetIndex: number, array: any[], setter: (newArray: any[]) => void) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        const newArray = [...array];
        const [draggedItem] = newArray.splice(draggedIndex, 1);
        newArray.splice(targetIndex, 0, draggedItem);
        setter(newArray);
        setDraggedIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };
    
    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // Check if the newly focused element is inside the adjuster banner.
        // If it is, we don't close the banner, allowing its buttons to be clicked.
        const banner = document.getElementById('input-adjuster-banner');
        if (banner && banner.contains(e.relatedTarget as Node)) {
            return; // Don't close if focus is moving to the banner itself.
        }
        setActiveInput(null);
    };

    // --- Data Import/Export ---
    const exportData = () => {
        try {
            const data = {
                exercises,
                routines,
                workoutHistory,
                restDuration,
            };
            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
            const link = document.createElement("a");
            link.href = jsonString;
            link.download = `progress-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
        } catch (error) {
            console.error("Failed to export data:", error);
            alert("An error occurred while exporting data.");
        }
    };
    
    const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);

                if (Array.isArray(data.exercises) && Array.isArray(data.routines) && Array.isArray(data.workoutHistory)) {
                    const migratedExercises = data.exercises.map((ex: Exercise) => ({
                        ...ex,
                        bodyPart: ex.bodyPart && BODY_PARTS.includes(ex.bodyPart) ? ex.bodyPart : 'other',
                    }));
                    
                    setExercises(migratedExercises);
                    setRoutines(data.routines);
                    setWorkoutHistory(data.workoutHistory);

                    if (typeof data.restDuration === 'number') {
                        setRestDuration(data.restDuration);
                    }
                    alert("Data imported successfully!");
                    setIsSettingsModalOpen(false);
                } else {
                    throw new Error("Invalid file structure.");
                }
            } catch (error) {
                console.error("Failed to import data:", error);
                alert("Failed to import data. Please ensure the file is a valid backup.");
            } finally {
                if (importFileRef.current) {
                    importFileRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };


    // --- Render Logic ---

    const ExerciseSelectionModal = ({
        isOpen,
        onClose,
        onSelectExercise,
        title,
        showCreateNew = false
    }: {
        isOpen: boolean;
        onClose: () => void;
        onSelectExercise: (exerciseId: string) => void;
        title: string;
        showCreateNew?: boolean;
    }) => {
        const [bodyPartFilter, setBodyPartFilter] = useState<BodyPart | 'all'>('all');
        const [newExerciseName, setNewExerciseName] = useState('');
        const [newExerciseBodyPart, setNewExerciseBodyPart] = useState<BodyPart>('other');

        const handleCreateExercise = (e: React.FormEvent) => {
            e.preventDefault();
            const newExercise = createAndSaveExercise(newExerciseName, newExerciseBodyPart);
            if (newExercise) {
                onSelectExercise(newExercise.id);
                setNewExerciseName('');
                onClose();
            }
        };

        const filteredExercises = exercises.filter(ex => bodyPartFilter === 'all' || ex.bodyPart === bodyPartFilter);

        return (
            <Modal isOpen={isOpen} onClose={onClose} title={title}>
                <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setBodyPartFilter('all')} className={`px-3 py-1 text-sm rounded-full transition-colors capitalize ${bodyPartFilter === 'all' ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'}`}>All</button>
                        {BODY_PARTS.map(part => (
                            <button key={part} onClick={() => setBodyPartFilter(part)} className={`px-3 py-1 text-sm rounded-full transition-colors capitalize ${bodyPartFilter === part ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'}`}>{part}</button>
                        ))}
                    </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {filteredExercises.map(ex => (
                        <button key={ex.id} onClick={() => { onSelectExercise(ex.id); onClose(); }} className="w-full text-left p-3 bg-secondary hover:bg-secondary-hover rounded-lg transition-colors">
                            {ex.name}
                        </button>
                    ))}
                     {filteredExercises.length === 0 && <p className="text-text-secondary text-center py-4">No exercises found for this body part.</p>}
                </div>
                {showCreateNew && (
                    <div className="border-t border-gray-700 pt-4">
                        <p className="font-semibold mb-2">Or create a new one:</p>
                        <form onSubmit={handleCreateExercise} className="space-y-3">
                            <input type="text" value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)} placeholder="New Exercise Name" className="w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"/>
                            <select value={newExerciseBodyPart} onChange={e => setNewExerciseBodyPart(e.target.value as BodyPart)} className="w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary capitalize">
                               {BODY_PARTS.map(part => <option key={part} value={part}>{part}</option>)}
                            </select>
                            <button type="submit" className="w-full bg-primary hover:bg-primary-hover p-2 rounded-lg text-white flex items-center justify-center gap-2"><PlusIcon className="w-5 h-5"/> Create & Add</button>
                        </form>
                    </div>
                )}
            </Modal>
        );
    }

    const renderRoutines = () => (
        <>
            <Header title="Routines">
                 <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-secondary transition-colors"><Cog6ToothIcon /></button>
            </Header>
            <main className="p-4 space-y-4">
                {unfinishedWorkouts.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold mb-3">Unfinished Workouts</h2>
                        <div className="space-y-3">
                            {unfinishedWorkouts.map(workout => {
                                const routine = routines.find(r => r.id === workout.routineId);
                                const workoutName = routine?.name || 'Blank Workout';
                                return (
                                    <div key={workout.id} className="bg-surface rounded-lg shadow p-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg">{workoutName}</h3>
                                            <p className="text-sm text-text-secondary">Started: {new Date(workout.date).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => discardWorkout(workout.id)} className="p-2 rounded-full hover:bg-secondary"><TrashIcon className="w-5 h-5 text-danger" /></button>
                                            <button onClick={() => resumeWorkout(workout)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">Resume</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

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
                <button onClick={() => setCurrentView('history')} className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-lg transition-colors mt-6">View Workout History</button>
                <button
                    onClick={() => startWorkout(null)}
                    className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors mt-4"
                >
                    <PlusIcon className="w-5 h-5 mr-2" /> Start Blank Workout
                </button>
            </main>
        </>
    );

    const renderRoutineEditor = () => {
        if (!editingRoutine) return null;
        const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setEditingRoutine({ ...editingRoutine, name: e.target.value });

        const onRemoveExercise = (exerciseId: string) => {
            setEditingRoutine({ ...editingRoutine, exerciseIds: editingRoutine.exerciseIds.filter(id => id !== exerciseId) });
        };

        const onAddExercise = (exerciseId: string) => {
            if (!editingRoutine.exerciseIds.includes(exerciseId)) {
                setEditingRoutine({ ...editingRoutine, exerciseIds: [...editingRoutine.exerciseIds, exerciseId] });
            }
        };
        
        return (
            <>
                <Header title={editingRoutine.id ? 'Edit Routine' : 'New Routine'} onBack={() => setCurrentView('routines')}>
                    <button onClick={() => saveRoutine(editingRoutine)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">Save</button>
                </Header>
                <main className="p-4 space-y-4">
                    <input type="text" value={editingRoutine.name} onChange={onNameChange} placeholder="Routine Name" className="w-full bg-secondary p-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"/>
                    <h3 className="text-lg font-semibold mt-4">Exercises</h3>
                     <div 
                        className="space-y-2"
                        onDragOver={(e) => e.preventDefault()}
                     >
                        {editingRoutine.exerciseIds.map((id, index) => {
                            const exercise = exercises.find(e => e.id === id);
                            const isDragging = draggedIndex === index;
                            return (
                                <div 
                                    key={id} 
                                    className={`bg-surface p-3 rounded-lg flex justify-between items-center transition-opacity ${isDragging ? 'opacity-50' : 'opacity-100'}`}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDrop={() => handleDrop(index, editingRoutine.exerciseIds, (newIds) => setEditingRoutine({...editingRoutine, exerciseIds: newIds as string[]}))}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="flex items-center gap-3">
                                        <Bars3Icon className="w-5 h-5 text-text-secondary cursor-grab" />
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
                <ExerciseSelectionModal 
                    isOpen={isExerciseModalOpen}
                    onClose={() => setIsExerciseModalOpen(false)}
                    onSelectExercise={onAddExercise}
                    title="Add Exercise to Routine"
                    showCreateNew={true}
                />
            </>
        );
    };

    const renderActiveWorkout = () => {
        if (!activeWorkout) return null;

        const activeRoutine = routines.find(r => r.id === activeWorkout.routineId);
        const workoutTitle = activeRoutine?.name || (activeWorkout.routineId === null ? 'Blank Workout' : 'Workout');
        
        const lastSessionForExercise = (exerciseId: string) => workoutHistory
            .filter(s => s.ended)
            .sort((a,b) => b.date - a.date)
            .find(s => s.entries.some(e => e.exerciseId === exerciseId));
        
        const handleAdjustValue = (adjustment: number) => {
            if (!activeInput || !activeWorkout) return;

            const { entryIndex, setIndex, type } = activeInput;
            const currentSet = activeWorkout.entries[entryIndex].sets[setIndex];
            
            if (type === 'weight') {
                const newValue = Math.max(0, currentSet.weight + adjustment);
                updateSet(entryIndex, setIndex, { weight: newValue });
            } else if (type === 'reps') {
                const newValue = Math.max(0, currentSet.reps + adjustment);
                updateSet(entryIndex, setIndex, { reps: newValue });
            }
        };

        const renderInputAdjusterBanner = () => {
            if (!activeInput || !activeWorkout) return null;
            const { entryIndex, setIndex, type } = activeInput;
            const currentSet = activeWorkout.entries[entryIndex]?.sets[setIndex];
            if (!currentSet) return null;

            const currentValue = currentSet[type];
            const increment = type === 'weight' ? 0.5 : 1;

            return (
                <div id="input-adjuster-banner" className="fixed bottom-0 left-0 right-0 bg-surface border-t-2 border-primary p-3 z-40 flex items-center justify-around shadow-lg">
                     <button onClick={() => handleAdjustValue(-increment)} className="w-16 h-16 bg-secondary hover:bg-secondary-hover rounded-full text-4xl font-bold flex items-center justify-center transition-colors">-</button>
                     <div className="text-center">
                        <p className="text-sm uppercase text-text-secondary">{type}</p>
                        <p className="text-2xl font-bold">{currentValue} <span className="text-base text-text-secondary">{type === 'weight' ? 'kg' : ''}</span></p>
                     </div>
                     <button onClick={() => handleAdjustValue(increment)} className="w-16 h-16 bg-secondary hover:bg-secondary-hover rounded-full text-4xl font-bold flex items-center justify-center transition-colors">+</button>
                     <button onClick={() => setActiveInput(null)} className="absolute top-1 right-1 p-2 text-text-secondary hover:text-white">
                         <XMarkIcon className="w-5 h-5"/>
                     </button>
                </div>
            )
        }

        return (
            <div className="flex flex-col h-screen">
                <Header title={workoutTitle} onBack={() => { setActiveWorkout(null); setCurrentView('routines'); }}>
                    <button onClick={finishWorkout} className="bg-success text-white font-bold py-2 px-4 rounded-lg">Finish</button>
                </Header>
                <main 
                    className="flex-grow p-4 space-y-6 overflow-y-auto pb-48"
                    onDragOver={(e) => e.preventDefault()}
                >
                    <div className="mb-4">
                        <label htmlFor="restDurationWorkout" className="block text-sm font-medium text-text-secondary">Rest Timer (seconds)</label>
                        <input
                            id="restDurationWorkout"
                            type="number"
                            value={restDuration}
                            onChange={e => setRestDuration(parseInt(e.target.value) || 60)}
                             onFocus={(e) => { e.target.select(); setActiveInput(null); }}
                            className="mt-1 w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    {activeWorkout.entries.map((entry, entryIndex) => {
                        const exercise = exercises.find(e => e.id === entry.exerciseId);
                        const lastSession = lastSessionForExercise(entry.exerciseId);
                        const lastPerformance = lastSession?.entries.find(e => e.exerciseId === entry.exerciseId);
                        const completedLastSets = lastPerformance?.sets.filter(s => s.completed) || [];
                        const pr = personalRecords.get(entry.exerciseId);
                        const isDragging = draggedIndex === entryIndex;

                        return (
                            <div 
                                key={entry.id} 
                                className={`bg-surface p-4 rounded-lg transition-opacity ${isDragging ? 'opacity-50' : 'opacity-100'}`}
                                draggable
                                onDragStart={() => handleDragStart(entryIndex)}
                                onDrop={() => handleDrop(entryIndex, activeWorkout.entries, (newEntries) => updateActiveWorkout({...activeWorkout, entries: newEntries as SessionEntry[]}))}
                                onDragEnd={handleDragEnd}
                             >
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <Bars3Icon className="w-5 h-5 text-text-secondary cursor-grab" />
                                        <h3 className="text-xl font-bold">{exercise?.name}</h3>
                                    </div>
                                    {exercise && (
                                        <button onClick={() => showChart(exercise)} className="p-2 rounded-full hover:bg-secondary text-primary">
                                            <ChartBarIcon />
                                        </button>
                                    )}
                                </div>
                                
                                {pr && (
                                    <div className="mb-3 text-center">
                                        <p className="text-sm font-semibold text-text-secondary">
                                            Personal Record: <span className="text-base font-bold text-text-primary">{pr.weight}kg x {pr.reps}</span>
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2 text-center">
                                    <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-text-secondary px-1">
                                        <div className="col-span-1 text-left">SET</div>
                                        <div className="col-span-3">LAST TIME</div>
                                        <div className="col-span-2">WEIGHT (kg)</div>
                                        <div className="col-span-2">REPS</div>
                                        <div className="col-span-2">✓</div>
                                        <div className="col-span-2"></div>
                                    </div>
                                    {entry.sets.map((set, setIndex) => {
                                        const lastTimeSet = completedLastSets[setIndex];
                                        return (
                                            <div key={set.id} className={`grid grid-cols-12 gap-2 items-center p-1 rounded-md ${set.completed ? 'bg-green-900 bg-opacity-30' : ''}`}>
                                                <div className="col-span-1 font-bold text-left">{setIndex + 1}</div>
                                                <div className="col-span-3 text-sm text-text-secondary">
                                                    {lastTimeSet ? `${lastTimeSet.weight}kg x ${lastTimeSet.reps}` : '-'}
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                     <input type="number" value={set.weight} onChange={e => updateSet(entryIndex, setIndex, { weight: parseFloat(e.target.value) || 0 })} onFocus={(e) => { e.target.select(); setActiveInput({ entryIndex, setIndex, type: 'weight' }); }} onBlur={handleInputBlur} className="w-full text-center bg-secondary p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                     <input type="number" value={set.reps} onChange={e => updateSet(entryIndex, setIndex, { reps: parseInt(e.target.value) || 0 })} onFocus={(e) => { e.target.select(); setActiveInput({ entryIndex, setIndex, type: 'reps' }); }} onBlur={handleInputBlur} className="w-full text-center bg-secondary p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    <button onClick={() => updateSet(entryIndex, setIndex, { completed: !set.completed })} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${set.completed ? 'bg-success text-white' : 'border-2 border-gray-500'}`}>
                                                        {set.completed && <CheckIcon className="w-6 h-6" />}
                                                    </button>
                                                </div>
                                                <div className="col-span-2 flex justify-center">
                                                    <button onClick={() => handleDeleteSetClick(entryIndex, setIndex)} className="p-1 text-gray-500 hover:text-danger rounded-full">
                                                        <TrashIcon className="w-5 h-5"/>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button onClick={() => addSet(entryIndex)} className="w-full mt-3 bg-secondary hover:bg-secondary-hover py-2 rounded-lg font-semibold">Add Set</button>
                                 <textarea
                                    value={entry.notes}
                                    onChange={e => updateNotes(entryIndex, e.target.value)}
                                    onFocus={() => setActiveInput(null)}
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
                {renderInputAdjusterBanner()}
                <ExerciseSelectionModal
                    isOpen={isExerciseModalOpen}
                    onClose={() => setIsExerciseModalOpen(false)}
                    onSelectExercise={addExerciseToWorkout}
                    title="Add Exercise to Workout"
                    showCreateNew={true}
                />
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

    const renderExerciseManagement = () => {
        const partsToRender = exerciseManagementFilter === 'all' ? BODY_PARTS : [exerciseManagementFilter];
        return (
            <>
                <Header title="Manage Exercises" onBack={() => setCurrentView('routines')}>
                    <button onClick={() => startEditExercise(null)} className="bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">Add New</button>
                </Header>
                <main className="p-4 space-y-6">
                    <div className="mb-4 sticky top-[72px] bg-background py-3 z-10">
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button onClick={() => setExerciseManagementFilter('all')} className={`px-3 py-1 text-sm rounded-full transition-colors capitalize ${exerciseManagementFilter === 'all' ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'}`}>All</button>
                            {BODY_PARTS.map(part => (
                                <button key={part} onClick={() => setExerciseManagementFilter(part)} className={`px-3 py-1 text-sm rounded-full transition-colors capitalize ${exerciseManagementFilter === part ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'}`}>{part}</button>
                            ))}
                        </div>
                    </div>

                    {partsToRender.map(part => {
                        const partExercises = groupedExercises[part];
                        if (!partExercises || partExercises.length === 0) return null;
                        
                        return (
                            <div key={part}>
                                <h2 className="text-xl font-bold capitalize mb-3 border-b-2 border-primary pb-1">{part}</h2>
                                <div className="space-y-2">
                                    {partExercises.map(ex => (
                                        <div key={ex.id} className="bg-surface p-3 rounded-lg flex justify-between items-center">
                                            <span className="font-semibold">{ex.name}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => startEditExercise(ex)} className="p-2 rounded-full hover:bg-secondary text-text-secondary"><PencilIcon className="w-5 h-5" /></button>
                                                <button onClick={() => deleteExercise(ex.id)} className="p-2 rounded-full hover:bg-secondary text-danger"><TrashIcon className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                     {exercises.length === 0 && <p className="text-text-secondary text-center py-8">No exercises created yet.</p>}
                     {exerciseManagementFilter !== 'all' && !groupedExercises[exerciseManagementFilter] && (
                        <p className="text-text-secondary text-center py-8">No exercises found for this body part.</p>
                     )}
                </main>
            </>
        );
    }
    
    const EditExerciseModal = () => {
        const [name, setName] = useState('');
        const [bodyPart, setBodyPart] = useState<BodyPart>('other');
        
        useEffect(() => {
            if (editingExercise) {
                setName(editingExercise.name);
                setBodyPart(editingExercise.bodyPart);
            } else {
                setName('');
                setBodyPart('other');
            }
        }, [editingExercise]);
        
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            saveExercise({ id: editingExercise?.id, name, bodyPart });
        };
        
        return (
             <Modal isOpen={isEditExerciseModalOpen} onClose={() => setIsEditExerciseModalOpen(false)} title={editingExercise ? "Edit Exercise" : "Add Exercise"}>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                         <label htmlFor="exerciseName" className="block text-sm font-medium text-text-secondary mb-1">Exercise Name</label>
                         <input id="exerciseName" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"/>
                     </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Body Part</label>
                        <div className="flex flex-wrap gap-2">
                            {BODY_PARTS.map(part => (
                                <button
                                    key={part}
                                    type="button"
                                    onClick={() => setBodyPart(part)}
                                    className={`px-3 py-1.5 text-sm rounded-full transition-colors capitalize ${
                                        bodyPart === part ? 'bg-primary text-white' : 'bg-secondary hover:bg-secondary-hover'
                                    }`}
                                >
                                    {part}
                                </button>
                            ))}
                        </div>
                     </div>
                     <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors mt-4">Save Exercise</button>
                 </form>
             </Modal>
        )
    };

    const renderView = () => {
        switch (currentView) {
            case 'workout': return renderActiveWorkout();
            case 'history': return renderHistory();
            case 'routineEditor': return renderRoutineEditor();
            case 'historyDetail': return renderHistoryDetail();
            case 'exerciseManagement': return renderExerciseManagement();
            case 'routines':
            default: return renderRoutines();
        }
    };

    return (
        <div className="bg-background min-h-screen">
            {renderView()}
            <EditExerciseModal />
            <Modal isOpen={isChartModalOpen} onClose={() => setIsChartModalOpen(false)} title="Progress Chart">
                {chartExercise && <ExerciseChart exercise={chartExercise} history={workoutHistory} />}
            </Modal>
             <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="restDuration" className="block text-sm font-medium text-text-secondary">Default Rest Timer (seconds)</label>
                        <input
                            id="restDuration"
                            type="number"
                            value={restDuration}
                            onChange={e => setRestDuration(parseInt(e.target.value) || 60)}
                            onFocus={(e) => e.target.select()}
                            className="mt-1 w-full bg-secondary p-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="border-t border-gray-700 pt-6">
                        <h3 className="text-lg font-semibold text-text-primary mb-3">Exercises</h3>
                         <button onClick={() => { setCurrentView('exerciseManagement'); setIsSettingsModalOpen(false); }} className="w-full bg-secondary hover:bg-secondary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">
                            Manage Exercises
                         </button>
                    </div>
                    <div className="border-t border-gray-700 pt-6">
                        <h3 className="text-lg font-semibold text-text-primary mb-2">Data Management</h3>
                        <p className="text-sm text-text-secondary mb-4">Save your workout data to a file or load it from a backup.</p>
                        <div className="flex gap-4">
                            <button onClick={() => importFileRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                <ArrowDownTrayIcon className="w-5 h-5"/> Import Data
                            </button>
                            <input type="file" accept=".json" ref={importFileRef} onChange={importData} className="hidden" />
                            <button onClick={exportData} className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                <ArrowUpTrayIcon className="w-5 h-5" /> Export Data
                            </button>
                        </div>
                    </div>
                </div>
             </Modal>
             <Modal isOpen={isDeleteSetConfirmModalOpen} onClose={() => setIsDeleteSetConfirmModalOpen(false)} title="Delete Set?">
                <p className="text-text-secondary mb-6">This set has historical data from your last workout. Are you sure you want to delete it?</p>
                <div className="flex justify-end gap-4">
                    <button onClick={() => setIsDeleteSetConfirmModalOpen(false)} className="bg-secondary hover:bg-secondary-hover px-4 py-2 rounded-lg">Cancel</button>
                    <button onClick={() => {
                        if (setToDelete) {
                            deleteSet(setToDelete.entryIndex, setToDelete.setIndex);
                        }
                        setIsDeleteSetConfirmModalOpen(false);
                        setSetToDelete(null);
                    }} className="bg-danger hover:bg-danger-hover text-white px-4 py-2 rounded-lg">Delete</button>
                </div>
            </Modal>
        </div>
    );
}
