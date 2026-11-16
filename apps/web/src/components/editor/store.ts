'use client';

import { createStore } from 'zustand/vanilla';
import type { Design } from '@mw/engine';

export type Selection = { kind: 'cabinet' } | { kind: 'zone'; id: string } | { kind: 'part'; key: string };

interface Snapshot {
  design: Design;
  methodId: string;
  quantity: number;
}

export interface EditorState extends Snapshot {
  name: string;
  past: Snapshot[];
  future: Snapshot[];
  selection: Selection;
  hover: string | null;
  view: { ortho: boolean; wire: boolean; cameraKey: number };
  /** Cambia el diseño y lo apunta en el historial. */
  apply: (fn: (d: Design) => Design) => void;
  setMeta: (patch: Partial<Pick<Snapshot, 'methodId' | 'quantity'>>) => void;
  setName: (name: string) => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  setHover: (id: string | null) => void;
  setView: (patch: Partial<EditorState['view']>) => void;
  resetCamera: () => void;
}

const HISTORY = 100;

export function createEditorStore(init: { name: string; design: Design; methodId: string; quantity: number }) {
  return createStore<EditorState>()((set, get) => {
    const snap = (): Snapshot => ({ design: get().design, methodId: get().methodId, quantity: get().quantity });
    const push = (next: Partial<Snapshot>) =>
      set((s) => ({ ...next, past: [...s.past.slice(-HISTORY + 1), snap()], future: [] }));

    return {
      ...init,
      past: [],
      future: [],
      selection: { kind: 'cabinet' },
      hover: null,
      view: { ortho: false, wire: false, cameraKey: 0 },

      apply: (fn) => {
        const next = fn(get().design);
        if (next !== get().design) push({ design: next });
      },
      setMeta: (patch) => push(patch),
      setName: (name) => set({ name }),
      undo: () =>
        set((s) => {
          const prev = s.past[s.past.length - 1];
          if (!prev) return s;
          return { ...prev, past: s.past.slice(0, -1), future: [snap(), ...s.future] };
        }),
      redo: () =>
        set((s) => {
          const next = s.future[0];
          if (!next) return s;
          return { ...next, future: s.future.slice(1), past: [...s.past, snap()] };
        }),
      select: (selection) => set({ selection }),
      setHover: (hover) => set({ hover }),
      setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
      resetCamera: () => set((s) => ({ view: { ...s.view, cameraKey: s.view.cameraKey + 1 } })),
    };
  });
}

export type EditorStore = ReturnType<typeof createEditorStore>;
