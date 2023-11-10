import express from 'express'
import { home } from './home/home'

const app = express()

app.use('/home', home)

app.get('/', (req, res) => {
    res.send('Welcome to ICAC Scoresheet!')
})

app.listen(3001, () => {
    console.log('Application listening on port 3001')
})