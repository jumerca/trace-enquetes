import type { GameState, Notice } from './types';

export function notify(st: GameState, n: Omit<Notice, 'id' | 'read' | 'minute'> & { minute?: number }) {
  st.notices.push({ id: `N${++st.counters.notice}`, read: false, minute: n.minute ?? st.minute, ...n } as Notice);
  if (st.notices.length > 400) st.notices.splice(0, st.notices.length - 400);
}

export function caseLog(st: GameState, caseId: string, text: string, by?: string) {
  const c = st.cases.find((x) => x.id === caseId);
  if (c) c.done.push({ minute: st.minute, text, by });
}
