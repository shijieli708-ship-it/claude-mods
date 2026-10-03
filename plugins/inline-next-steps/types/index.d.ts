export type Step = { label: string; prompt: string }

declare module 'claude-code' {
  interface PluginState {
    'inline-next-steps': { steps: Step[]; selected: number[] }
  }
}
