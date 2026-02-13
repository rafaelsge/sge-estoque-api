
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import syncRoutes from './routes/sync.routes';
import produtosRoutes from './routes/produtos.routes';
import contagensRoutes from './routes/contagens.routes';
import eansRoutes from './routes/eans.routes'; // 
import lojasRoutes from './routes/lojas.routes';
import usuariosRoutes from './routes/usuarios.routes';
import validadeRoutes from './routes/validade.routes';
import configuracaoRoutes from './routes/configuracao.routes';
import pedidosRestauranteRoutes from './routes/pedidos_restaurante.routes';
import clientesRoutes from './routes/clientes.routes';
import condicaoPagamentoRoutes from './routes/condicao_pagamento.routes';
import estoqueRoutes from './routes/estoque.routes';
import pedidosRoutes from './routes/pedidos.routes';
import { setupSwagger } from './swagger'; // 

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/produtos', produtosRoutes);
app.use('/contagens', contagensRoutes);
app.use('/eans', eansRoutes);
app.use('/lojas', lojasRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/validade', validadeRoutes);
app.use('/configuracao', configuracaoRoutes);
app.use('/pedidos/restaurante', pedidosRestauranteRoutes);
app.use('/clientes', clientesRoutes);
app.use('/condicao-pagamento', condicaoPagamentoRoutes);
app.use('/condpag', condicaoPagamentoRoutes);
app.use('/estoque', estoqueRoutes);
app.use('/pedidos', pedidosRoutes);

setupSwagger(app); // 👈 ativa o Swagger em /api-docs

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

export default app;
