# Produto — El Fuego Studio

## Visão

O El Fuego Studio é um editor visual independente para montagem de fases laterais do jogo El Fuego.

O usuário deve conseguir construir uma fase sem banco remoto, login ou serviço externo obrigatório. Depois que os assets forem carregados, o trabalho deve continuar localmente.

## Público

- criador das fases do El Fuego;
- designers de cenário;
- pessoas que configuram objetos e inimigos sem editar código;
- desenvolvedores responsáveis pelo runtime.

## Capacidades principais

- criar, renomear, duplicar, excluir e reorganizar cenas;
- importar e substituir cenários;
- inserir spawn, fim de fase, checkpoints, plataformas, recargas, inimigos e objetos;
- editar posição, dimensão, escala, rotação, visibilidade e bloqueio;
- selecionar, mover, redimensionar, copiar, colar e duplicar objetos;
- usar grade, snapping, alinhamento, zoom e pan;
- validar a fase antes do teste;
- testar no modo Jogar;
- salvar localmente;
- exportar e importar `.elfuego`;
- recuperar backups locais.

## Regras obrigatórias

### Projeto novo

Todo projeto novo começa com:

- uma cena vazia;
- nenhum player;
- nenhum cacto;
- nenhum chão;
- nenhuma plataforma;
- nenhuma recarga;
- nenhum fim da fase.

### Separação editor/runtime

O editor altera dados. O runtime executa mecânica.

Alterações visuais não podem alterar diretamente:

- física;
- colisão;
- animação;
- câmera;
- combate;
- máquina de estados;
- movimentação.

### Independência

O projeto exportado deve conter tudo que for necessário para recuperar a fase, incluindo assets locais e metadados.

### Hospedagem

O editor deve funcionar:

- localmente;
- no GitHub Pages;
- no GitLab Pages;
- sem Supabase;
- sem R2;
- sem API obrigatória.

## Critérios de sucesso

- projeto vazio abre sem erros;
- projeto salvo volta ao mesmo estado;
- exportação e importação preservam dados e assets;
- modo Jogar nunca altera silenciosamente o projeto;
- desfazer/refazer mantém consistência;
- cacto não congela, não teleporta e não reinicia animação a cada quadro;
- erros bloqueantes são exibidos antes do teste;
- falha no autosave não apaga o estado em memória.

## Fora do escopo inicial

- colaboração em tempo real;
- contas de usuário;
- banco em nuvem;
- marketplace;
- multiplayer;
- publicação direta de fases em servidor;
- reconstrução do runtime antes da análise do código original.
