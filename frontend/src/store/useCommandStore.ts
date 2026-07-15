import { create } from 'zustand';
import type { CommandReceivedEvent } from '../types/command';

const MAX_COMMANDS = 200;

interface CommandStoreState {
  commands: CommandReceivedEvent[];
  append: (commands: CommandReceivedEvent[]) => void;
  hydrate: (commands: CommandReceivedEvent[]) => void;
}

export const useCommandStore = create<CommandStoreState>((set) => ({
  commands: [],
  append: (commands) => set((prev) => ({ commands: [...prev.commands, ...commands].slice(-MAX_COMMANDS) })),
  hydrate: (commands) => set({ commands: commands.slice(-MAX_COMMANDS) }),
}));
