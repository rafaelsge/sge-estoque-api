import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';

export function setupSwagger(app: Express) {
  const isDist = path.basename(__dirname).toLowerCase() === 'dist';

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
          email: 'rafael@sgeerp.com.br',
        },
      },
      servers: [
        {
          url: 'http://192.168.1.24:3001/',
          description: 'Servidor Local',
        },
      ],
    },
    // Suporta execução via ts-node (src) e build (dist)
    apis: [path.join(__dirname, 'routes', isDist ? '*.js' : '*.ts')],
  };

  const swaggerSpec = swaggerJSDoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

  console.log('📘 Swagger disponível em: http://192.168.1.24:3001/api-docs');
}
