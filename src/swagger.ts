import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

export function setupSwagger(app: Express) {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'API - Contagem de Estoque (SGE ERP)',
        version: '1.0.0',
        description: `
API utilizada pelo aplicativo móvel de contagem de estoque conectado ao SGE ERP.  
Permite login de usuários, sincronização de contagens e atualização de produtos.
        `,
        contact: {
          name: 'Equipe SGE Software',
          email: 'suporte@sgesistema.com.br',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Servidor Local',
        },
      ],
    },
    apis: ['./src/routes/*.ts'], // lê as anotações das rotas
  };

  const swaggerSpec = swaggerJSDoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

  console.log('📘 Swagger disponível em: http://localhost:3001/api-docs');
}
