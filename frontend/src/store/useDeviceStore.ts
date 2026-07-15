import { useMemo } from 'react';
import { create } from 'zustand';
import type { DeviceState } from '../types/device';

interface DeviceStoreState {
  devices: Map<string, DeviceState>;
  patchMany: (states: DeviceState[]) => void;
  setAll: (states: DeviceState[]) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: new Map(),
  patchMany: (states) =>
    set((prev) => {
      const next = new Map(prev.devices);
      for (const state of states) {
        next.set(state.clientId, state);
      }
      return { devices: next };
    }),
  setAll: (states) => set({ devices: new Map(states.map((s) => [s.clientId, s])) }),
}));

/**
 * `devices` (the Map) is only replaced on an actual update, so selecting it
 * directly is a stable snapshot for useSyncExternalStore. The array
 * conversion happens here in useMemo, not inside the Zustand selector --
 * returning a fresh array from the selector itself would give React a new
 * reference on every call and trigger an infinite re-render loop.
 */
export function useDeviceList(): DeviceState[] {
  const devices = useDeviceStore((s) => s.devices);
  return useMemo(() => [...devices.values()], [devices]);
}
