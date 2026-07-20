# Máquina de estados do cacto

## Estados

```text
PATROL
CHASE
ATTACK
RETURN_TO_PATROL
```

## Fluxo

```text
PATROL
  ↓ jogador detectado
CHASE
  ↓ jogador próximo
ATTACK
  ↓ jogador distante
CHASE
  ↓ jogador fora da visão
RETURN_TO_PATROL
  ↓ área recuperada
PATROL
```

## PATROL

- caminhar continuamente entre os limites;
- nunca permanecer congelado fora da visão;
- virar ao alcançar um limite;
- usar animação de caminhada;
- manter velocidade de patrulha.

## CHASE

- correr em direção ao jogador;
- respeitar colisões;
- não teleportar;
- não reiniciar animação em cada quadro;
- entrar em ataque somente dentro da distância configurada.

## ATTACK

- interromper avanço;
- orientar-se para o jogador;
- executar ataque conforme intervalo;
- aplicar dano uma única vez na janela válida;
- considerar defesa e invulnerabilidade.

## RETURN_TO_PATROL

- escolher o ponto válido mais próximo da patrulha;
- retornar caminhando;
- não reposicionar instantaneamente;
- voltar para `PATROL` ao recuperar a área.

## Regra de transição

```ts
if (nextState !== currentState) {
  exitState(currentState);
  currentState = nextState;
  enterState(nextState);
}
```

A animação deve ser iniciada em `enterState`, não no update de cada frame.

## Movimento

```ts
position.x += direction * speed * deltaTime;
```

É proibido corrigir retorno com atribuição instantânea da posição.

## Configurações vindas do editor

- direção inicial;
- limite esquerdo;
- limite direito;
- área de visão;
- velocidade andando;
- velocidade correndo;
- distância de ataque;
- dano;
- intervalo de ataque.

O editor fornece valores; o controlador implementa o comportamento.

## Testes obrigatórios

- patrulha sem player visível;
- transição caminhada → corrida;
- perseguição sem teleporte;
- ataque respeitando cooldown;
- perda do player durante ataque;
- retorno caminhando;
- troca de animação somente na mudança de estado;
- delta time alto sem atravessar o cenário.
