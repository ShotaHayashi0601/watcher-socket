require('dotenv').config()
const express = require('express')
const { createServer } = require('http')
const next = require('next')
const webSocket = require('ws')

// ===========================
// 1. Setup Next.js and Express
// ===========================
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handler = app.getRequestHandler()

const server = express()
const httpServer = createServer(server)

// JSON middleware
server.use(express.json())

// ===========================
// 2. Setup WebSocket Server
// ===========================
const wss = new webSocket.Server({ server: httpServer })
const watchers = new Map() //productId: watcher count
wss.on('connection', (ws, req) => {
  const productId = req.url && req.url.split('/').pop()
  if (!productId) return
  //Increment watcher count
  const currentCount = (watchers.get(productId) || 0) + 1
  watchers.set(productId, currentCount)
  console.log(
    `New connection for product ${productId}: ${currentCount} watchers`
  )
  // Notify all connected clients about the new watcher count
  wss.clients.forEach((client) => {
    if (client.readyState === webSocket.OPEN) {
      client.send(JSON.stringify({ productId, count: currentCount }))
    }
  })
  // Handle disconnection
  ws.on('close', () => {
    const updatedCount = Math.max((watchers.get(productId) || 0) - 1, 0)
    if (updatedCount === 0) {
      watchers.delete(productId)
    } else {
      watchers.set(productId, updatedCount)
    }
    // ★ 全クライアントに「人数減ったよ」と通知
    wss.clients.forEach((client) => {
      if (client.readyState === webSocket.OPEN) {
        client.send(
          JSON.stringify({
            productId,
            count: updatedCount,
          })
        )
      }
    })
  })
  //Send initial message
  ws.send(
    JSON.stringify({
      message: 'Connected to the websocket server',
      productId,
      count: currentCount,
    })
  )
})

// ===========================
// 3. Health Check Endpoint
// ===========================
server.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: {
      connectedClients: wss.clients.size,
      activeProducts: watchers.size,
    },
  })
})

// ===========================
// 4. Handle Next.js Routing
// ===========================
server.all('*', (req, res) => {
  return handler(req, res)
})

// ===========================
// 5. Start the Server
// ===========================
httpServer.listen(process.env.PORT, (err) => {
  if (err) throw err
  console.log(`Server is running on port ${process.env.PORT}`)
})
