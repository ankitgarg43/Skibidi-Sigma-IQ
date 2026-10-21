import { DuelPayload, Question } from '../types';

// Friend-duel encoding: a frozen question set + the creator's result, packed
// into a URL-safe string. Anyone opening the link (or pasting the code) takes
// the exact same questions, then sees a head-to-head comparison.
// Casual/friendly by design: the answers travel with the set (base64 is an
// envelope, not encryption), so this is for bragging rights, not secure exams.

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeChallenge(payload: DuelPayload): string {
  // Keep the code compact: explanations are dropped from the travelling set;
  // the challenger still gets explanations for paste sets at review time
  // only when they match a local bank question — otherwise the source sentence
  // field (paste mode) is kept because it doubles as the explanation.
  const slim: DuelPayload = {
    ...payload,
    questions: payload.questions.map((q) => ({
      ...q,
      explanation: q.source ? q.explanation : '',
    })),
  };
  return toBase64Url(JSON.stringify(slim));
}

export function decodeChallenge(code: string): DuelPayload | null {
  try {
    const parsed = JSON.parse(fromBase64Url(code.trim()));
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.questions)) return null;
    const questions: Question[] = parsed.questions.map((q: Question, i: number) => ({
      ...q,
      id: i,
      explanation: q.explanation || 'No explanation was included with this challenge set.',
    }));
    return { ...parsed, questions };
  } catch {
    return null;
  }
}

export function challengeLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#duel=${code}`;
}

export function challengeFromLocation(): DuelPayload | null {
  const hash = window.location.hash || '';
  const m = hash.match(/#duel=([A-Za-z0-9\-_]+)/);
  return m ? decodeChallenge(m[1]) : null;
}
