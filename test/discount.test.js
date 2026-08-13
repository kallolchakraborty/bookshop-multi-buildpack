// Integration test: exercises the Python-backed discount() function end-to-end.
const { startServer } = require('./helpers')

async function main() {
  const server = await startServer() // boot CAP with in-memory db + seed data
  try {
    // Sanity check: the seeded Books are reachable over HTTP.
    const books = await server.request('/browse/Book?$top=1', {
      headers: { accept: 'application/json' },
    })
    if (!books.ok) throw new Error('GET Book failed: ' + books.status)

    // Call the discount function; CAP parses (title='...') path-syntax params.
    const res = await server.request("/browse/discount(title='The%20Bestseller')", {
      headers: { accept: 'application/json' },
    })
    const body = await res.json()
    if (!res.ok) throw new Error('discount failed: ' + res.status + ' ' + JSON.stringify(body))

    // "The Bestseller" matches the keyword "bestseller" -> 20% off EUR 10 = EUR 8.
    const expected = 8
    if (body.discounted !== expected) {
      throw new Error(`expected discounted ${expected}, got ${body.discounted}`)
    }
    console.log('PASS: discount(title=The Bestseller) ->', JSON.stringify(body))
  } catch (err) {
    console.error('FAIL:', err.message)
    console.error(server.logs())
    process.exitCode = 1
  } finally {
    server.stop()
  }
}

main().finally(() => process.exit(process.exitCode || 0)) // release keep-alive sockets so the test process exits