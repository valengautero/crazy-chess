// Textos estructurados por idioma. Para agregar otro idioma: crear en.ts con las mismas claves.
const es = {
  'app.title': 'AJEDREZ PIXEL',
  'menu.learn': 'Aprender',
  'menu.ai': 'Practicar vs IA',
  'menu.online': 'Multijugador',
  'menu.local': 'Local (2 jugadores)',
  'menu.soon': 'Próximamente',
  'game.turn.w': 'Juegan blancas',
  'game.turn.b': 'Juegan negras',
  'game.check': '¡Jaque!',
  'game.mate.w': 'Jaque mate. ¡Ganan las blancas!',
  'game.mate.b': 'Jaque mate. ¡Ganan las negras!',
  'game.draw.stalemate': 'Tablas por rey ahogado.',
  'game.draw.threefold': 'Tablas por triple repetición.',
  'game.draw.material': 'Tablas por material insuficiente.',
  'game.draw.fifty': 'Tablas por regla de los 50 movimientos.',
  'game.draw': 'Tablas.',
  'btn.undo': 'Deshacer',
  'btn.flip': 'Girar',
  'btn.legal': 'Casillas legales',
  'btn.new': 'Nueva partida',
  'btn.menu': 'Menú',
  'promo.title': 'Promocionar a…',
  'piece.q': 'Dama',
  'piece.r': 'Torre',
  'piece.b': 'Alfil',
  'piece.n': 'Caballo',
} as const;

export type TKey = keyof typeof es;
const dicts: Record<string, Record<TKey, string>> = { es };
let lang = 'es';

export function t(key: TKey): string {
  return dicts[lang]?.[key] ?? es[key];
}
