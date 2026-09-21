

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Temporary storage for testing
const sellers = [];
const products = [];
const orders = [];

const style = `
<style>
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    background: #f5f7fa;
    color: #222;
  }

  header {
    background: #111827;
    color: white;
    padding: 20px;
    text-align: center;
  }

  .container {
    max-width: 700px;
    margin: 30px auto;
    padding: 20px;
  }

  .card {
    background: white;
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  h1, h2, h3 {
    margin-top: 0;
  }

  input, textarea {
    width: 100%;
    padding: 12px;
    margin: 8px 0 15px;
    box-sizing: border-box;
    border: 1px solid #ccc;
    border-radius: 7px;
  }

  textarea {
    min-height: 100px;
  }

  button, .button {
    display: inline-block;
    background: #111827;
    color: white;
    padding: 12px 18px;
    border: none;
    border-radius: 7px;
    text-decoration: none;
    cursor: pointer;
    margin: 5px 3px;
  }

  .button.secondary {
    background: #555;
  }

  .product {
    border: 1px solid #ddd;
    padding: 18px;
    border-radius: 10px;
    margin-bottom: 15px;
    background: white;
  }

  .price {
    font-size: 20px;
    font-weight: bold;
  }

  footer {
    text-align: center;
    padding: 30px;
    color: #777;
  }
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

<div class="container">
  ${content}
</div>

<footer>
  Edesvino Marketplace © 2026
</footer>

</body>
</html>
`;
}

// HOME PAGE
app.get("/", (req, res) => {
  res.send(
    page(
      "Edesvino Marketplace",
      `
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
      `
    )
  );
});

// PRODUCTS PAGE
app.get("/products", (req, res) => {
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

  res.send(
    page(
      "Shop Products",
      `
      <h2>Shop Products</h2>

      ${productHTML}

      <a class="button secondary" href="/">← Back to Marketplace</a>
      `
    )
  );
});

// ORDER PAGE
app.get("/order", (req, res) => {
  const productId = Number(req.query.product);
  const product = products.find(p => p.id === productId);

  res.send(
    page(
      "Place Order",
      `
      <div class="card">
        <h2>Place Your Order</h2>

        ${
          product
            ? `
              <p><strong>Product:</strong> ${product.name}</p>
              <p><strong>Price:</strong> ₦${Number(product.price).toLocaleString()}</p>
            `
            : `
              <p>Sample order</p>
            `
        }

        <form method="POST" action="/order">

          <input
            type="hidden"
            name="productId"
            value="${product ? product.id : ""}"
          >

          <label>Full Name</label>
          <input
            type="text"
            name="fullName"
            required
          >

          <label>Phone Number</label>
          <input
            type="text"
            name="phone"
            required
          >

          <label>Delivery Address</label>
          <textarea
            name="address"
            required
          ></textarea>

          <button type="submit">Place Order</button>
        </form>
      </div>

      <a class="button secondary" href="/products">
        ← Back to Products
      </a>
      `
    )
  );
});

// ORDER SUBMISSION
app.post("/order", (req, res) => {
  const order = {
    id: orders.length + 1,
    productId: req.body.productId || null,
    fullName: req.body.fullName,
    phone: req.body.phone,
    address: req.body.address
  };

  orders.push(order);

  res.redirect("/order-success/" + order.id);
});

// ORDER SUCCESS
app.get("/order-success/:id", (req, res) => {
  const order = orders.find(o => o.id === Number(req.params.id));

  res.send(
    page(
      "Order Successful",
      `
      <div class="card">
        <h2>Order Submitted Successfully! ✅</h2>

        <p>Thank you, <strong>${order ? order.fullName : "Customer"}</strong>.</p>

        <p>Your order has been received by Edesvino Marketplace.</p>

        ${
          order
            ? `<p><strong>Order Number:</strong> ${order.id}</p>`
            : ""
        }

        <a class="button" href="/products">Continue Shopping</a>
        <a class="button secondary" href="/">Back to Marketplace</a>
      </div>
      `
    )
  );
});

