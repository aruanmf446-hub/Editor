# Runtime

## Responsabilidade

O runtime recebe uma cópia validada do projeto e executa o jogo. Ele não deve alterar o documento original do editor.

## Sistemas

- `GameLoop`: delta time, pausa e atualização;
- `InputController`: teclado e controles futuros;
- `PhysicsSystem`: gravidade e movimento;
- `CollisionSystem`: chão, paredes, plataformas e zonas;
- `CameraController`: acompanhamento lateral e limites;
- `AnimationController`: transições sem reinício por quadro;
- `RuntimeObjectFactory`: converte objetos do projeto em entidades;
- `GameRuntime`: coordena inicialização, execução e encerramento.

## Regras

- usar delta time limitado para evitar saltos após travamentos;
- separar posição lógica da representação visual;
- nunca corrigir patrulha por teleporte;
- trocar animação apenas quando o estado muda;
- carregar assets por ID resolvido pelo repositório local;
- destruir listeners, mixers e recursos WebGL ao sair do modo Jogar;
- impedir que o modo Jogar escreva no histórico do editor.

## Entrada no modo Jogar

1. validar projeto;
2. clonar snapshot;
3. resolver assets;
4. localizar spawn e fim;
5. montar entidades;
6. iniciar loop;
7. bloquear edição.

## Saída

1. interromper loop;
2. remover inputs;
3. liberar recursos temporários;
4. descartar snapshot;
5. restaurar viewport e seleção do editor.

A implementação deve aguardar a análise do runtime original recuperado.
