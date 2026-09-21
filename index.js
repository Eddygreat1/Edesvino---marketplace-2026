

const express = require("express");
const initSqlJs = require("sql.js");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = "./edesvino.db";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const style = `
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f5f7fa;color:#222}
header{background:#111827;color:white;padding:20px;text-align:center}
.container{max-width:700px;margin:30px auto;padding:20px}
.card{background:white;padding:25px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
input,textarea{width:100%;padding:12px;margin:8px 0 15px;box-sizing:border-box;border:1px solid #ccc;border-radius:7px}
textarea{min-height:100px}
button,.button{display:inline-block;background:#111827;color:white;padding:12px 18px;border:none;border-radius:7px;text-decoration:none;cursor:pointer;margin:5px 3px}
.button.secondary{background:#555}
.product{border:1px solid #ddd;padding:18px;border-radius:10px;margin-bottom:15px;background:white}
.price{font-size:20px;font-weight:bold}
footer{text-align:center;padding:30px;color:#777}
</style>
`;

function page(title, content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
${style}
</head>
<body>
<header>
<h1>Edesvino Marketplace</h1>
<p>Buy and sell products online</p>
</header>
<div class="container">${content}</div>
<footer>Edesvino Marketplace © 2026</footer>
</body>
</html>`;
}

let db;

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function getRows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

async function startServer() {
  const SQL = await initSqlJs({
    locateFile: file => require.resolve("sql.js/dist/" + file)
  });

  if (fs.existsSync(DB_FILE)) {
    const file = fs.readFileSync(DB_FILE);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      store TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sellerId INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT NOT NULL,
      store TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER,
      fullName TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL
    );
  `);

  saveDatabase();

  // HOME
  app.get("/", (req, res) => {
    res.send(page("Edesvino Marketplace", `
      <div class="card">
        <h2>Welcome to Edesvino Marketplace</h2>
        <p>A marketplace where sellers can list products and customers can shop online.</p>

        <a class="button" href="/products">Shop Products</a>
        <a class="button" href="/seller/register">Become a Seller</a>
      </div>

      <div class="card">
        <h3>How Edesvino Works</h3>
        <ol>
          <li>Sellers register their businesses.</li>
          <li>Sellers add their products.</li>
          <li>Customers browse products.</li>
          <li>Customers place orders.</li>
        </ol>
      </div>
    `));
  });

  // PRODUCTS
  app.get("/products", (req, res) => {
    const products = getRows(`
      SELECT * FROM products
      ORDER BY id DESC
    `);

    let productHTML = "";

    if (products.length === 0) {
      productHTML = `
        <div class="card">
          <p><strong>No products yet.</strong></p>
          <p>Sellers will soon be able to upload their products here.</p>
        </div>
      `;
    } else {
      products.forEach(product => {
        productHTML += `
          <div class="product">
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong>Store:</strong> ${product.store}</p>
            <p class="price">₦${Number(product.price).toLocaleString()}</p>

            <a class="button" href="/order?product=${product.id}">
              Buy Now
            </a>
          </div>
        `;
      });
    }

    res.send(page("Shop Products", `
      <h2>Shop Products</h2>
      ${productHTML}
      <a class="button secondary" href="/">← Back to Marketplace</a>
    `));
  });

  // ORDER PAGE
  app.get("/order", (req, res) => {
    const productId = Number(req.query.product);

    let product = null;

    if (productId) {
      const rows = getRows(
        "SELECT * FROM products WHERE id = ?",
        [productId]
      );
      product = rows[0];
    }

    res.send(page("Place Order", `
      <div class="card">
        <h2>Place Your Order</h2>

        ${
          product
            ? `
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>Price:</strong> ₦${Number(product.price).toLocaleString()}</p>
            `
            : ""
        }

        <form method="POST" action="/order">

          <input type="hidden" name="productId" value="${product ? product.id : ""}">

          <label>Full Name</label>
          <input type="text" name="fullName" required>

          <label>Phone Number</label>
          <input type="text" name="phone" required>

          <label>Delivery Address</label>
          <textarea name="address" required></textarea>

          <button type="submit">Place Order</button>
        </form>
      </div>

      <a class="button secondary" href="/products">
        ← Back to Products
      </a>
    `));
  });

  // SUBMIT ORDER
  app.post("/order", (req, res) => {
    db.run(
      `INSERT INTO orders
       (productId, fullName, phone, address)
       VALUES (?, ?, ?, ?)`,
      [
        req.body.productId || null,
        req.body.fullName,
        req.body.phone,
        req.body.address
      ]
    );

    saveDatabase();

    const rows = getRows(
      "SELECT last_insert_rowid() AS id"
    );

    res.redirect("/order-success/" + rows[0].id);
  });

  // ORDER SUCCESS
  app.get("/order-success/:id", (req, res) => {
    const orderRows = getRows(
      "SELECT * FROM orders WHERE id = ?",
      [Number(req.params.id)]
    );

    const order = orderRows[0];

    let product = null;

    if (order && order.productId) {
      const productRows = getRows(
        "SELECT * FROM products WHERE id = ?",
        [order.productId]
      );
      product = productRows[0];
    }

    res.send(page("Order Successful", `
      <div class="card">
        <h2>Order Submitted Successfully! ✅</h2>

        <p>Thank you, <strong>${order ? order.fullName : "Customer"}</strong>.</p>

        <p>Your order has been received by Edesvino Marketplace.</p>

        ${
          order
            ? `<p><strong>Order Number:</strong> ${order.id}</p>`
            : ""
        }

        ${
          product
            ? `
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>Price:</strong> ₦${Number(product.price).toLocaleString()}</p>
            `
            : ""
        }

        ${
          order
            ? `
              <p><strong>Phone:</strong> ${order.phone}</p>
              <p><strong>Delivery Address:</strong> ${order.address}</p>
            `
            : ""
        }

        <a class="button" href="/products">Continue Shopping</a>
        <a class="button secondary" href="/">Back to Marketplace</a>
      </div>
    `));
  });

  // SELLER REGISTER
  app.get("/seller/register", (req, res) => {
    res.send(page("Become a Seller", `
      <div class="card">
        <h2>Become a Seller</h2>

        <form method="POST" action="/seller/register">

          <label>Full Name</label>
          <input type="text" name="fullName" required>

          <label>Store / Business Name</label>
          <input type="text" name="store" required>

          <label>Email Address</label>
          <input type="email" name="email" required>

          <label>Phone Number</label>
          <input type="text" name="phone" required>

          <button type="submit">Register as Seller</button>
        </form>
      </div>

      <a class="button secondary" href="/">
        ← Back to Marketplace
      </a>
    `));
  });

  // REGISTER SELLER
  app.post("/seller/register", (req, res) => {
    db.run(
      `INSERT INTO sellers
       (fullName, store, email, phone)
       VALUES (?, ?, ?, ?)`,
      [
        req.body.fullName,
        req.body.store,
        req.body.email,
        req.body.phone
      ]
    );

    saveDatabase();

    const rows = getRows(
      "SELECT last_insert_rowid() AS id"
    );

    res.redirect("/seller/success/" + rows[0].id);
  });

  // SELLER SUCCESS
  app.get("/seller/success/:id", (req, res) => {
    const rows = getRows(
      "SELECT * FROM sellers WHERE id = ?",
      [Number(req.params.id)]
    );

    const seller = rows[0];

    if (!seller) {
      return res.send("Seller not found.");
    }

    res.send(page("Seller Registration Successful", `
      <div class="card">
        <h2>Seller Registration Successful! ✅</h2>

        <p>
          Welcome to Edesvino Marketplace,
          <strong>${seller.fullName}</strong>.
        </p>

        <p>
          Your store <strong>${seller.store}</strong>
          has been registered.
        </p>

        <p><strong>Email:</strong> ${seller.email}</p>
        <p><strong>Phone:</strong> ${seller.phone}</p>

        <a class="button" href="/seller/dashboard/${seller.id}">
          Go to Seller Dashboard
        </a>

        <a class="button secondary" href="/">
          Return to Marketplace
        </a>
      </div>
    `));
  });

  // SELLER DASHBOARD
  app.get("/seller/dashboard/:id", (req, res) => {
    const sellerRows = getRows(
      "SELECT * FROM sellers WHERE id = ?",
      [Number(req.params.id)]
    );

    const seller = sellerRows[0];

    if (!seller) {
      return res.send("Seller not found.");
    }

    const products = getRows(
      "SELECT * FROM products WHERE sellerId = ? ORDER BY id DESC",
      [seller.id]
    );

    let productList = "";

    if (products.length === 0) {
      productList = `<p><strong>You have not added any products yet.</strong></p>`;
    } else {
      products.forEach(product => {
        productList += `
          <div class="product">
            <h3>${product.name}</h3>
            <p>₦${Number(product.price).toLocaleString()}</p>
            <p>${product.description}</p>
          </div>
        `;
      });
    }

    res.send(page("Seller Dashboard", `
      <div class="card">
        <h2>Seller Dashboard</h2>

        <p>Welcome, <strong>${seller.fullName}</strong>.</p>

        <p><strong>Store:</strong> ${seller.store}</p>

        <a class="button" href="/seller/add-product/${seller.id}">
          + Add Product
        </a>

        <a class="button secondary" href="/products">
          View Marketplace
        </a>
      </div>

      <div class="card">
        <h2>Your Products</h2>
        ${productList}
      </div>

      <a class="button secondary" href="/">
        ← Back to Marketplace
      </a>
    `));
  });

  // ADD PRODUCT PAGE
  app.get("/seller/add-product/:id", (req, res) => {
    const rows = getRows(
      "SELECT * FROM sellers WHERE id = ?",
      [Number(req.params.id)]
    );

    const seller = rows[0];

    if (!seller) {
      return res.send("Seller not found.");
    }

    res.send(page("Add Product", `
      <div class="card">
        <h2>Add Product</h2>

        <p>Store: <strong>${seller.store}</strong></p>

        <form method="POST" action="/seller/add-product/${seller.id}">

          <label>Product Name</label>
          <input type="text" name="name" required>

          <label>Price (₦)</label>
          <input type="number" name="price" required min="1">

          <label>Product Description</label>
          <textarea name="description" required></textarea>

          <button type="submit">Add Product</button>
        </form>
      </div>

      <a class="button secondary"
         href="/seller/dashboard/${seller.id}">
        ← Back to Seller Dashboard
      </a>
    `));
  });

  // ADD PRODUCT
  app.post("/seller/add-product/:id", (req, res) => {
    const sellerRows = getRows(
      "SELECT * FROM sellers WHERE id = ?",
      [Number(req.params.id)]
    );

    const seller = sellerRows[0];

    if (!seller) {
      return res.send("Seller not found.");
    }

    db.run(
      `INSERT INTO products
       (sellerId, name, price, description, store)
       VALUES (?, ?, ?, ?, ?)`,
      [
        seller.id,
        req.body.name,
        Number(req.body.price),
        req.body.description,
        seller.store
      ]
    );

    saveDatabase();

    res.redirect("/seller/dashboard/" + seller.id);
  });

  app.listen(PORT, () => {
    console.log(`Edesvino Marketplace is running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Failed to start Edesvino Marketplace:", error);
});

