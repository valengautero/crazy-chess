import { EMOTES, type ClockConfig, type Color, type EmoteId, type ErrorCode, type RoomSnapshot } from '@chess-pixel/shared';
import type { Square } from 'chess.js';
import { playSfx } from '../audio/audio';
import { Game } from '../core/game';
import { t, tDyn, type TKey } from '../core/i18n';
import { loadSettings, saveSettings } from '../core/settings';
import { applyFx } from '../fx/background';
import { Connection, getToken, savedRoom, saveRoom } from '../net/connection';
import { BoardView } from '../render/boardView';
import { cardButton, el } from './dom';
import { createMoveInfo } from './moveInfo';
import { showMenu } from './menu';
import { showPromotion } from './promotion';
import { navigate } from './transition';

type Intent = { kind: 'create'; clock: ClockConfig | null; color: Color | 'random' } | { kind: 'join'; code: string };

const CLOCKS: { label: () => string; value: ClockConfig | null }[] = [
  { label: () => t('online.clock.none'), value: null },
  { label: () => '3 + 0', value: { minutes: 3, incrementSec: 0 } },
  { label: () => '5 + 0', value: { minutes: 5, incrementSec: 0 } },
  { label: () => '10 + 0', value: { minutes: 10, incrementSec: 0 } },
  { label: () => '15 + 10', value: { minutes: 15, incrementSec: 10 } },
];
const COLORS: { label: () => string; value: Color | 'random' }[] = [
  { label: () => t('online.color.random'), value: 'random' },
  { label: () => t('ai.setup.white'), value: 'w' },
  { label: () => t('ai.setup.black'), value: 'b' },
];

export function showOnlineLobby(root: HTMLElement, notice?: string): void {
  root.replaceChildren();
  let clockIdx = 0;
  let colorIdx = 0;
  const wrap = el('main', 'menu');
  wrap.append(el('h1', 'title small', t('online.title')));
  if (notice) wrap.append(el('div', 'notice', notice));

  const resume = savedRoom();
  if (resume) {
    wrap.append(cardButton(`${t('online.resume')} ${resume}`, () => navigate(root, () => showOnlineRoom(root, { kind: 'join', code: resume }))));
  }

  const group = (title: string, items: { label: () => string }[], get: () => number, set: (i: number) => void) => {
    const box = el('div', 'menu-list');
    box.append(el('h2', 'section', title));
    const row = el('div', 'chip-row');
    const btns = items.map((it, i) => {
      const b = cardButton(it.label(), () => { set(i); paint(); });
      row.append(b);
      return b;
    });
    const paint = () => btns.forEach((b, i) => b.classList.toggle('selected', i === get()));
    paint();
    box.append(row);
    return box;
  };

  wrap.append(
    group(t('online.clock'), CLOCKS, () => clockIdx, (i) => (clockIdx = i)),
    group(t('online.color'), COLORS, () => colorIdx, (i) => (colorIdx = i)),
    cardButton(t('online.create'), () =>
      navigate(root, () => showOnlineRoom(root, { kind: 'create', clock: CLOCKS[clockIdx]!.value, color: COLORS[colorIdx]!.value })),
    ),
  );

  const joinBox = el('div', 'menu-list');
  joinBox.append(el('h2', 'section', t('online.join')));
  const input = el('input', 'code-input');
  input.maxLength = 4;
  input.placeholder = t('online.join.placeholder');
  input.autocapitalize = 'characters';
  input.autocomplete = 'off';
  input.addEventListener('input', () => (input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '')));
  const go = () => {
    if (input.value.length === 4) navigate(root, () => showOnlineRoom(root, { kind: 'join', code: input.value }));
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  joinBox.append(input, cardButton(t('online.join.btn'), go));
  wrap.append(joinBox, cardButton(t('btn.menu'), () => navigate(root, () => showMenu(root))));
  root.append(wrap);
}

function fmtClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function copyText(text: string, fallbackInput: HTMLInputElement): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* se intenta el método viejo */ }
  fallbackInput.select();
  try { return document.execCommand('copy'); } catch { return false; }
}

export function showOnlineRoom(root: HTMLElement, intent: Intent): void {
  root.replaceChildren();
  const settings = loadSettings();
  const token = getToken();
  const game = new Game();
  const conn = new Connection();
  let snap: RoomSnapshot | null = null;
  let snapAt = 0;
  let code: string | null = intent.kind === 'join' ? intent.code.toUpperCase() : null;
  let left = false;

  // ---------- DOM ----------
  const screen = el('main', 'game-screen online');
  const status = el('div', 'status');
  const moveInfo = createMoveInfo(game);
  const invite = el('div', 'invite hidden');
  const inviteCode = el('div', 'invite-code');
  const linkInput = el('input', 'link-input');
  linkInput.readOnly = true;
  const copyBtn = cardButton(t('online.copy'), () => {
    if (copyText(linkInput.value, linkInput)) {
      copyBtn.textContent = t('online.copied');
      setTimeout(() => (copyBtn.textContent = t('online.copy')), 1500);
    }
  });
  invite.append(el('div', 'invite-label', t('online.code')), inviteCode, linkInput, copyBtn);

  const mkBar = () => {
    const bar = el('div', 'player-bar');
    const dot = el('span', 'dot');
    const name = el('span', 'pname');
    const bubble = el('span', 'bubble hidden');
    const clk = el('span', 'clock');
    bar.append(dot, name, bubble, clk);
    return { bar, dot, name, bubble, clk };
  };
  const top = mkBar();
  const bottom = mkBar();

  const banner = el('div', 'banner hidden');
  const stage = el('div', 'board-stage');
  const canvas = el('canvas', 'board');
  const promo = el('div', 'promo hidden');
  stage.append(canvas, promo);

  const controls = el('div', 'controls');
  const drawBtn = cardButton(t('online.offer'), () => conn.send({ t: 'draw-offer' }));
  const resignBtn = cardButton(t('online.resign'), () => {
    if (confirm(t('online.resign.confirm'))) conn.send({ t: 'resign' });
  });
  const legalBtn = cardButton('', () => {
    settings.showLegal = !settings.showLegal;
    saveSettings(settings);
    view.opts.showLegal = settings.showLegal;
    view.invalidate();
    legalBtn.textContent = `${t('btn.legal')}: ${settings.showLegal ? t('ai.on') : t('ai.off')}`;
  });
  legalBtn.textContent = `${t('btn.legal')}: ${settings.showLegal ? t('ai.on') : t('ai.off')}`;
  const btn3d = cardButton(t('btn.view3d'), () => {
    settings.view3d = !settings.view3d;
    saveSettings(settings);
    applyFx();
  });
  const leaveBtn = cardButton(t('btn.menu'), () => {
    if (snap?.phase === 'playing' && !confirm(t('online.leave.confirm'))) return;
    leave();
  });
  controls.append(drawBtn, resignBtn, legalBtn, btn3d, leaveBtn);

  // chat
  const chat = el('div', 'chat');
  const log = el('div', 'chat-log');
  const emotes = el('div', 'emote-row');
  for (const id of EMOTES) {
    emotes.append(cardButton(t(`emote.${id}` as TKey), () => conn.send({ t: 'emote', id: id as EmoteId })));
  }
  const form = el('form', 'chat-form');
  const chatInput = el('input', 'chat-input');
  chatInput.maxLength = 120;
  chatInput.placeholder = t('online.chat.placeholder');
  const sendBtn = el('button', 'card-btn', t('online.chat.send'));
  sendBtn.type = 'submit';
  form.append(chatInput, sendBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) conn.send({ t: 'chat', text });
    chatInput.value = '';
  });
  chat.append(log, emotes, form);

  screen.append(top.bar, status, moveInfo.node, invite, stage, bottom.bar, banner, controls, chat);
  root.append(screen);

  // ---------- tablero ----------
  const view = new BoardView(canvas, game, {
    showLegal: settings.showLegal,
    flipped: false,
    canInteract: () =>
      !!snap && snap.phase === 'playing' && game.turn === snap.you && conn.status === 'open' && promo.classList.contains('hidden'),
    onMoveAttempt: (from, to) => {
      if (game.needsPromotion(from, to)) {
        showPromotion(promo, (p) => {
          if (game.tryMove(from, to, p)) sendMove(from, to, p);
          view.clearSelection();
          refresh();
        });
        return false;
      }
      if (!game.tryMove(from, to)) return false;
      sendMove(from, to);
      refresh();
      return true;
    },
  });

  function sendMove(from: Square, to: Square, promotion?: string): void {
    // ply = cantidad de jugadas ANTES de esta (el servidor rechaza jugadas desfasadas)
    conn.send({ t: 'move', from, to, promotion, ply: game.chess.history().length - 1 });
  }

  // ---------- estado del servidor → pantalla ----------
  function applySnapshot(s: RoomSnapshot): void {
    snap = s;
    snapAt = performance.now();
    code = s.code;
    saveRoom(s.code);
    // reconcilia la partida local con la del servidor (que manda siempre)
    const mine = game.chess.history({ verbose: true }).map((m) => m.lan);
    let i = 0;
    while (i < mine.length && i < s.moves.length && mine[i] === s.moves[i]) i++;
    for (let k = mine.length; k > i; k--) game.undo();
    for (let k = i; k < s.moves.length; k++) game.applyUci(s.moves[k]!);
    view.opts.flipped = s.you === 'b';
    view.clearSelection();
    view.sync();
    moveInfo.update();
    refresh();
  }

  function resultText(s: RoomSnapshot): string {
    const r = s.result!;
    const head = r.winner === null ? t('res.draw') : r.winner === s.you ? t('res.win') : t('res.lose');
    return `${head} ${tDyn(`reason.${r.reason}`, 'res.draw')}`;
  }

  function refresh(): void {
    const s = snap;
    const link = code ? `${location.origin}/?room=${code}` : '';
    invite.classList.toggle('hidden', !(s && s.phase === 'waiting'));
    inviteCode.textContent = code ?? '';
    linkInput.value = link;

    if (!s) {
      status.textContent = conn.status === 'open' ? t('online.waiting') : t('online.reconnecting');
      return;
    }
    const opp: Color = s.you === 'w' ? 'b' : 'w';
    const colorName = (c: Color) => (c === 'w' ? t('ai.setup.white') : t('ai.setup.black'));
    bottom.name.textContent = `${t('online.you')} (${colorName(s.you)})`;
    top.name.textContent = `${t('online.rival')} (${colorName(opp)})`;
    bottom.dot.classList.toggle('on', s.connected[s.you]);
    top.dot.classList.toggle('on', s.connected[opp]);
    for (const b of [top, bottom]) b.clk.classList.toggle('hidden', !s.clock);

    let text: string;
    if (conn.status !== 'open') text = t('online.reconnecting');
    else if (s.phase === 'waiting') text = t('online.waiting');
    else if (s.phase === 'over') text = resultText(s);
    else if (!s.connected[opp]) text = t('online.rivaloff');
    else text = `${s.turn === s.you ? t('online.yourturn') : t('online.rivalturn')}${game.status().check ? ' ' + t('game.check') : ''}`;
    status.textContent = text;
    status.classList.toggle('alert', s.phase === 'playing' && game.status().check);

    // banner: oferta de tablas / revancha
    banner.replaceChildren();
    if (s.phase === 'playing' && s.drawOffer && s.drawOffer !== s.you) {
      banner.append(
        el('span', '', t('online.rivaloffers')),
        cardButton(t('online.accept'), () => conn.send({ t: 'draw-accept' })),
        cardButton(t('online.decline'), () => conn.send({ t: 'draw-decline' })),
      );
    } else if (s.phase === 'playing' && s.drawOffer === s.you) {
      banner.append(el('span', '', t('online.offered')));
    } else if (s.phase === 'over') {
      if (s.rematch[s.you]) banner.append(el('span', '', t('online.rematch.waiting')));
      else {
        if (s.rematch[opp]) banner.append(el('span', '', t('online.rematch.rival')));
        banner.append(cardButton(t('online.rematch'), () => conn.send({ t: 'rematch' })));
      }
    }
    banner.classList.toggle('hidden', banner.childElementCount === 0);

    const playing = s.phase === 'playing';
    drawBtn.disabled = !playing || s.drawOffer === s.you;
    resignBtn.disabled = !playing;
    paintClocks();
  }

  function paintClocks(): void {
    const s = snap;
    if (!s?.clock) return;
    const elapsed = performance.now() - snapAt;
    const val = (c: Color) => s.clock![c] - (s.clock!.running === c ? elapsed : 0);
    const opp: Color = s.you === 'w' ? 'b' : 'w';
    for (const [bar, c] of [[bottom, s.you], [top, opp]] as const) {
      const ms = val(c);
      bar.clk.textContent = fmtClock(ms);
      bar.clk.classList.toggle('low', ms < 10_000 && s.phase === 'playing');
      bar.clk.classList.toggle('active', s.clock.running === c);
    }
  }
  const ticker = window.setInterval(() => {
    if (!document.body.contains(screen)) clearInterval(ticker);
    else paintClocks();
  }, 100);

  function addChat(from: Color, kind: 'text' | 'emote', text: string): void {
    const mine = snap ? from === snap.you : false;
    const shown = kind === 'emote' ? tDyn(`emote.${text}`, 'emote.gg') : text;
    const line = el('div', `chat-line ${mine ? 'mine' : 'theirs'}`);
    line.append(el('b', '', mine ? t('online.you') : t('online.rival')), document.createTextNode(`: ${shown}`));
    log.append(line);
    log.scrollTop = log.scrollHeight;
    const bar = mine ? bottom : top;
    bar.bubble.textContent = shown;
    bar.bubble.classList.remove('hidden');
    clearTimeout((bar.bubble as unknown as { _t?: number })._t);
    (bar.bubble as unknown as { _t?: number })._t = window.setTimeout(() => bar.bubble.classList.add('hidden'), 3500);
    if (!mine) playSfx('click');
  }

  function fail(code: ErrorCode): void {
    if (code === 'no-room' || code === 'room-full') {
      saveRoom(null);
      leave(tDyn(`online.err.${code}`, 'online.err.bad-request'));
      return;
    }
    if (code === 'rate-limited') addNotice(t('online.err.rate-limited'));
    else playSfx('error');
  }
  function addNotice(text: string): void {
    log.append(el('div', 'chat-line notice', text));
    log.scrollTop = log.scrollHeight;
  }

  function leave(notice?: string): void {
    if (left) return;
    left = true;
    if (snap?.phase === 'playing') conn.send({ t: 'resign' });
    if (!notice) saveRoom(null);
    clearInterval(ticker);
    conn.close();
    navigate(root, () => showOnlineLobby(root, notice));
  }

  // ---------- red ----------
  conn.onStatus = (st) => {
    if (st === 'open' && !left) {
      if (code) conn.send({ t: 'join', token, code });
      else if (intent.kind === 'create') conn.send({ t: 'create', token, clock: intent.clock, color: intent.color });
    }
    refresh();
  };
  conn.onMessage = (m) => {
    if (m.t === 'state') applySnapshot(m.s);
    else if (m.t === 'chat') addChat(m.from, m.kind, m.text);
    else fail(m.code);
  };
  refresh();
}
