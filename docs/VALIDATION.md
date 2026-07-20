# Validação

## Níveis

### Erros bloqueantes

Impedem o modo Jogar:

- projeto sem cena;
- falta de spawn do player;
- mais de um spawn ativo quando não permitido;
- falta de fim da fase;
- ausência de suporte físico utilizável;
- IDs duplicados;
- referência a asset inexistente;
- valores numéricos inválidos;
- tipo de objeto desconhecido sem suporte de runtime.

### Avisos

Não impedem o teste:

- cena sem cenário;
- inimigo sem plataforma aparente;
- recarga fora da área da cena;
- objetos sobrepostos;
- fim muito próximo do spawn;
- limites de patrulha invertidos;
- objeto invisível no jogo;
- cenário sem thumbnail.

## Resultado

```ts
type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  sceneId?: string;
  objectId?: string;
  path?: string;
};
```

A validação retorna todos os problemas encontrados, sem parar no primeiro erro.

## Etapas

1. validar formato e versão;
2. validar metadados;
3. validar IDs e referências;
4. validar cenas;
5. validar objetos;
6. executar regras de gameplay;
7. classificar erros e avisos.

## Regras de segurança

- não corrigir automaticamente dados destrutivos;
- sugestões de correção devem ser explícitas;
- migração e validação são operações separadas;
- o modo Jogar usa apenas documento validado;
- importação inválida não substitui o projeto aberto.
