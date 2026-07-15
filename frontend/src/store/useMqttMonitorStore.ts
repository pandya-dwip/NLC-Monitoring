import { create } from 'zustand';
import type { MqttMessageEvent } from '../types/mqtt';

const MAX_EVENTS = 500;

interface MqttMonitorState {
  events: MqttMessageEvent[];
  droppedTotal: number;
  append: (events: MqttMessageEvent[], droppedCount: number) => void;
  hydrate: (events: MqttMessageEvent[]) => void;
}

export const useMqttMonitorStore = create<MqttMonitorState>((set) => ({
  events: [],
  droppedTotal: 0,
  append: (events, droppedCount) =>
    set((prev) => ({
      events: [...prev.events, ...events].slice(-MAX_EVENTS),
      droppedTotal: prev.droppedTotal + droppedCount,
    })),
  hydrate: (events) => set((prev) => ({ events: events.slice(-MAX_EVENTS), droppedTotal: prev.droppedTotal })),
}));
