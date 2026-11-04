import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Une clases y resuelve los choques de Tailwind (gana la última).
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
