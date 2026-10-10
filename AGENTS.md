# TCR Ingressos: regra obrigatória de produção

Para qualquer publicação, deploy ou promoção deste projeto, use a Skill `tcr-safe-production-deploy` e leia `docs/workspace-e-deploy-seguro.md`.

O único comando autorizado para publicar em produção é:

```bash
npm run deploy:production
```

Nunca execute diretamente `vercel --prod`, `npx vercel --prod` ou uma promoção manual. Não contorne a trava quando houver arquivos sem commit, branch diferente de `main`, operação Git incompleta ou divergência com `origin/main`.

Antes de resolver conflitos, preserve o trabalho existente e integre as funcionalidades dos dois lados. Depois do deploy, valide os domínios reais e os fluxos alterados antes de declarar conclusão.

## Coordenação obrigatória entre chats

Antes de qualquer alteração, otimização, implementação ou publicação, confira o estado do Git e se outro chat do projeto está trabalhando na mesma área ou preparando um deploy. Quando houver sobreposição, converse com a outra frente para dividir arquivos e responsabilidades ou definir a ordem de integração. Não sobrescreva mudanças alheias, não faça deploys simultâneos e não assuma que um chat ocioso deixou o checkout livre: verifique também os arquivos modificados e não rastreados.

Ao terminar, informe às outras frentes envolvidas quais arquivos e commits foram alterados e se há publicação em andamento ou concluída. Compartilhe atualizações úteis para coordenação; nenhuma frente deve declarar uma funcionalidade publicada apenas por ter concluído sua implementação local.
