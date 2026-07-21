# Formato do projeto

## Identificação

```json
{
  "format": "el-fuego-studio-project",
  "version": 1
}
```

Projetos com outro `format` são rejeitados. Versões anteriores podem ser migradas. Versões futuras desconhecidas não devem ser alteradas silenciosamente.

## Documento mínimo

```json
{
  "format": "el-fuego-studio-project",
  "version": 1,
  "project": {
    "id": "uuid",
    "name": "Minha fase",
    "createdAt": "2026-07-20T00:00:00.000Z",
    "updatedAt": "2026-07-20T00:00:00.000Z"
  },
  "settings": {
    "gravity": -24,
    "gridSize": 16,
    "snapEnabled": true,
    "defaultSceneWidth": 1920,
    "defaultSceneHeight": 1080
  },
  "assets": [],
  "campaign": {
    "chapters": [
      {
        "id": "cidade-desertica",
        "name": "Cidade desértica",
        "levels": [
          {
            "id": "fase-01",
            "name": "Fase 01",
            "initialSceneId": "uuid-da-cena",
            "unlockAfterLevelId": null
          }
        ]
      }
    ]
  },
  "scenes": [
    {
      "id": "uuid",
      "name": "Cena 1",
      "order": 0,
      "width": 1920,
      "height": 1080,
      "backgroundAssetId": null,
      "objects": []
    }
  ]
}
```

## Regras

- projeto criado pelo editor sempre possui uma cena vazia;
- IDs são UUIDs e não dependem de nomes;
- cenas usam ordem explícita;
- assets são referenciados por ID;
- URLs temporárias de blob nunca são serializadas;
- datas usam ISO 8601 UTC;
- posições e dimensões devem ser números finitos;
- objetos desconhecidos devem ser preservados em migrações quando possível.
- campanha é opcional para manter compatibilidade com projetos antigos;
- fases apontam para cenas iniciais por ID e não substituem a estrutura de cenas;
- progresso do jogador não faz parte do pacote editável e é salvo separadamente.

## Tipos iniciais de objeto

- `player-spawn`;
- `finish`;
- `checkpoint`;
- `platform`;
- `wall`;
- `drop-zone`;
- `no-collision-zone`;
- `pickup-health`;
- `pickup-attack`;
- `pickup-defense`;
- `enemy-cactus`;
- `boss`;
- `decoration`;
- `obstacle`;
- `trigger`;
- `dialogue-zone`;
- `collectible`.

## Transformação comum

```json
{
  "x": 0,
  "y": 0,
  "z": 0,
  "width": 100,
  "height": 100,
  "scaleX": 1,
  "scaleY": 1,
  "rotation": 0
}
```

## Pacote `.elfuego`

O arquivo é um ZIP com extensão própria:

```text
project.elfuego
├── manifest.json
├── project.json
├── assets/
│   ├── backgrounds/
│   ├── models/
│   ├── textures/
│   └── audio/
└── thumbnails/
```

## Manifesto

Cada asset deve registrar:

- ID;
- caminho interno;
- nome original;
- MIME type;
- tamanho;
- checksum;
- categoria.

## Importação segura

1. abrir ZIP sem executar conteúdo;
2. limitar tamanho e quantidade de arquivos;
3. validar caminhos contra path traversal;
4. validar `manifest.json`;
5. validar schema do projeto;
6. comparar checksums;
7. criar backup antes de substituir o projeto atual;
8. migrar em memória;
9. persistir somente após sucesso total.
