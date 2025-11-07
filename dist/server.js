"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const sync_routes_1 = __importDefault(require("./routes/sync.routes"));
const produtos_routes_1 = __importDefault(require("./routes/produtos.routes"));
const contagens_routes_1 = __importDefault(require("./routes/contagens.routes"));
const eans_routes_1 = __importDefault(require("./routes/eans.routes")); // 
const lojas_routes_1 = __importDefault(require("./routes/lojas.routes"));
const usuarios_routes_1 = __importDefault(require("./routes/usuarios.routes"));
const swagger_1 = require("./swagger"); // 
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/auth', auth_routes_1.default);
app.use('/sync', sync_routes_1.default);
app.use('/produtos', produtos_routes_1.default);
app.use('/contagens', contagens_routes_1.default);
app.use('/eans', eans_routes_1.default);
app.use('/lojas', lojas_routes_1.default);
app.use('/usuarios', usuarios_routes_1.default);
(0, swagger_1.setupSwagger)(app); // 👈 ativa o Swagger em /api-docs
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
});
exports.default = app;
