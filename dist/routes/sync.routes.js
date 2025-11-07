"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sync_controller_1 = require("../controllers/sync.controller");
const router = (0, express_1.Router)();
router.get('/full', sync_controller_1.fullSync);
exports.default = router;
