import type { ReactNode } from 'react';

interface MorphProps<S extends string> {
  state: S;
  states: Record<S, ReactNode>;
}

export default function Morph<S extends string>({ state, states }: MorphProps<S>) {
  return (
    <span className="morph">
      {(Object.keys(states) as S[]).map((key) => (
        <span key={key} data-morph={key} data-active={key === state} aria-hidden={key !== state}>
          {states[key]}
        </span>
      ))}
    </span>
  );
}
