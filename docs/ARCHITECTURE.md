# Arquitetura

## Separação principal

```text
Editor visual
    ↓ cria e altera dados
Documento do projeto
    ↓ é validado e carregado
Runtime do jogo
```

## Camadas

### Editor

Responsável por:

- shell da aplicação;
- cabeçalho e barra de ferramentas;
- painel de cenas;
- árvore de objetos;
- canvas de edição;
- seleção e gizmos;
- inspector;
- histórico;
- atalhos;
- validação e mensagens.

### Projeto

Responsável por:

- schemas;
- contratos TypeScript;
- serialização;
- migração de versões;
- referências a assets;
- IDs estáveis;
- valores de configuração.

### Runtime

Responsável por:

- game loop;
- input;
- física;
- colisão;
- câmera;
- animações;
- combate;
- entidades;
- máquina de estados;
- transições entre cenas.

### Persistência

Responsável por:

- IndexedDB;
- autosave;
- backups;
- assets binários;
- importação;
- exportação;
- integridade de arquivos.

## Dependências permitidas

```text
editor → project
editor → state
editor → validation
editor → persistence
runtime → project
runtime → entities
runtime → validation
persistence → project
validation → project
```

## Dependências proibidas

```text
project → editor
project → runtime
entities → editor
runtime → componentes de inspector
editor → regras internas da máquina de estados
```

## Estado

Stores planejadas:

- `projectStore`: documento atual e operações estruturais;
- `editorStore`: ferramenta ativa e estado da interface;
- `selectionStore`: seleção simples e múltipla;
- `historyStore`: comandos de desfazer/refazer;
- `viewportStore`: zoom, pan, grade e snapping;
- `playStore`: validação e sessão do modo Jogar.

## Histórico por comandos

O histórico deve registrar operações concluídas, não cada quadro de um arraste.

Comandos iniciais:

- `CreateObjectCommand`;
- `DeleteObjectCommand`;
- `MoveObjectCommand`;
- `ResizeObjectCommand`;
- `UpdatePropertyCommand`;
- `ReorderSceneCommand`;
- `ReplaceBackgroundCommand`.

## Assets

Assets recebem IDs independentes do nome do arquivo. Objetos apontam para `assetId`, nunca diretamente para URLs temporárias.

## Publicação estática

- usar `base` relativo no Vite;
- evitar caminhos absolutos;
- não exigir backend;
- usar hash routing se houver rotas;
- armazenar assets importados no IndexedDB;
- manter a execução compatível com GitHub Pages e GitLab Pages.

## Estrutura planejada

```text
src/
├── app/
├── editor/
├── runtime/
├── entities/
├── project/
├── persistence/
├── state/
├── validation/
├── types/
└── tests/
```

A implementação real deve ser comparada ao código recuperado antes de qualquer reorganização ampla.
