import express from 'express';

export const home = express.Router()

home.get('/', (req, res) => {
    res.send('Welcome to home page!')
})

home.get('/:string', (req, res) => {
    res.send(req.params.string + " newfile234")
})