// SELLER REGISTRATION PAGE
app.get("/seller/register", (req, res) => {
  res.send(
    page(
      "Become a Seller",
      `
      <div class="card">
        <h2>Become a Seller</h2>

        <form method="POST" action="/seller/register">

          <label>Full Name</label>
          <input
            type="text"
            name="fullName"
            required
          >

          <label>Store / Business Name</label>
          <input
            type="text"
            name="store"
            required
          >

          <label>Email Address</label>
          <input
            type="email"
            name="email"
            required
          >

          <label>Phone Number</label>
          <input
            type="text"
            name="phone"
            required
          >

          <button type="submit">Register as Seller</button>
        </form>
      </div>

      <a class="button secondary" href="/">
        ← Back to Marketplace
      </a>
      `
    )
  );
});

// SELLER REGISTRATION
app.post("/seller/register", (req, res) => {
  const seller = {
    id: sellers.length + 1,
    fullName: req.body.fullName,
    store: req.body.store,
    email: req.body.email,
    phone: req.body.phone
  };

  sellers.push(seller);

  res.redirect("/seller/success/" + seller.id);
});

// SELLER SUCCESS PAGE
app.get("/seller/success/:id", (req, res) => {
  const seller = sellers.find(s => s.id === Number(req.params.id));

  if (!seller) {
    return res.send("Seller not found.");
  }

  res.send(
    page(
      "Seller Registration Successful",
      `
      <div class="card">
        <h2>Seller Registration Successful! ✅</h2>

        <p>
          Welcome to Edesvino Marketplace,
          <strong>${seller.fullName}</strong>.
        </p>

        <p>
          Your store
          <strong>${seller.store}</strong>
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
      `
    )
  );
});

// SELLER DASHBOARD
app.get("/seller/dashboard/:id", (req, res) => {
  const seller = sellers.find(s => s.id === Number(req.params.id));

  if (!seller) {
    return res.send("Seller not found.");
  }

  const sellerProducts = products.filter(
    product => product.sellerId === seller.id
  );

  let productList = "";

  if (sellerProducts.length === 0) {
    productList = `
      <p><strong>You have not added any products yet.</strong></p>
    `;
  } else {
    sellerProducts.forEach(product => {
      productList += `
        <div class="product">
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <p class="price">
            ₦${Number(product.price).toLocaleString()}
          </p>
        </div>
      `;
    });
  }

  res.send(
    page(
      "Seller Dashboard",
      `
      <div class="card">
        <h2>Seller Dashboard</h2>

        <p>Welcome, <strong>${seller.fullName}</strong>.</p>

        <p>
          <strong>Store:</strong> ${seller.store}
        </p>

        <a class="button" href="/seller/add-product/${seller.id}">
          Add Product
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
      `
    )
  );
});

// ADD PRODUCT PAGE
app.get("/seller/add-product/:id", (req, res) => {
  const seller = sellers.find(s => s.id === Number(req.params.id));

  if (!seller) {
    return res.send("Seller not found.");
  }

  res.send(
    page(
      "Add Product",
      `
      <div class="card">
        <h2>Add Product</h2>

        <p>
          Store:
          <strong>${seller.store}</strong>
        </p>

        <form method="POST" action="/seller/add-product/${seller.id}">

          <label>Product Name</label>
          <input
            type="text"
            name="name"
            required
          >

          <label>Price (₦)</label>
          <input
            type="number"
            name="price"
            required
            min="1"
          >

          <label>Product Description</label>
          <textarea
            name="description"
            required
          ></textarea>

          <button type="submit">
            Add Product
          </button>
        </form>
      </div>

      <a class="button secondary"
         href="/seller/dashboard/${seller.id}">
        ← Back to Seller Dashboard
      </a>
      `
    )
  );
});

// ADD PRODUCT
app.post("/seller/add-product/:id", (req, res) => {
  const seller = sellers.find(s => s.id === Number(req.params.id));

  if (!seller) {
    return res.send("Seller not found.");
  }

  const product = {
    id: products.length + 1,
    sellerId: seller.id,
    name: req.body.name,
    price: Number(req.body.price),
    description: req.body.description,
    store: seller.store
  };

  products.push(product);

  res.redirect("/seller/dashboard/" + seller.id);
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Edesvino Marketplace is running on port ${PORT}`);
});
