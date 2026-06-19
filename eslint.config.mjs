import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';

//----------------------------------------------------------------------------
//Local rule: REQUIRE a `client:*` directive on every React island used in a
//.astro template.
//
//Astro's single silent-failure mode is a framework (React) component placed in
//a template WITHOUT a client:* directive: it renders to static HTML and never
//hydrates — an inert chart/button/form with NO error and NO warning. This rule
//turns that into a loud lint (and therefore CI) error (requirements §9 risk;
//architecture §9 BOM "Guardrail").
//
//Discriminator: only flag components IMPORTED FROM a framework module (.tsx/.jsx
//or a `components/react/` / `islands/react/` path) — i.e. real React islands.
//Astro components (imported from `.astro`) render server-side by design and must
//NOT be flagged.
//----------------------------------------------------------------------------
function attrFullName(attr) {
  if (!attr || attr.type !== 'JSXAttribute' || !attr.name) return '';
  const n = attr.name;
  //astro-eslint-parser may model `client:load` either as a JSXNamespacedName
  //(namespace "client", name "load") or as a flattened JSXIdentifier
  //("client:load"). Handle both so the guard is robust to parser shape.
  if (n.type === 'JSXNamespacedName') {
    return `${n.namespace?.name ?? ''}:${n.name?.name ?? ''}`;
  }
  if (n.type === 'JSXIdentifier') return n.name;
  return '';
}

const requireClientDirective = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a client:* directive on React islands used in .astro templates',
    },
    schema: [],
    messages: {
      missing:
        "React island '<{{name}}>' has no client:* directive — it will render inert (no hydration). Add client:load, client:visible, client:idle, or client:only=\"react\".",
    },
  },
  create(context) {
    //identifiers imported from a framework module (a hydratable island)
    const islandImports = new Set();
    return {
      ImportDeclaration(node) {
        const src = typeof node.source.value === 'string' ? node.source.value : '';
        //.astro imports are server components — never require client:*
        if (/\.astro$/.test(src)) return;
        if (/\.[mc]?[jt]sx?$/.test(src) || /\/(components|islands)\/react\//.test(src)) {
          for (const spec of node.specifiers) {
            if (spec.local?.name) islandImports.add(spec.local.name);
          }
        }
      },
      JSXOpeningElement(node) {
        if (!node.name || node.name.type !== 'JSXIdentifier') return;
        const name = node.name.name;
        if (!islandImports.has(name)) return;
        const hasClient = node.attributes.some((attr) =>
          attrFullName(attr).startsWith('client:'),
        );
        if (!hasClient) {
          context.report({ node, messageId: 'missing', data: { name } });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', '.wrangler/**', 'public/**'],
  },
  //JS / TS / TSX source
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  //Ambient declaration files: triple-slash `/// <reference …>` directives are
  //the idiomatic way to pull in Astro's generated client types — not a smell.
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
  //.astro templates: the plugin's recommended set + the local island guard
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.astro'],
    plugins: {
      local: { rules: { 'require-client-directive': requireClientDirective } },
    },
    rules: {
      'local/require-client-directive': 'error',
    },
  },
);
