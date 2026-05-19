// ════════════════════════════════════════════════════════════════
//  ESLint · Flat config (Angular 21 + ESLint v9)
//
//  Curso: Desarrollo Seguro Avanzado · Kibernum / Banmédica
//
//  Por qué flat config y no .eslintrc.json:
//    Angular 21 + ESLint v9 deprecan el formato legacy eslintrc.
//    El flat config (eslint.config.js) es la única opción soportada
//    a partir de ESLint v9 y permite importar configs como módulos
//    estándar de Node.
//
//  Composición:
//    - @typescript-eslint/{parser,eslint-plugin}   → reglas TS
//    - @angular-eslint/eslint-plugin               → reglas Angular TS
//    - @angular-eslint/eslint-plugin-template      → reglas templates
//    - @angular-eslint/template-parser             → parser de .html
//
//  Reglas adicionales explícitas de seguridad:
//    - no-eval, no-implied-eval, no-new-func, no-script-url:
//      previenen ejecución dinámica de strings → XSS (OWASP A03).
//    - @typescript-eslint/no-explicit-any: estrictar el tipado
//      (CLAUDE.md exige "evitar any, usar unknown").
//
//  La política deliberadamente NO es estricta. El objetivo del gate
//  es introducir lint al alumno sin romper su build con detalles
//  cosméticos: errors bloquean, warnings se reportan pero pasan.
// ════════════════════════════════════════════════════════════════

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const angularPlugin = require('@angular-eslint/eslint-plugin');
const angularTemplatePlugin = require('@angular-eslint/eslint-plugin-template');
const angularTemplateParser = require('@angular-eslint/template-parser');

module.exports = [
  // ── Ignorar artefactos generados y dependencias ──────────────
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.angular/**',
      'public/**',
      'eslint.config.js',
    ],
  },

  // ── Reglas para archivos TypeScript ───────────────────────────
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // No declaramos `project` para evitar type-aware linting:
        // duplicaría el tiempo de análisis y requiere un tsconfig
        // dedicado a ESLint. Las reglas recommended no lo necesitan.
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': angularPlugin,
      '@angular-eslint/template': angularTemplatePlugin,
    },
    // El processor permite que ESLint analice templates inline
    // declarados dentro de @Component({ template: '...' }). Vive en el
    // plugin de templates aunque se aplique al bloque de archivos .ts.
    processor: angularTemplatePlugin.processors['extract-inline-html'],
    rules: {
      // Heredamos los recomendados de cada plugin manualmente
      // (en flat config no hay `extends` clásico).
      ...tsPlugin.configs.recommended.rules,
      ...angularPlugin.configs.recommended.rules,

      // ── Convenciones del proyecto ─────────────────────────────
      // El prefijo 'app' coincide con `prefix` en angular.json.
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],

      // ── Reglas de seguridad básicas (OWASP A03 Injection) ─────
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ── Disciplina de tipos (CLAUDE.md: evitar any) ───────────
      // 'warn' para no bloquear al alumno; el gate de CI permite
      // warnings y solo bloquea por errors.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // El proyecto usa el patrón DTO `UpdateXDto extends Partial<CreateXDto> {}`
      // — interfaces vacías intencionales. Las dejamos como warning para que
      // el linter informe pero no bloquee la build.
      '@typescript-eslint/no-empty-object-type': 'warn',
    },
  },

  // ── Reglas para templates HTML de Angular ─────────────────────
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin,
    },
    rules: {
      ...angularTemplatePlugin.configs.recommended.rules,
      // Accesibilidad WCAG AA es requisito del proyecto (CLAUDE.md).
      // Las reglas equivalen a un subconjunto de AXE en estático.
      ...angularTemplatePlugin.configs.accessibility.rules,
    },
  },
];
