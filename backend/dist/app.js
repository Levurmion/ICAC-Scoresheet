"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const home_1 = require("./home/home");
const app = (0, express_1.default)();
app.use('/home', home_1.home);
app.get('/', (req, res) => {
    res.send('Welcome to ICAC Scoresheet!');
});
app.listen(3001, () => {
    console.log('Application listening on port 3001');
});
//# sourceMappingURL=app.js.map