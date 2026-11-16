'use client';

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { ComputeResult, Material, Method } from '@mw/engine';
import type { EditorState, EditorStore } from './store';

export interface EditorEnv {
  store: EditorStore;
  result: ComputeResult;
  materials: Material[];
  methods: Method[];
  method: Method;
  labels: Map<string, { short: string; full: string }>;
}

export const EditorContext = createContext<EditorEnv | null>(null);

export function useEnv(): EditorEnv {
  const env = useContext(EditorContext);
  if (!env) throw new Error('useEnv fuera del editor');
  return env;
}

export function useEditor<T>(sel: (s: EditorState) => T): T {
  return useStore(useEnv().store, sel);
}
