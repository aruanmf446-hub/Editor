# Persistência

## IndexedDB

Usar IndexedDB para armazenar:

- projetos;
- cenas e documento serializado;
- assets binários;
- histórico recuperável;
- backups;
- metadados de versão.

Dexie é a camada recomendada, sujeita à comparação com o código recuperado.

## localStorage

Guardar somente:

- ID do projeto recente;
- preferências visuais;
- última cena selecionada;
- zoom e grade quando apropriado.

Assets e projetos completos não devem ser armazenados no `localStorage`.

## Autosave

```text
alteração
  ↓
marcar como não salvo
  ↓
debounce
  ↓
salvar no IndexedDB
  ↓
marcar como salvo
```

Valor inicial sugerido: 1,5 segundo após a última alteração.

## Backups

- criar backup periódico separado do autosave;
- criar backup antes de importação;
- criar backup antes de migração;
- manter inicialmente até 10 versões por projeto;
- nunca apagar a última versão válida durante uma gravação.

## Falhas

Uma falha de persistência:

- exibe erro;
- mantém o projeto em memória;
- mantém o estado como não salvo;
- permite exportação manual;
- não substitui um backup válido por dados incompletos.

## Assets

Cada asset possui:

- ID;
- nome original;
- MIME type;
- tamanho;
- hash;
- categoria;
- Blob.

URLs criadas com `URL.createObjectURL` são temporárias e devem ser revogadas.

## Migrações

- migrar cópia em memória;
- validar resultado;
- persistir somente após sucesso;
- preservar backup anterior;
- registrar versão de origem e destino.
