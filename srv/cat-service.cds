// Import the domain model from db/schema.cds, aliasing the namespace "shop".
using { kallol.bookshop as shop } from '../db/schema';

// The service is exposed at path "/browse" (e.g. http://localhost:4004/browse).
service CatalogService @(path : '/browse') {
  // Read-only-friendly projections of the underlying persistence for clients.
  entity Book   as projection on shop.Book;
  entity Author as projection on shop.Author;
  entity Order  as projection on shop.Order;

  // Unbound function: computes a discounted price for the given book title.
  // Implemented in srv/cat-service.js which delegates the math to Python.
  // Invoked like: GET /browse/discount(title='The%20Bestseller')
  function discount(title : String) returns {
    title      : String;      // the title that was looked up
    original   : Decimal(9,2); // price before discount
    discounted : Decimal(9,2); // price after the Python-computed discount
    rate       : Decimal(4,2); // discount rate applied (0..1)
  };
}