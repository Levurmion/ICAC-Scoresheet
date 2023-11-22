import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import auth from './auth/auth'

// initialize environment variables
import 'dotenv/config'

const app = express()

// GLOBAL MIDDLEWARES
app.use(cors({
    origin: 'http://frontend',
    credentials: true
}))
app.use(cookieParser())
app.use(express.json())

// ROUTES
app.use('/auth', auth)

app.get('/', (req, res) => {
    res.send('Welcome to ICAC Scoresheet APIs!')
})

app.listen(3001, () => {
    console.log('Application listening on port 3001')
})