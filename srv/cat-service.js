// CAP service implementation for CatalogService (matched by file name srv/cat-service.cds).
const cds = require('@sap/cds')
// Shared, long-lived Python worker bridge (persistent interpreter, no per-request spawn).
const { python } = require('./python')

module.exports = cds.service.impl(async function () {
  const { Book } = this.entities // service projections exposed to clients

  // Handler for the unbound "discount" function declared in cat-service.cds.
  this.on('discount', async (req) => {
    const { title } = req.data // function parameter from the request URL
    // Look up the book by title so we always discount the stored price.
    const book = await SELECT.one.from(Book).where({ title })
    if (!book) {
      return req.reject(404, `No book titled '${title}'`) // unknown title -> HTTP 404
    }
    // Delegate the price calculation to Python via the worker bridge.
    const out = await python.call({ action: 'discount', title, price: Number(book.price) })
    return {
      title: book.title,
      original: out.original,
      discounted: out.discounted,
      rate: out.rate,
    }
  })
})