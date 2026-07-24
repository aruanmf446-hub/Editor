import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/runtime/RuntimeGame.tsx'],
    rules: {
      // O reset ocorre somente ao criar uma nova sessão/controlador de jogo.
      // Ele evita que um snapshot da sessão anterior apareça durante a troca de fase.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/editor/PlayerAnimationPanel.tsx'],
    rules: {
      // O painel redefine a leitura de clips quando o modelo selecionado muda.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
);
