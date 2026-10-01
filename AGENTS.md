# TCR Ingressos: regra obrigatória de produção

Para qualquer publicação, deploy ou promoção deste projeto, use a Skill `tcr-safe-production-deploy` e leia `docs/workspace-e-deploy-seguro.md`.

O único comando autorizado para publicar em produção é:

```bash
npm run deploy:production
```

Nunca execute diretamente `vercel --prod`, `npx vercel --prod` ou uma promoção manual. Não contorne a trava quando houver arquivos sem commit, branch diferente de `main`, operação Git incompleta ou divergência com `origin/main`.

Antes de resolver conflitos, preserve o trabalho existente e integre as funcionalidades dos dois lados. Depois do deploy, valide os domínios reais e os fluxos alterados antes de declarar conclusão.
