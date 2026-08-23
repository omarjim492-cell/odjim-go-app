ODJIM GO — R16.25 Refatoração

Estrutura:
- index.html: entry point
- css/odjim.css: estilos extraídos
- js/app.js: JavaScript da aplicação extraído
- firebase/: regras/configuração disponíveis da etapa anterior

Objetivo:
- reduzir o monólito index_1.html;
- preservar o HTML e a lógica existentes;
- criar fronteira clara entre apresentação e aplicação.

Nota:
- esta etapa é uma refatoração estrutural. Não declara deploy Firebase.
- testes de runtime dependentes do Firebase devem ser executados com o projeto configurado.
