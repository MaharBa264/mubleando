'use client';

import { createStore } from 'zustand/vanilla';
import type { RoomPlan } from '@mw/engine';

export type RoomSelection =
  | { kind: 'none' }
  | { kind: 'wall'; index: number }
  | { kind: 'opening'; id: string }
  | { kind: 'placement'; id: string }
  | { kind: 'block'; id: string };

export interface RoomState {
  name: string;
  plan: RoomPlan;
  past: RoomPlan[];
  future: RoomPlan[];
  selection: RoomSelection;
  view: 'plan' | 'elevation' | '3d';
  /** Índice de la pared activa en la vista de alzado. */
  elevationWall: number;
  /** Cambia la planta y lo apunta en el historial (deshacer / rehacer). */
  apply: (fn: (p: RoomPlan) => RoomPlan) => void;
  /** Cambia la planta sin apuntar en el historial (mientras se arrastra algo). */
  preview: (fn: (p: RoomPlan) => RoomPlan) => void;
  /** Cierra un arrastre: apunta en el historial el estado de antes de empezar. */
  commit: (before: RoomPlan) => void;
  setName: (name: string) => void;
  undo: () => void;
  redo: () => void;
  select: (s: RoomSelection) => void;
  setView: (v: RoomState['view']) => void;
  setElevationWall: (index: number) => void;
}

const HISTORY = 100;

export function createRoomStore(init: { name: string; plan: RoomPlan }) {
  return createStore<RoomState>()((set, get) => ({
    ...init,
    past: [],
    future: [],
    selection: { kind: 'none' },
    view: 'plan',
    elevationWall: 0,
    apply: (fn) => {
      const prev = get().plan;
      const next = fn(prev);
      if (next !== prev) set((s) => ({ plan: next, past: [...s.past.slice(-HISTORY + 1), prev], future: [] }));
    },
    preview: (fn) => set((s) => ({ plan: fn(s.plan) })),
    commit: (before) => {
      if (before !== get().plan) set((s) => ({ past: [...s.past.slice(-HISTORY + 1), before], future: [] }));
    },
    setName: (name) => set({ name }),
    undo: () =>
      set((s) => {
        const prev = s.past[s.past.length - 1];
        if (!prev) return s;
        return { plan: prev, past: s.past.slice(0, -1), future: [s.plan, ...s.future] };
      }),
    redo: () =>
      set((s) => {
        const next = s.future[0];
        if (!next) return s;
        return { plan: next, future: s.future.slice(1), past: [...s.past, s.plan] };
      }),
    select: (selection) =>
      set((s) => ({
        selection,
        elevationWall: selection.kind === 'wall' ? selection.index : s.elevationWall,
      })),
    setView: (view) => set({ view }),
    setElevationWall: (elevationWall) => set({ elevationWall }),
  }));
}

export type RoomStore = ReturnType<typeof createRoomStore>;
