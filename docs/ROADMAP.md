# Roadmap

## Fase 0 — Recuperação e inventário

- aguardar resposta do GitHub;
- recuperar ou localizar o código original;
- criar backup ZIP local;
- espelhar no GitLab;
- criar tag `recovery-baseline`;
- executar sem alterações;
- registrar erros e recursos existentes;
- comparar com esta documentação.

## Fase 1 — Fundação

- Vite, React e TypeScript;
- layout do editor;
- modelo de dados;
- projeto novo com cena vazia;
- painel de cenas;
- canvas básico;
- inspector;
- persistência local inicial.

## Fase 2 — Edição

- arrastar e redimensionar;
- copiar, colar e duplicar;
- desfazer/refazer por comandos;
- árvore de objetos;
- seleção múltipla;
- snapping e alinhamento;
- atalhos.

## Fase 3 — Runtime

- carregar snapshot validado;
- player;
- câmera;
- plataformas;
- colisões;
- transições entre cenas;
- HUD;
- modo Jogar e encerramento limpo.

## Fase 4 — Inimigos

- cacto;
- patrulha;
- visão;
- perseguição;
- ataque;
- retorno à patrulha;
- testes contra congelamento e teleporte.

## Fase 5 — Projeto portátil

- IndexedDB completo;
- assets binários;
- exportação `.elfuego`;
- importação segura;
- checksums;
- backups;
- migrações.

## Fase 6 — Qualidade

- testes unitários;
- testes de integração;
- Playwright;
- acessibilidade;
- performance;
- documentação de uso;
- GitHub Pages;
- GitLab Pages;
- operação offline após carregamento dos assets.

## Fase 7 — Sistemas do El Fuego

- [x] GLB e animações próprias de cacto e boss;
- [x] ataques e fases configuráveis do boss;
- [x] gatilhos com ações tipadas e ordenadas;
- [x] diálogos com falas, retratos e bloqueio do player;
- [x] entradas nomeadas por cena e transição;
- [x] campanha separada das cenas com dez fases;
- [x] progresso permanente da campanha;
- [ ] colecionáveis configuráveis e condições específicas de objetivo;
- [ ] tela de seleção de fases e resumo de progresso;
- [ ] conteúdo e assets finais das dez fases.

## Regra de execução

Cada melhoria deve usar branch pequena, objetivo verificável e teste associado. Não substituir sistemas funcionais recuperados sem evidência técnica.
