# Editor UX

## Estrutura

```text
┌────────────────────────────────────────────────────────────┐
│ El Fuego Studio   Desfazer/Refazer   Editar/Jogar   Salvar │
├────────────────────────────────────────────────────────────┤
│ Cenário │ Fluxo │ Física │ Recargas │ Inimigos │ Objetos   │
├──────────────┬───────────────────────────────┬─────────────┤
│ Cenas/Árvore │            Canvas             │ Propriedades│
├──────────────┴───────────────────────────────┴─────────────┤
│ Linha de cenas contínuas                  Zoom / Grade      │
└────────────────────────────────────────────────────────────┘
```

## Cabeçalho

- nome do projeto;
- desfazer e refazer;
- modo Editar;
- modo Jogar;
- novo projeto;
- abrir projeto;
- exportar;
- salvar;
- indicador de salvamento.

Estados do salvamento:

- Salvo;
- Alterações não salvas;
- Salvando...;
- Erro ao salvar;
- Backup recuperado.

## Ferramentas

### Cenário

Importar, substituir, remover, ajustar, preencher, recortar e reduzir opacidade durante edição.

### Fluxo

Spawn, fim da fase, checkpoint e transição entre cenas.

### Física

Chão, plataforma, parede, plataforma atravessável, zona de queda e área sem colisão.

### Recargas

Vida, ataque e defesa.

### Inimigos

Cacto, inimigos futuros e boss.

### Objetos

Decoração, obstáculo, gatilho, área de diálogo e coletável.

## Cenas

Cada cena permite criar, selecionar, renomear, duplicar, excluir, reorganizar, mover, definir largura e alterar cenário.

A sequência deve formar um plano contínuo. A posição global de uma cena é calculada pela soma das larguras das cenas anteriores.

## Árvore de objetos

Cada item permite:

- selecionar;
- renomear;
- duplicar;
- bloquear;
- ocultar;
- excluir.

A árvore deve refletir a ordem visual e o agrupamento por cena.

## Canvas

Operações obrigatórias:

- seleção simples e múltipla;
- arrastar;
- redimensionar;
- copiar, colar e duplicar;
- excluir;
- zoom e pan;
- grade e snapping;
- linhas de alinhamento;
- enquadrar seleção e cena.

## Gizmo

O objeto selecionado exibe:

- caixa delimitadora;
- alças laterais e de canto;
- centro;
- largura e altura;
- linhas de alinhamento.

## Inspector

Campos comuns:

- nome e tipo;
- posição X/Y;
- largura e altura;
- escala X/Y;
- rotação;
- visível;
- bloqueado.

Campos específicos aparecem conforme o tipo do objeto. O inspector configura valores, sem conter lógica de gameplay.

## Atalhos

```text
Ctrl+S        salvar
Ctrl+Z        desfazer
Ctrl+Y        refazer
Ctrl+Shift+Z  refazer
Ctrl+C        copiar
Ctrl+V        colar
Ctrl+D        duplicar
Delete        excluir
Setas         mover com precisão
Shift+setas   movimento maior
Espaço+arraste mover câmera
Roda          zoom
F             enquadrar seleção
```

## Modo Jogar

Antes de iniciar, executar validação. Durante o teste:

- bloquear edição;
- ocultar ou desabilitar o inspector;
- mostrar HUD;
- seguir o player com a câmera;
- exibir Parar teste;
- usar uma cópia imutável do projeto para evitar alterações acidentais.

## Acessibilidade

- foco visível;
- atalhos documentados;
- botões com rótulos acessíveis;
- não depender apenas de cor;
- campos numéricos utilizáveis pelo teclado;
- respeito a `prefers-reduced-motion`.
