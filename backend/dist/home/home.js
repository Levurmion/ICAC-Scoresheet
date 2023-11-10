"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.home = void 0;
const express_1 = __importDefault(require("express"));
exports.home = express_1.default.Router();
exports.home.get('/', (req, res) => {
    res.send('Welcome to home page!');
});
exports.home.get('/:string', (req, res) => {
    res.send(req.params.string + " newfile234");
});
//# sourceMappingURL=home.js.map