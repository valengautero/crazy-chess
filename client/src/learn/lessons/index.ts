import type { Lesson } from '../types';
import { lessonsEs } from './es';

const byLang: Record<string, Lesson[]> = { es: lessonsEs };

export function getLessons(lang = 'es'): Lesson[] {
  return byLang[lang] ?? lessonsEs;
}
