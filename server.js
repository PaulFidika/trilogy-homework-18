const express = require("express")
const logger = require("morgan")
const mongoose = require("mongoose")
const compression = require("compression")
require('dotenv').config()
const path = require('path')
const PORT = process.env.PORT || 3001
const app = express()

// app.use(logger("dev"))
app.use(compression())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(__dirname + "/public"))

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useFindAndModify: false
})
  .then(() => {
    console.log('database connection successful')
  })
  .catch((err) => {
    console.log('database connection error: ' + err)
  })

// routes
app.use(require(path.resolve(__dirname, "./routes/html.js")))
app.use(require(path.resolve(__dirname, "./routes/api.js")))

app.listen(PORT, () => {
  console.log(`App running on port http://localhost:${PORT}`)
})