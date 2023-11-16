import express from 'express'
import { home } from './home/home'
import cors from 'cors'

const app = express()

app.use(cors({
    origin: 'http://frontend',
    credentials: true
}))

app.use('/home', home)

app.get('/', (req, res) => {
    res.send('Welcome to ICAC Scoresheet!')
})

app.listen(3001, () => {
    console.log('Application listening on port 3001')
})