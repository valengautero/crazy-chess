/** Partículas, textos flotantes y screen shake. Las coordenadas son píxeles CSS del canvas. */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  born: number; life: number; size: number; color: string;
}
interface FloatText {
  x: number; y: number; text: string; color: string; born: number; life: number; size: number;
}

export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private shakeAmp = 0;
  private shakeStart = 0;

  burst(x: number, y: number, n: number, colors: string[], speed: number, size: number, now: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.3,
        born: now,
        life: 500 + Math.random() * 500,
        size,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      });
    }
  }

  /** Polvo al aterrizar: salta hacia arriba y a los costados (semicírculo superior). */
  dust(x: number, y: number, n: number, colors: string[], speed: number, size: number, now: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.05 + Math.random() * 0.9); // entre -9° y -171°: hacia arriba
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x: x + (Math.random() - 0.5) * size * 4,
        y,
        vx: Math.cos(a) * v * 1.2,
        vy: Math.sin(a) * v,
        born: now,
        life: 450 + Math.random() * 400,
        size: size + (Math.random() < 0.3 ? 1 : 0),
        color: colors[Math.floor(Math.random() * colors.length)]!,
      });
    }
  }

  floatText(x: number, y: number, text: string, color: string, size: number, now: number, life = 1000): void {
    this.texts.push({ x, y, text, color, born: now, life, size });
  }

  shake(amp: number, now: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeStart = now;
  }

  /** Offset actual del shake (0,0 cuando terminó). */
  shakeOffset(now: number): { x: number; y: number } {
    const t = (now - this.shakeStart) / 1000;
    const a = this.shakeAmp * Math.exp(-7 * t);
    if (a < 0.4) {
      this.shakeAmp = 0;
      return { x: 0, y: 0 };
    }
    return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
  }

  get active(): boolean {
    return this.particles.length > 0 || this.texts.length > 0 || this.shakeAmp > 0;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.particles = this.particles.filter((p) => now - p.born < p.life);
    for (const p of this.particles) {
      const t = (now - p.born) / 1000;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 400 * t * t;
      ctx.globalAlpha = Math.max(0, 1 - (now - p.born) / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    this.texts = this.texts.filter((f) => now - f.born < f.life);
    for (const f of this.texts) {
      const k = (now - f.born) / f.life;
      const y = f.y - 46 * (1 - Math.pow(1 - k, 2));
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 0.5);
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.font = `bold ${f.size}px "Pixelify Sans", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, f.size * 0.22);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0d0817';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
}
