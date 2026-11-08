import type { Lesson } from '../types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const lessonsEs: Lesson[] = [
  {
    id: 'board',
    title: 'El tablero y las coordenadas',
    summary: 'Filas, columnas y cómo se nombra cada casilla.',
    intro: [
      'El tablero tiene 64 casillas: 8 filas y 8 columnas, alternando claras y oscuras. Cada jugador tiene una casilla clara en su esquina derecha.',
      'Las columnas se nombran con letras, de la a a la h (de izquierda a derecha, mirando desde las blancas). Las filas se numeran del 1 al 8, de abajo hacia arriba.',
      'Cada casilla se nombra con su columna y su fila: por ejemplo, e4 es la columna e, fila 4. Las blancas empiezan abajo y mueven primero.',
    ],
    exercises: [
      { kind: 'square', fen: START, prompt: 'Tocá la casilla e4.', targets: ['e4'], explain: 'Columna e, fila 4: justo en el centro.' },
      { kind: 'square', fen: START, prompt: 'Tocá la casilla a1, la esquina de abajo a la izquierda.', targets: ['a1'] },
      { kind: 'square', fen: START, prompt: 'Tocá la casilla h8, la esquina de arriba a la derecha.', targets: ['h8'] },
      { kind: 'square', fen: START, prompt: 'Tocá la casilla d5.', targets: ['d5'] },
      { kind: 'square', fen: START, prompt: 'Tocá la casilla g7.', targets: ['g7'], explain: 'Ahí empieza el peón de la columna g de las negras.' },
      { kind: 'quiz', prompt: '¿Qué hay en la fila 2 al comenzar la partida?', options: ['Los peones blancos', 'Los peones negros', 'Las torres'], answer: 0 },
    ],
  },
  {
    id: 'pieces',
    title: 'Cómo se mueve cada pieza',
    summary: 'Torre, alfil, dama, caballo, rey y peón.',
    intro: [
      'Cada pieza se mueve de una forma distinta. En esta lección practicás cada una con el tablero casi vacío.',
      'Podés tocar una pieza para ver a dónde puede ir (las casillas legales se marcan en dorado) y luego tocar el destino, o arrastrarla.',
    ],
    exercises: [
      { kind: 'line', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', prompt: 'La torre se mueve en línea recta, por columnas y filas, tantas casillas como quiera si el camino está libre. Llevá la torre a a6.', line: ['a1a6'] },
      { kind: 'line', fen: '7k/8/8/8/3R4/8/8/4K3 w - - 0 1', prompt: 'También por las filas: llevá la torre a g4.', line: ['d4g4'] },
      { kind: 'line', fen: '6k1/8/8/8/3B4/8/8/4K3 w - - 0 1', prompt: 'El alfil se mueve en diagonal, y siempre queda sobre casillas del mismo color. Llevá el alfil a a7.', line: ['d4a7'] },
      { kind: 'line', fen: '6k1/8/8/8/3Q4/8/8/4K3 w - - 0 1', prompt: 'La dama combina torre y alfil: va recto o en diagonal. Llevá la dama a a7 (en diagonal).', line: ['d4a7'] },
      { kind: 'line', fen: '6k1/8/8/8/3Q4/8/8/4K3 w - - 0 1', prompt: 'Ahora en línea recta: llevá la dama a g4.', line: ['d4g4'] },
      { kind: 'line', fen: '7k/8/8/8/8/8/8/1N2K3 w - - 0 1', prompt: 'El caballo salta en "L": dos casillas en una dirección y una al costado. Es la única pieza que puede saltar sobre otras. Llevalo a c3.', line: ['b1c3'] },
      { kind: 'line', fen: '7k/8/8/8/3N4/8/8/4K3 w - - 0 1', prompt: 'Otra vez el caballo: llevalo a f5.', line: ['d4f5'] },
      { kind: 'line', fen: '7k/8/8/8/8/8/8/4K3 w - - 0 1', prompt: 'El rey se mueve una sola casilla en cualquier dirección. Es la pieza más importante: si lo perdés, perdés la partida. Mové el rey una casilla.', line: [['e1d1', 'e1f1', 'e1d2', 'e1e2', 'e1f2']] },
      { kind: 'line', fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', prompt: 'El peón avanza de frente y nunca retrocede. En su primer movimiento puede avanzar una o dos casillas. Avanzá el peón dos casillas, a e4.', line: ['e2e4'] },
      { kind: 'line', fen: '7k/8/8/8/4P3/8/8/4K3 w - - 0 1', prompt: 'Después de su primer movimiento, el peón avanza de a una casilla. Llevalo a e5.', line: ['e4e5'] },
    ],
  },
  {
    id: 'capture',
    title: 'La captura',
    summary: 'Cómo se capturan piezas rivales.',
    intro: [
      'Capturar es mover una pieza a la casilla donde está una pieza rival: la sacás del tablero y ocupás su lugar.',
      'Casi todas las piezas capturan como se mueven. La excepción son los peones: avanzan de frente, pero capturan en diagonal, una casilla hacia adelante.',
    ],
    exercises: [
      { kind: 'line', fen: '7k/8/8/3p4/8/8/8/3RK3 w - - 0 1', prompt: 'Tu torre ataca al peón negro de d5. ¡Capturalo!', line: ['d1d5'] },
      { kind: 'line', fen: '7k/8/8/3p4/4P3/8/8/4K3 w - - 0 1', prompt: 'Los peones capturan en diagonal. Capturá el peón negro con tu peón.', line: ['e4d5'], feedback: { e4e5: 'Avanzar de frente no captura: los peones capturan en diagonal.' } },
      { kind: 'line', fen: '7k/8/4p3/8/3N4/8/8/4K3 w - - 0 1', prompt: 'El caballo captura en la casilla donde cae. Capturá el peón de e6.', line: ['d4e6'] },
      { kind: 'line', fen: '6k1/8/1p6/8/3B4/8/8/4K3 w - - 0 1', prompt: 'Capturá el peón negro con tu alfil.', line: ['d4b6'] },
      { kind: 'quiz', prompt: 'Una pieza tuya está atacada por el rival. ¿Qué podés hacer?', options: ['Moverla, protegerla o capturar a la pieza que la ataca', 'Nada: ya está perdida', 'Pasar el turno'], answer: 0, explain: 'Siempre revisá qué piezas tuyas están en peligro antes de mover.' },
    ],
  },
  {
    id: 'check',
    title: 'Jaque, jaque mate y tablas',
    summary: 'Cómo termina una partida.',
    intro: [
      'Jaque: el rey está atacado. Quien recibe jaque debe salir de él de inmediato: moviendo el rey, bloqueando el ataque o capturando a la pieza que da jaque.',
      'Jaque mate: el rey está en jaque y no hay forma de evitarlo. La partida termina y gana quien dio el mate.',
      'Tablas: empate. Ocurre por rey ahogado (el que mueve no tiene jugadas legales pero no está en jaque), por triple repetición de la posición, por material insuficiente para dar mate, por la regla de los 50 movimientos o por acuerdo.',
    ],
    exercises: [
      { kind: 'goal', fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', prompt: 'El rey negro está en e8. Dale jaque con tu torre.', goal: 'check' },
      { kind: 'line', fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', prompt: 'Tu rey está en jaque por la torre negra. Salí del jaque moviendo el rey a una casilla que no esté atacada.', line: [['e1d1', 'e1d2', 'e1f1', 'e1f2']], explain: 'La torre ataca toda la columna e, así que había que salir de ella.' },
      { kind: 'goal', fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', prompt: 'Dale jaque mate al rey negro en una jugada. Sus propios peones le tapan la huida.', goal: 'mate', explain: 'Se llama "mate del pasillo": el rey queda encerrado por sus propios peones.' },
      { kind: 'goal', fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', prompt: 'Otro mate: tu dama y tu rey trabajan juntos. ¡Encontralo!', goal: 'mate', explain: 'La dama está protegida por el rey, así que el rey negro no puede capturarla.' },
      { kind: 'goal', fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', prompt: '¡Cuidado con el rey ahogado! Si el rival no tiene jugadas pero NO está en jaque, son tablas. Acá hay que dar mate sin ahogar al rey negro.', goal: 'mate' },
      { kind: 'quiz', prompt: 'Es el turno de las negras: no tienen ninguna jugada legal y su rey NO está en jaque. ¿Qué pasa?', options: ['Ganan las blancas', 'Tablas por rey ahogado', 'Ganan las negras'], answer: 1, explain: 'Se llama rey ahogado y es empate.' },
      { kind: 'quiz', prompt: '¿Cuál de estas NO es una forma de tablas?', options: ['Triple repetición de la posición', 'Material insuficiente (por ejemplo, rey contra rey)', 'Tener una pieza menos que el rival'], answer: 2 },
    ],
  },
  {
    id: 'special',
    title: 'Reglas especiales',
    summary: 'Enroque, captura al paso y promoción.',
    intro: [
      'Enroque: el rey se mueve dos casillas hacia una torre y la torre salta al otro lado del rey. Solo se puede si el rey y esa torre no se movieron antes, no hay piezas entre ellos, y el rey no está en jaque ni pasa por casillas atacadas.',
      'Captura al paso: si un peón rival avanza dos casillas y queda al lado de tu peón, podés capturarlo como si hubiera avanzado una sola. Solo vale en la jugada inmediatamente siguiente.',
      'Promoción: cuando un peón llega a la última fila se transforma en dama, torre, alfil o caballo (casi siempre conviene la dama).',
    ],
    exercises: [
      { kind: 'line', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', prompt: 'Enroque corto: mové el rey dos casillas hacia la torre, a g1. La torre salta sola.', line: ['e1g1'] },
      { kind: 'line', fen: '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1', prompt: 'Enroque largo: mové el rey dos casillas hacia la torre de a1, a c1.', line: ['e1c1'] },
      { kind: 'line', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', prompt: 'El peón negro acaba de avanzar de d7 a d5 y quedó junto a tu peón. Capturalo al paso: mové tu peón a d6.', line: ['e5d6'], explain: 'Si no lo hacés ahora, perdés la oportunidad.' },
      { kind: 'line', fen: '7k/4P3/8/8/8/8/8/4K3 w - - 0 1', prompt: 'Tu peón llegó a la séptima fila. Llevalo a e8 y elegí dama.', line: ['e7e8q'], feedback: { e7e8r: 'Podés elegir torre, pero en esta práctica pedimos dama.', e7e8b: 'Podés elegir alfil, pero en esta práctica pedimos dama.', e7e8n: 'Podés elegir caballo, pero en esta práctica pedimos dama.' } },
      { kind: 'quiz', prompt: '¿Cuándo se puede capturar al paso?', options: ['Solo en la jugada inmediatamente siguiente al avance doble del peón rival', 'En cualquier momento', 'Solo con la dama'], answer: 0 },
    ],
  },
  {
    id: 'values',
    title: 'El valor de las piezas',
    summary: 'Cuánto vale cada pieza y por qué importa.',
    intro: [
      'Cada pieza tiene un valor aproximado que ayuda a decidir si un cambio conviene: peón 1, caballo 3, alfil 3, torre 5 y dama 9. El rey no tiene valor: no se puede perder ni cambiar.',
      'Cambiar una pieza por otra del mismo valor es un cambio parejo. Ganar material (capturar más valor del que perdés) suele llevar a ganar la partida.',
    ],
    exercises: [
      { kind: 'quiz', prompt: '¿Cuántos puntos vale una torre?', options: ['3', '5', '9'], answer: 1 },
      { kind: 'quiz', prompt: '¿Qué conviene más ganar: una torre o un caballo?', options: ['Un caballo (3 puntos)', 'Una torre (5 puntos)', 'Da igual'], answer: 1 },
      { kind: 'line', fen: '4k3/r7/8/3n4/3Q4/8/8/4K3 w - - 0 1', prompt: 'Tu dama puede capturar una torre o un caballo. Capturá la pieza que más vale.', line: ['d4a7'], feedback: { d4d5: 'Capturaste un caballo (3 puntos), pero la torre vale 5: había algo mejor.' } },
      { kind: 'quiz', prompt: '¿Es buen negocio cambiar tu dama (9) por una torre (5)?', options: ['No: perdés 4 puntos de material', 'Sí, siempre', 'Da igual'], answer: 0 },
    ],
  },
  {
    id: 'openings',
    title: 'Aperturas básicas',
    summary: 'Tres principios para empezar bien.',
    intro: [
      'Tres principios para jugar bien las primeras jugadas: 1) controlá el centro del tablero (e4, d4, e5, d5); 2) desarrollá tus piezas, sacando caballos y alfiles antes que la dama; 3) enrocá pronto para proteger al rey.',
      'Evitá mover la misma pieza muchas veces, sacar la dama demasiado temprano o hacer demasiadas jugadas de peón al costado.',
    ],
    exercises: [
      { kind: 'line', fen: START, prompt: 'Primer principio: el centro. Abrí la partida con un peón central: e4 o d4.', line: [['e2e4', 'd2d4']] },
      { kind: 'line', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', prompt: 'Segundo principio: desarrollá. Sacá un caballo hacia el centro: Cf3 o Cc3.', line: [['g1f3', 'b1c3']] },
      { kind: 'line', fen: START, prompt: 'Armemos la Apertura Italiana con blancas: 1. e4, 2. Cf3, 3. Ac4, y por último enrocá (rey a g1). Las negras responden solas.', line: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1'], explain: 'Controlaste el centro, desarrollaste caballo y alfil y pusiste el rey a salvo.' },
      { kind: 'quiz', prompt: '¿Cuál de estas ideas es mala en la apertura?', options: ['Sacar la dama muy temprano', 'Controlar el centro', 'Enrocar pronto'], answer: 0, explain: 'La dama puede ser atacada por piezas menores y perdés tiempo escapando.' },
      { kind: 'quiz', prompt: '¿Para qué sirve enrocar?', options: ['Poner el rey a salvo y activar la torre', 'Ganar un peón', 'Atacar la dama rival'], answer: 0 },
    ],
  },
  {
    id: 'tactics',
    title: 'Táctica básica',
    summary: 'Clavada, horquilla, descubierta y el mate del pastor.',
    intro: [
      'La táctica son jugadas concretas que ganan material o dan mate. Cuatro ideas clásicas: la clavada (una pieza no puede moverse porque detrás hay una más valiosa), la horquilla (una pieza ataca a dos a la vez), el ataque descubierto (al mover una pieza liberás el ataque de otra) y el mate del pastor (un mate rapidísimo contra el punto débil f7).',
      'Antes de cada jugada preguntate: ¿qué amenaza mi rival? ¿Puedo atacar dos cosas a la vez?',
    ],
    exercises: [
      { kind: 'line', fen: '4k3/4n3/8/8/8/8/3K4/R7 w - - 0 1', prompt: 'Clavada: el caballo negro de e7 está delante de su rey. Si llevás la torre a la columna e, el caballo no podrá moverse. ¡Clavalo!', line: ['a1e1'], explain: 'Si el caballo se mueve, el rey quedaría en jaque, y eso es ilegal.' },
      { kind: 'line', fen: 'r3k3/8/N7/8/8/8/8/4K3 w - - 0 1', prompt: 'Horquilla: mové el caballo a c7. Ataca al rey y a la torre a la vez. Después capturá la torre.', line: ['a6c7', 'e8d8', 'c7a8'], explain: 'El rey tuvo que escapar del jaque y la torre quedó sin defensa.' },
      { kind: 'line', fen: '3k4/8/8/1q6/3N4/8/8/3RK3 w - - 0 1', prompt: 'Ataque descubierto: tu torre está detrás del caballo, en la misma columna que el rey negro. Mové el caballo capturando la dama: ¡además descubrís un jaque!', line: ['d4b5'], explain: 'Mientras el rey negro atiende el jaque de la torre, ya te llevaste la dama.' },
      { kind: 'line', fen: START, prompt: 'Mate del pastor: jugá 1. e4, 2. Ac4, 3. Dh5 y 4. Dxf7#. Las negras se defienden mal.', line: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'], explain: 'El peón f7 solo estaba protegido por el rey, y tu alfil lo apoyaba.' },
      { kind: 'line', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 4 3', prompt: 'Ahora jugás con negras y el rival amenaza Dxf7#. Defendete: expulsá a la dama con g6 o protegé f7 con De7 o Df6.', line: [['g7g6', 'd8e7', 'd8f6']], feedback: { g8f6: '¡Cuidado! 3...Cf6?? permite Dxf7#: es justo el mate del pastor.' }, explain: 'Sacar la dama temprano suele salir mal: ahora pierde tiempo.' },
      { kind: 'quiz', prompt: 'Una pieza ataca a dos piezas rivales al mismo tiempo. ¿Cómo se llama?', options: ['Clavada', 'Horquilla', 'Enroque'], answer: 1 },
    ],
  },
  {
    id: 'endgames',
    title: 'Finales básicos',
    summary: 'Rey y dama, rey y torre, y la oposición.',
    intro: [
      'Los finales se juegan con pocas piezas, y el rey se vuelve una pieza activa. Acá jugás contra Stockfish: tenés que lograr el objetivo antes de quedarte sin jugadas.',
      'Rey y dama contra rey siempre ganan: usá la dama para encerrar al rey rival en el borde, acercá tu rey y dá mate. Con rey y torre es parecido, pero se tarda más. En ambos casos, ¡cuidado con el rey ahogado!',
      'La oposición: dos reyes frente a frente con una casilla entre ambos. Quien NO tiene que mover tiene la oposición, y obliga al otro rey a ceder terreno.',
    ],
    exercises: [
      { kind: 'playout', fen: '6k1/8/8/8/8/8/8/Q3K3 w - - 0 1', prompt: 'Rey y dama contra rey: dá jaque mate. Tenés 20 jugadas. Si te trabás, usá la pista.', goal: 'mate', maxMoves: 20, explain: 'Encerraste al rey con la dama y lo rematiste con ayuda de tu rey.' },
      { kind: 'playout', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', prompt: 'Rey y torre contra rey: dá jaque mate. Tenés 40 jugadas. Cortá al rey rival con la torre, acercá tu rey y rematá en el borde.', goal: 'mate', maxMoves: 40 },
      { kind: 'line', fen: '8/8/4k3/8/8/4K3/8/8 w - - 0 1', prompt: 'Oposición: tu rey está en e3 y el negro en e6. Mové tu rey para quedar frente a frente con una casilla en el medio. Así las negras tienen que ceder.', line: ['e3e4'], explain: 'Con el rey en e4 y las negras a mover, tenés la oposición.' },
      { kind: 'playout', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', prompt: 'Rey y peón contra rey: usá tu rey para abrirle camino al peón y promovelo. Tenés 15 jugadas. ¡Cuidado con el rey ahogado!', goal: 'promote', maxMoves: 15, explain: 'Con el rey delante del peón, el rival no puede detenerlo.' },
    ],
  },
];
