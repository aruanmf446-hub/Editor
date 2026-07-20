# Plano de recuperação

## Objetivo

Recuperar o código original sem misturar uma reconstrução apressada com a base funcional existente.

## Procedimento

1. Não reconstruir o runtime antes de recuperar o código ou declará-lo definitivamente perdido.
2. Fazer clone local imediatamente após a recuperação.
3. Criar um ZIP imutável da recuperação.
4. Espelhar o repositório no GitLab.
5. Criar a tag `recovery-baseline`.
6. Instalar dependências sem atualizar versões automaticamente.
7. Executar build, testes e modo de desenvolvimento sem alterações.
8. Registrar erros de console, build e runtime.
9. Inventariar recursos existentes por código real, não por nomes de arquivos.
10. Comparar cada recurso com o esboço oficial.
11. Preservar física, câmera, animação e controles que já funcionarem.
12. Criar uma branch pequena por melhoria.

## Inventário mínimo

- stack e versões;
- estrutura de diretórios;
- carregamento de GLB;
- AnimationMixer e clips;
- player e inputs;
- câmera;
- física e colisões;
- cenas e plano contínuo;
- canvas de edição;
- cacto e estados;
- persistência;
- exportação;
- testes;
- publicação.

## Evidências

Para cada recurso, registrar:

```text
Recurso:
Arquivos responsáveis:
Estado atual:
Como foi testado:
Problemas observados:
Decisão: preservar / corrigir / substituir / ainda investigar
```

## Proibições

- substituir o projeto inteiro sem análise;
- atualizar todas as dependências antes do baseline;
- apagar código considerado antigo sem teste;
- reescrever física por preferência pessoal;
- alterar modelos ou animações para mascarar bug de lógica;
- considerar recurso funcional apenas porque o arquivo existe;
- trabalhar diretamente na branch principal após a recuperação.

## Resultado esperado

Uma linha de base reproduzível, espelhada e documentada, permitindo migrar o projeto por etapas sem perder recursos funcionais.
