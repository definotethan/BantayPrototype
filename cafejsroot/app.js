const express = require('express')
const ejs = require('ejs')
const cookieParser = require('cookie-parser')
const path = require('path')

const app = express()
const port = 3000

app.use(express.json()) // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })) // Middleware to parse URL-encoded bodies
app.use(cookieParser()) // Middleware to parse cookies
app.use(express.static(path.join(__dirname, 'public'))) // Serve static files from 'public' directory

// Root Route
app.get('/', (req, res) => {
    res.redirect('/sos') // Redirect root to /sos
})

// Login Route
app.post('/login', (req, res) => {
    const username = req.body.username // Get username from request body
    res.cookie('username', username) // Set cookie with username
    res.redirect('/sos') // Redirect to /sos after login
})

// SOS Page Route
app.get('/sos', (req, res) => {
    const username = req.cookies.username || 'User' // Get username from cookies or default to 'User'
    ejs.renderFile('views/sos.ejs', { username: username }, (err, str) => {
        res.send(str) // Render and send the SOS page
    })
})

// Safety Map Page Route
app.get('/safety-map', (req, res) => {
    ejs.renderFile('views/safety_map.ejs', (err, str) => {
        res.send(str) // Render and send the safety map page
    })
})

// Login Page Route
app.get('/login', (req, res) => {
    ejs.renderFile('views/login.ejs', (err, str) => {
        res.send(str) // Render and send the login page
    })
})

app.listen(port, () => console.log(`App is listening on port ${port}`)) // Start the server