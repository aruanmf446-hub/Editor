# El Fuego Studio

Editor visual independente para criação e teste de fases laterais do jogo **El Fuego**.

## Estado atual

O projeto possui editor funcional, persistência local e runtime próprio. A reconstrução deixou de estar suspensa e as principais funções de gameplay planejadas já participam do modo **Teste**.

Já estão implementados:

- editor de cenas e objetos;
- persistência local com IndexedDB/Dexie;
- estado do editor com Zustand;
- validação do projeto;
- player com física em passo fixo;
- câmera, colisões, ataque, defesa, dano, morte e respawn;
- carregamento de player em GLB com Three.js;
- associação automática e manual dos clips do GLB;
- reprodução com `AnimationMixer` e continuidade em frames lentos;
- descarte de recursos WebGL e do GLB;
- pixel ratio adaptativo;
- IA do cacto com patrulha, visão, perseguição, ataque, cooldown e retorno à caminhada;
- dano, vida, reação e morte dos inimigos;
- boss com vida, fases progressivas, aumento de velocidade, dano e cooldown;
- checkpoints reais com posição e vida de respawn;
- transição para próxima cena, cena específica e conclusão do jogo;
- reconstrução de câmera, plataformas, inimigos, pickups e player ao trocar de cena;
- pickups de vida, ataque e defesa, com respawn configurável e persistência;
- obstáculos sólidos, zonas de queda e áreas sem colisão;
- gatilhos, áreas de diálogo e colecionáveis;
- fim de fase condicionado ao boss ou aos colecionáveis;
- importação e exportação `.elfuego` com manifesto, checksum, limites e gravação transacional;
- testes automatizados com Vitest;
- CI com `npm ci`, lint, testes e build.

Ainda dependem de validação manual no navegador:

- player com um GLB real contendo todos os clips;
- alinhamento dos pés, direção esquerda/direita e hitbox visual do ataque;
- modelos GLB próprios para cacto e boss; atualmente o runtime visual desses inimigos usa representação provisória;
- 30 entradas e saídas consecutivas do modo Teste;
- medição prolongada de memória e quantidade de contextos WebGL;
- resize, fullscreen e DPI de 200%;
- fallback sem GLB, GLB inválido e asset removido diretamente do IndexedDB;
- revisão visual completa de início, meio e fim usando um projeto real preenchido.

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

## Spawn e entrada de cena

O formato ainda valida um spawn global por projeto usando os códigos `MISSING_GLOBAL_SPAWN` e `MULTIPLE_GLOBAL_SPAWNS`.

O runtime também aceita um `player-spawn` na cena de destino. Quando a cena não possui spawn próprio, cria uma entrada automática segura preservando o modelo, as animações e os atributos atuais do player.

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

## IA e combate

O cacto interpreta os campos configurados no editor:

- vida;
- limites de patrulha;
- distância de visão;
- velocidade de caminhada;
- velocidade de corrida;
- distância de ataque;
- dano;
- cooldown.

Fora da visão do player, ele continua caminhando. Ao detectar o player, corre em sua direção. Ao perder o alvo, retorna à patrulha sem teleporte. O ataque do player causa dano uma única vez por golpe.

O boss utiliza vida e quantidade de fases configuráveis. Conforme perde vida, aumenta velocidade e dano e reduz o intervalo entre ataques. O fim de fase permanece bloqueado enquanto houver boss vivo.

## Objetos do runtime

- `checkpoint`: altera posição e vida do próximo respawn;
- `finish`: próxima cena, cena específica ou conclusão;
- `pickup-*`: vida, ataque e defesa;
- `obstacle`: colisor sólido;
- `drop-zone`: morte ambiental;
- `no-collision-zone`: atravessa colisores dentro da área;
- `trigger`: dispara por entrada e pode ser limitado a uma vez;
- `dialogue-zone`: exibe o nome configurado como diálogo;
- `collectible`: coleta persistente e condição opcional para finalizar a cena.

## Pacote `.elfuego`

O pacote contém:

- `project.json`;
- `manifest.json`;
- arquivos binários em caminhos canônicos dentro de `assets/`.

A importação e a exportação validam tamanho, MIME, assinatura binária, checksum SHA-256, IDs duplicados, caminhos inseguros, arquivos extras e consistência entre projeto, manifesto e assets. A gravação ocorre somente depois de todas as validações.

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
