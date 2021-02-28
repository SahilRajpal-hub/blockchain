const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const { urlencoded } = require('body-parser')
const Blockchain = require('./blockchain')
const { v1: uuidv4 } = require('uuid')
const rp = require('request-promise')
const port = process.argv[2]

const nodeAddress = uuidv4().split('-').join('')

const blockchain = new Blockchain()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.get('/blockchain', (req, res) => {
  res.send(blockchain)
})

app.post('/transaction', (req, res) => {
  const blockIndex = blockchain.createNewTransaction(
    req.body.amount,
    req.body.sender,
    req.body.recipient
  )
  res.json({
    note: `Transactions will be added to block number ${blockIndex}.`,
  })
})

app.get('/mine', (req, res) => {
  const lastBlock = blockchain.getLastBlock()
  const previousBlockHash = lastBlock['hash']

  const currentBlockData = {
    transactions: blockchain.pendingTransactions,
    index: lastBlock['index'] + 1,
  }
  const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData)

  const hash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce)

  blockchain.createNewTransaction(12.5, '00', nodeAddress)

  const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, hash)

  res.json({
    note: 'New Block mined successfull',
    block: newBlock,
  })
})

// register a node and broadcast it to the network
app.post('/register-and-broadcast-node', (req, res) => {
  const newNodeUrl = req.body.newNodeUrl
  if (blockchain.networkNodes.indexOf(newNodeUrl) == -1)
    blockchain.networkNodes.push(newNodeUrl)

  const registerNodePromises = []
  blockchain.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      uri: networkNodeUrl + '/register-node',
      method: 'POST',
      body: { networkNodeUrl: networkNodeUrl },
      json: true,
    }

    registerNodePromises.push(rp(requestOptions))
  })

  Promise.all(registerNodePromises)
    .then((data) => {
      const bulkRegisterOptions = {
        uri: newNodeUrl + '/register-nodes-bulk',
        method: 'POST',
        body: {
          allNetworkNodes: [
            ...(blockchain.networkNodes + blockchain.currentNetworkUrl),
          ],
        },
        json: true,
      }

      return rp(bulkRegisterOptions)
    })
    .then((data) => {
      res.json({ note: 'New Node registered with network successfully' })
    })
})

// register a node with network
app.post('/register-node', (req, res) => {
  const newNodeUrl = req.body.newNodeUrl
  const nodeNotAlreadyPresent =
    blockchain.networkNodes.indexOf(newNodeUrl) === -1
  const notCurrentNode = blockchain.currentNetworkUrl !== newNodeUrl
  if (nodeNotAlreadyPresent && notCurrentNode)
    blockchain.networkNodes.push(newNodeUrl)
  res.json({ note: 'New Node registered successfully.' })
})

// register multiple node at once
app.post('/register-nodes-bulk', (req, res) => {
  const allNetworkNodes = req.body.allNetworkNodes
  allNetworkNodes.forEach((networkNodeUrl) => {
    const nodeNotAlreadyPresent =
      blockchain.networkNodes.indexOf(networkNodeUrl) === -1
    const notCurrentNode = blockchain.currentNetworkUrl !== networkNodeUrl
    if (nodeNotAlreadyPresent && notCurrentNode)
      blockchain.networkNodes.push(networkNodeUrl)

    res.json({ note: 'Bulk registration successful.' })
  })
})

app.listen(port, () => console.log(`Server listening on port ${port}...`))
