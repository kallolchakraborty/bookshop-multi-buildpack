// Domain model for the bookshop app, isolated under the "kallol.bookshop"
// namespace (company-app naming convention).
namespace kallol.bookshop;

/// An author who has written books in the shop.
entity Author {
  key ID   : Integer; // surrogate primary key
  name     : String(200);
  // Backlink enforced by the many-to-one association on Book.author.
  books    : Association to many Book on books.author = $self;
}

/// A single book title sold in the shop.
entity Book {
  key ID   : Integer; // surrogate primary key
  title    : String(200);
  author   : Association to Author; // many-to-one navigation to the author
  stock    : Integer;               // copies currently in stock
  price    : Decimal(9, 2);         // base price, discounted by Python functions
  descr    : String(1000);          // book description for semantic search RAG
  embedding: Vector(1536);          // native SAP HANA Cloud REAL_VECTOR column
}

/// A customer order for books.
entity Order {
  key ID        : Integer; // surrogate primary key
  book          : Association to Book; // the ordered book
  quantity      : Integer;
  amount        : Decimal(9, 2); // order total, computed at order time
  orderedAt     : Timestamp;     // point-in-time the order was placed
}