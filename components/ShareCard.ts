import { QuizResult } from '../types';

// Draws a 1200x630 share card on a canvas and downloads it as a PNG.
// No server, no image assets — everything is drawn from the result data.

export interface ShareCardOpts {
  title: string;
  subtitle: string;
  name: string;
  result: QuizResult;
  pro: boolean;
}

export function downloadShareCard(opts: ShareCardOpts): void {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { pro, result } = opts;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  if (pro) { bg.addColorStop(0, '#f8fafc'); bg.addColorStop(1, '#e2e8f0'); }
  else { bg.addColorStop(0, '#0a0a0f'); bg.addColorStop(0.55, '#131022'); bg.addColorStop(1, '#0b1a0b'); }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = pro ? '#0f766e' : '#a3e635';
  ctx.fillRect(0, 0, W, 10);

  const ink = pro ? '#0f172a' : '#ffffff';
  const sub = pro ? '#475569' : '#94a3b8';
  const accent = pro ? '#0f766e' : '#a3e635';
  const accent2 = pro ? '#2563eb' : '#e879f9';

  ctx.fillStyle = sub;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(pro ? 'TEST ANYTHING — RESULT' : 'SKIBIDI SIGMA IQ+ — THE VERDICT', 60, 84);

  ctx.fillStyle = ink;
  ctx.font = '900 54px system-ui, sans-serif';
  const title = opts.title.length > 42 ? `${opts.title.slice(0, 42)}…` : opts.title;
  ctx.fillText(title, 60, 152);

  ctx.fillStyle = sub;
  ctx.font = '400 28px system-ui, sans-serif';
  ctx.fillText(`${opts.name} • ${opts.subtitle}`, 60, 198);

  // Big score
  ctx.fillStyle = accent;
  ctx.font = '900 190px system-ui, sans-serif';
  ctx.fillText(`${result.scorePercent}%`, 60, 400);
  ctx.fillStyle = ink;
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(`${result.correctCount} / ${result.totalQuestions} correct`, 64, 462);
  ctx.fillStyle = sub;
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillText(`Finished in ${Math.floor(result.totalSeconds / 60)}m ${result.totalSeconds % 60}s`, 64, 506);

  // Category bars (right side, top 5)
  const cats = result.categoryBreakdown.slice(0, 5);
  let y = 250;
  ctx.font = '700 24px system-ui, sans-serif';
  for (const c of cats) {
    ctx.fillStyle = sub;
    const label = c.category.length > 26 ? `${c.category.slice(0, 26)}…` : c.category;
    ctx.fillText(label, 700, y);
    ctx.fillStyle = pro ? '#cbd5e1' : '#1e293b';
    ctx.fillRect(700, y + 12, 440, 20);
    ctx.fillStyle = c.score >= 60 ? accent : '#f87171';
    ctx.fillRect(700, y + 12, Math.round(440 * (c.score / 100)), 20);
    ctx.fillStyle = ink;
    ctx.fillText(`${c.score}%`, 1062, y);
    y += 68;
  }

  ctx.fillStyle = accent2;
  ctx.font = 'italic 700 30px system-ui, sans-serif';
  ctx.fillText(pro ? 'Think you can beat this score? Take the same challenge.' : 'Think you can beat me? Same questions. No cap.', 60, 580);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sigma-iq-plus-result.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
