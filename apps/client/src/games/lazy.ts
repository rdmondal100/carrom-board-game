import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** HAPP-1/3 a named export loaded on first render (its module becomes its own chunk). */
export function lazyNamed<P extends object, M extends Record<string, unknown>>(
  load: () => Promise<M>, name: keyof M & string,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => ({ default: (await load())[name] as ComponentType<P> }));
}
