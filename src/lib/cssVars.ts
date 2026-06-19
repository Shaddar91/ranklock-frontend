//Helper for setting CSS custom properties (--foo) in a React `style` prop.
//React's CSSProperties type doesn't include arbitrary `--*` keys, so we build the
//merged object and assert it once here instead of casting at every call site.
import type { CSSProperties } from 'react';

export function cssVars(vars: Record<string, string | number>, base?: CSSProperties): CSSProperties {
  return { ...(base ?? {}), ...vars } as CSSProperties;
}
