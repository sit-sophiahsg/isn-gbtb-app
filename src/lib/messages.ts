import type { Outcome } from './outbox'
import type { Checkpoint } from './types'

export type Tone = 'ok' | 'warn' | 'error'

/** Turn a finished outbox item into a short message for the participant. */
export function describeOutcome(o: Outcome, checkpoints: Checkpoint[]): { text: string; tone: Tone } | null {
  const cpName = (id: unknown) => checkpoints.find((c) => c.id === id)?.name ?? 'checkpoint'
  if (o.type === 'failed') {
    if (o.error?.includes('invalid_group'))
      return { text: 'Your group was not found. Please re-join with your group code.', tone: 'error' }
    return { text: `Couldn't save that (${o.error ?? 'unknown error'}). Ask your EXCO leader for a manual stamp.`, tone: 'error' }
  }
  const r = o.result
  if (!r) return null
  const name = (r.name as string | undefined) ?? cpName(r.checkpoint_id)
  switch (o.item.kind) {
    case 'answer':
      if (r.status === 'correct') return { text: `Correct! +${r.points} points`, tone: 'ok' }
      if (r.status === 'out_of_tries') return { text: 'Out of tries. The stamp still counts, but scores 0 points.', tone: 'warn' }
      if (r.status === 'wrong') return { text: `Not quite. ${3 - Number(r.attempts)} tries left.`, tone: 'warn' }
      if (r.status === 'no_stamp') return { text: 'Collect the stamp before answering the question.', tone: 'warn' }
      return null
    case 'photo':
      if (r.status === 'saved') return { text: 'Photo uploaded to the gallery.', tone: 'ok' }
      break
  }
  switch (r.status) {
    case 'stamped': return { text: `Stamp collected: ${name}!`, tone: 'ok' }
    case 'already': return { text: `You already have the ${name} stamp.`, tone: 'ok' }
    case 'invalid': return { text: "That QR code isn't a checkpoint for this rally.", tone: 'error' }
    case 'wrong_method': return { text: `${name} is a photo checkpoint. Take a photo instead.`, tone: 'warn' }
    case 'not_started': return { text: "The rally hasn't started yet, so that stamp didn't count.", tone: 'warn' }
    case 'too_late': return { text: `Time was up, so the ${name} stamp didn't count.`, tone: 'error' }
    case 'bad_pin': return { text: 'Wrong leader PIN. The manual stamp was not given.', tone: 'error' }
  }
  return null
}
