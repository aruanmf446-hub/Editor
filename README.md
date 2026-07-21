# El Fuego Studio

Editor visual independente para criação e teste de fases laterais do jogo **El Fuego**.

## Estado atual

O projeto já possui editor funcional e um runtime próprio em evolução. A reconstrução deixou de estar suspensa.

Já estão implementados:

- editor de cenas e objetos;
- persistência local com IndexedDB/Dexie;
- estado do editor com Zustand;
- validação do projeto;
- player com física em passo fixo;
- câmera e colisões;
- ataque, defesa, dano, morte e respawn;
- carregamento de player em GLB com Three.js;
- associação automática e manual dos clips do GLB;
- reprodução com `AnimationMixer` e continuidade em frames lentos;
- descarte de recursos WebGL e do GLB;
- pixel ratio adaptativo;
- IA inicial completa do cacto no runtime: patrulha, visão, perseguição, ataque, cooldown e retorno à caminhada;
- testes automatizados com Vitest;
- CI com lint, testes e build.

Ainda estão em desenvolvimento:

- transição completa entre cenas;
- checkpoints integrados ao respawn;
- pickups;
- dano e morte dos inimigos;
- boss e fases do boss;
- triggers, diálogos, colecionáveis e demais objetos avançados;
- importação e exportação final do projeto `.elfuego`;
- validação prolongada de memória e contextos WebGL no navegador.

## Objetivos

- Criar e organizar cenas em sequência.
- Importar cenários, modelos e assets locais.
- Inserir e configurar personagens, inimigos, plataformas, recargas e objetos.
- Testar as fases em um modo separado do editor.
- Salvar projetos localmente com IndexedDB.
- Importar e exportar projetos portáteis no formato `.elfuego`.
- Funcionar sem login, banco remoto ou serviço externo obrigatório.
- Ser publicável no GitHub Pages e no GitLab Pages.

## Arquitetura

```text
Editor visual
    ↓ modifica dados
Projeto .elfuego
    ↓ é interpretado
Runtime do jogo
```

O editor cria e altera os dados do projeto. Física, animações e comportamento das entidades pertencem ao runtime.

## Spawn do player

O formato atual ainda valida um spawn global por projeto usando os códigos `MISSING_GLOBAL_SPAWN` e `MULTIPLE_GLOBAL_SPAWNS`.

A evolução prevista é permitir um spawn de entrada por cena ou por transição. Até essa mudança, cenas sem spawn próprio usam a regra do runtime definida para entrada de fase.

## Animações do GLB

Ao selecionar um `player-spawn` com modelo GLB, o painel **Animações do GLB** permite associar qualquer clip às ações do jogo:

- parado;
- caminhar;
- correr;
- pular;
- cair;
- atacar;
- defender;
- receber dano;
- morrer;
- agachar.

A ordem dos clips no arquivo não é usada como regra. Nomes genéricos como `Take 001` também podem ser associados manualmente.

## IA do cacto

O cacto possui estado próprio no runtime e interpreta os campos configurados no editor:

- limites de patrulha;
- distância de visão;
- velocidade de caminhada;
- velocidade de corrida;
- distância de ataque;
- dano;
- cooldown.

Fora da visão do player, ele continua caminhando. Ao detectar o player, corre em sua direção. Ao perder o alvo, retorna à patrulha sem teleporte.

## Comandos

```bash
npm ci --no-audit --no-fund
npm run dev
npm run lint
npm test
npm run build
```

## Stack

- React
- TypeScript
- Vite
- Three.js
- Zustand
- IndexedDB com Dexie
- Zod
- JSZip
- Vitest

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

## Licença

A definir.
