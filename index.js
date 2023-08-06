"use strict";

const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 3000;
const www = process.env.WWW || './';
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

//initialize bot
const token = '6133162085:AAE2nw5pbk_yA2qmmq0a4smK3eED1KI0iyk';
const bot = new TelegramBot(token, { polling: true });

app.use(cors());
app.use(express.static("public"));
console.log(`serving ${www}`);

app.use(express.json());

const readCartFile = () => {
  try {
    const cartData = fs.readFileSync('./cart.json', 'utf8');
    return JSON.parse(cartData);
  } catch (error) {
    console.error('Error reading cart file:', error);
    return [];
  }
};

const writeCartFile = (cart) => {
  try {
    const cartData = JSON.stringify(cart, null, 2);
    fs.writeFileSync('./cart.json', cartData, 'utf8');
  } catch (error) {
    console.error('Error writing cart file:', error);
  }
};

const readProductsFile = () => {
  try {
    const productsData = fs.readFileSync('products.json');
    return JSON.parse(productsData);
  } catch (error) {
    console.error('Error reading products file:', error);
    return [];
  }
};

const writeProductsFile = (products) => {
  try {
    fs.writeFileSync('products.json', JSON.stringify(products));
  } catch (error) {
    console.error('Error writing products file:', error);
  }
};

const getProductById = (id) => {
  const products = readProductsFile();
  return products.find(product => product.id === id);
};

app.get('/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const product = getProductById(id);

  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }
  res.json(product);
});

app.post('/admin', (req, res) => {
  const { name, price, description, size, season, material, color, imageURL } = req.body;
  const products = readProductsFile();

  const maxId = Math.max(...products.map(product => product.id));
  const newProductId = maxId + 1;

  const newProduct = {
    id: newProductId,
    name,
    price,
    description,
    size,
    season,
    material,
    color,
    imageURL,
    comments: []
  };

  products.push(newProduct);
  writeProductsFile(products);
  res.json({ message: 'Товар успешно добавлен', product: newProduct });
});

app.post('/deleteProduct', (req, res) => {
  const id = req.body.id;
  let products = readProductsFile();
  products = products.filter(product => product.id !== id);
  writeProductsFile(products);
  res.json({ message: 'Product deleted successfully' });
});

app.post('/addToCart', (req, res) => {
  const { product } = req.body;
  let cart = readCartFile();
  const existingItem = cart.find(item => item.product.id === product.id);

  if (existingItem) {
    existingItem.count += 1;
  } else {
    cart.push({ product, count: 1 });
  }

  writeCartFile(cart);
  res.json({ message: 'Product added to cart' });
});

app.post('/cart/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let cart = readCartFile();
  const index = cart.findIndex(item => item.product.id === id);

  if (index !== -1) {
    cart.splice(index, 1);
    writeCartFile(cart);
    res.json({ cart });
  } else {
    res.status(404).json({ error: 'Product not found in cart' });
  }
});

app.get('/cart', (req, res) => {
  try {
    const cartData = fs.readFileSync('cart.json', 'utf8');
    const cartItems = JSON.parse(cartData);
    res.json(cartItems);
  } catch (error) {
    console.error('Error reading cart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/changeCountInCart', (req, res) => {
  const { productId, count } = req.body;

  fs.readFile('cart.json', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to read cart data' });
    }

    let cart;

    try {
      cart = JSON.parse(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to parse cart data' });
    }

    const product = cart.find(item => item.product.id === productId);

    if (product) {
      product.count += count;
    }

    fs.writeFile('cart.json', JSON.stringify(cart), 'utf8', (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to write cart data' });
      }

      if (product) {
        res.json({ count: product.count });
      } else {
        res.json({ count: 0 });
      }
    });
  });
});

app.post('/product/:id/addComments', (req, res) => {
  const { commentator, comment } = req.body;
  const productId = parseInt(req.params.id);

  const products = readProductsFile();
  const product = products.find(p => p.id === productId);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const newComment = {
    commentator,
    comment
  };

  product.comments.push(newComment);
  writeProductsFile(products);

  res.json({ comments: product.comments });
});


app.get('/product:id/getComments', (req, res) => {
  // Handle getComments logic here
});

app.get('/products', (req, res) => {
  const filePath = path.join(__dirname, 'products.json');
  res.sendFile(filePath);
});

app.get('/productsFilter/:key', (req, res) => {
  const key = decodeURI(decodeURIComponent(req.params.key)).toLowerCase();

  const products = readProductsFile()

  const filteredProducts = products.filter(product => product.name.toLowerCase().includes(key));
  if (filteredProducts.length === 0) {
    return res.status(404).json({ error: 'Товары не найдены' });
  }

  res.json(filteredProducts);
});

app.post('/order', (req, res) => {
  const { cart, totalPrice, currency } = req.body
  botSendOrder(cart, totalPrice, currency);
  fs.writeFileSync('cart.json', JSON.stringify([]));
  res.json({ message: 'Order issued' });
});

function botSendOrder(cart, totalPrice, currency) {
  const chatId = -965398447;
  let message = '';

  cart.forEach(item => {
    const { product, count } = item;
    const { id, name, price } = product;

    message += `Товар: ${name}\nID: ${id}\nЦіна: ${price} ${currency}\nКількість: ${count}\n\n`;

  });
  message += `Загальна вартість: ${totalPrice} ${currency}`;

  bot.sendMessage(chatId, message);
}

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`)
  console.log(`Telegram bot is listening on port ${port}`);
}
);
