# El Fuego Studio

Editor visual independente para criação de fases laterais do jogo **El Fuego**.

## Estado atual

Este repositório contém o planejamento oficial, os contratos de dados e as regras de recuperação do projeto.

A reconstrução do runtime principal está temporariamente suspensa enquanto o código original é analisado ou recuperado. Não devem ser recriados por memória, nesta etapa, a física, a câmera, o player, o sistema de animações ou a inteligência dos inimigos.

## Objetivos

- Criar e organizar cenas em sequência.
- Importar cenários e assets locais.
- Inserir e configurar personagens, inimigos, plataformas, recargas e objetos.
- Testar fases em um modo Jogar separado do editor.
- Salvar projetos localmente com IndexedDB.
- Importar e exportar projetos portáteis no formato `.elfuego`.
- Funcionar sem login, banco remoto ou serviço externo obrigatório.
- Ser publicável no GitHub Pages e no GitLab Pages.

## Princípio central

```text
Editor visual
    ↓ modifica dados
Projeto .elfuego
    ↓ é interpretado
Runtime do jogo
```

O editor nunca deve implementar diretamente a física ou o comportamento das entidades. Ele apenas cria e altera dados que o runtime interpreta.

## Documentação

- [Produto](docs/PRODUCT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Experiência do editor](docs/EDITOR-UX.md)
- [Formato do projeto](docs/PROJECT-FORMAT.md)
- [Runtime](docs/RUNTIME.md)
- [Máquina de estados do cacto](docs/CACTUS-STATE-MACHINE.md)
- [Persistência](docs/PERSISTENCE.md)
- [Validação](docs/VALIDATION.md)
- [Roadmap](docs/ROADMAP.md)
- [Plano de recuperação](docs/RECOVERY-PLAN.md)

## Stack planejada

- React
- TypeScript
- Vite
- Three.js / React Three Fiber
- Zustand
- IndexedDB com Dexie
- Zod
- JSZip
- Vitest
- Playwright

A stack poderá ser ajustada depois da análise do código recuperado, evitando reescritas desnecessárias.

## Regras desta fase

### Permitido

- documentação;
- schemas;
- contratos TypeScript;
- validações;
- testes de contratos;
- planejamento da persistência;
- migração de versões;
- especificação do comportamento do cacto.

### Aguardar recuperação do código

- física;
- câmera;
- player;
- AnimationMixer;
- runtime completo;
- canvas completo;
- reconstrução do projeto perdido por memória.

## Licença

A definir.
