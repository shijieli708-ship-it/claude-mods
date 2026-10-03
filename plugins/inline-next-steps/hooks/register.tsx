import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Step } from '../types'

// The steps the last answer listed, and which of them are ticked, by index.
const steps = atom({ plugin: 'inline-next-steps', key: 'steps' } as const, [] as Step[])
const selected = atom({ plugin: 'inline-next-steps', key: 'selected' } as const, [] as number[])

const MAX = 6
const OPEN = '<next-steps>'
const CLOSE = '</next-steps>'

// Fixed text, so every prompt carries the same bytes and the cache keeps them.
const INSTRUCTIONS = `# Next steps

When you finish a turn with your final answer to the user in the main conversation, end it with a block listing what the user might reasonably ask you to do next:

${OPEN}
- short label | the full request, as the user would type it
${CLOSE}

- For work (code, files, tasks): 2 to ${MAX} items, distinct and specific to this conversation; the most useful first. The request names the concrete files, commands or values involved.
- For a plain question (an explanation, a fact, a concept): 1 to 3 follow-up questions that go deeper or sideways from your answer, each phrased as the question the user would ask.
- Label: at most 5 words. Request: one or two sentences.
- Write both in the language the user writes in.
- Only in a final answer. Never in progress notes between tool calls, never as a subagent, and leave it out when nothing useful follows (a greeting, a thank-you, a yes/no confirmation).
- The user does not see this block as text: it is turned into buttons. Do not refer to it.`

// Removes the block from a text, including a block still streaming in (no closing tag yet).
function strip(text: string): string {
  const start = text.indexOf(OPEN)
  if (start === -1) return text
  const end = text.indexOf(CLOSE, start)
  const rest = end === -1 ? '' : text.slice(end + CLOSE.length)
  return (text.slice(0, start) + rest).replace(/\s+$/, '')
}

function parse(answer: string): Step[] {
  const start = answer.lastIndexOf(OPEN)
  if (start === -1) return []
  const end = answer.indexOf(CLOSE, start)
  if (end === -1) return []
  return answer
    .slice(start + OPEN.length, end)
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(line => line !== '')
    .map(line => {
      const bar = line.indexOf('|')
      const label = (bar === -1 ? line : line.slice(0, bar)).trim()
      const prompt = (bar === -1 ? line : line.slice(bar + 1)).trim() || label
      return { label, prompt }
    })
    .filter(s => s.label !== '')
    .slice(0, MAX)
}

export const register: Register = on => {
  // A new request makes the old steps stale. The instructions ride the prompt as context the
  // user never sees: the desktop app's main system prompt does not pass through prompt.compose.
  on('prompt.submit', async ($, e, next) => {
    if (e.turnId) return next(e)
    void Promise.all([update($, steps, () => []), update($, selected, () => [])])
    // Only where the mod can draw the buttons; elsewhere the block would show as raw text.
    const surfaces = await $.session.surfaces()
    const canDraw = surfaces.includes('terminal') || surfaces.includes('desktop')
    if (!canDraw) return next(e)
    return next({ ...e, context: [...(e.context ?? []), INSTRUCTIONS] })
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      const found = e.reason === 'answer' ? parse(e.answer) : []
      await Promise.all([update($, steps, () => found), update($, selected, () => [])])
    }
    return result
  })

  // Hide the block in the transcript. This changes the drawing only; the stored message is untouched.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = strip(e.props.text)
    if (text === e.props.text) return next(e)
    return next({ ...e, props: { ...e.props, text } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const [list, picked] = await Promise.all([read($, steps), read($, selected)])
    if (list.length === 0) return next(e)

    const inner = await next(e)
    const { Box, Text, Button } = $.ui.resolve(e)

    const toggle = (i: number) =>
      update($, selected, l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i].sort((a, b) => a - b)))

    // Puts the ticked requests in the prompt box for the user to read and send.
    const fill = async () => {
      const chosen = picked.map(i => list[i]).filter(Boolean)
      if (chosen.length === 0) return
      const text = chosen.length === 1 ? chosen[0].prompt : chosen.map((s, i) => `${i + 1}. ${s.prompt}`).join('\n')
      const filled = await $.prompt.fill({ text })
      if (!filled.isFilled) {
        $.ui.toast('The prompt box is busy; try again')
        return
      }
      await update($, selected, () => [])
    }

    const item = (s: Step, i: number) => (
      <Button
        key={`step-${i}`}
        label={`${picked.includes(i) ? '☑' : '☐'} ${s.label}`}
        plain
        dimColor={!picked.includes(i)}
        onPress={() => toggle(i)}
      />
    )
    const half = Math.ceil(list.length / 2)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={3}>
          <Box flexDirection="column">{list.slice(0, half).map((s, i) => item(s, i))}</Box>
          <Box flexDirection="column">{list.slice(half).map((s, i) => item(s, i + half))}</Box>
        </Box>
        <Box flexDirection="row" columnGap={2}>
          {picked.length > 0 ? (
            <Button key="fill" label={picked.length === 1 ? 'Put in prompt' : `Put ${picked.length} in prompt`} variant="primary" onPress={fill} />
          ) : (
            <Text dimColor>Tick next steps, then put them in the prompt</Text>
          )}
          <Button key="dismiss" label="Dismiss" plain dimColor onPress={() => update($, steps, () => [])} />
        </Box>
        {inner}
      </Box>
    )
  })
}
