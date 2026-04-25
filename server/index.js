const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();

app.use(cors());
app.use(express.json());

// Initialize Turso DB client
const db = createClient({
    url: process.env.DATABASE_URL || 'file:./storeminds.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helper: run a single write statement
async function dbRun(sql, args = []) {
    return db.execute({ sql, args });
}

// Helper: run a query returning all rows
async function dbAll(sql, args = []) {
    const result = await db.execute({ sql, args });
    return result.rows;
}

// Helper: run a query returning one row
async function dbGet(sql, args = []) {
    const result = await db.execute({ sql, args });
    return result.rows[0] || null;
}

// Initialize Database Tables
async function initDB() {
    try {
        await db.executeMultiple(`
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT UNIQUE,
                quantity INTEGER DEFAULT 0,
                price REAL DEFAULT 0.0,
                category TEXT,
                image_url TEXT,
                last_updated DATETIME
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                color TEXT,
                icon TEXT
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                item_name TEXT,
                quantity_change INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total REAL NOT NULL,
                payment_method TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transaction_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER,
                item_id INTEGER,
                quantity INTEGER,
                price REAL,
                FOREIGN KEY(transaction_id) REFERENCES transactions(id),
                FOREIGN KEY(item_id) REFERENCES items(id)
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact TEXT,
                email TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT
            );
        `);

        // Add supplier_id column to items if it doesn't exist (ignore error if already exists)
        try {
            await dbRun('ALTER TABLE items ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)');
        } catch (e) {
            // Column already exists, ignore
        }

        // Seed Admin User if not exists
        const userCount = await dbGet('SELECT count(*) as count FROM users');
        if (!userCount || parseInt(userCount.count) === 0) {
            console.log('Creating admin user...');
            await dbRun(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                ['admin', 'admin123', 'admin']
            );
        }

        // Seed Categories if not exists
        const catCount = await dbGet('SELECT count(*) as count FROM categories');
        if (!catCount || parseInt(catCount.count) === 0) {
            console.log('Seeding categories...');
            const cats = [
                { name: 'Electronics', color: '#3b82f6', icon: 'Headphones' },
                { name: 'Furniture', color: '#8b5cf6', icon: 'Armchair' },
                { name: 'Clothing', color: '#ec4899', icon: 'Shirt' },
                { name: 'Groceries', color: '#10b981', icon: 'Apple' },
                { name: 'Other', color: '#64748b', icon: 'Box' },
            ];
            for (const cat of cats) {
                await dbRun(
                    'INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)',
                    [cat.name, cat.color, cat.icon]
                );
            }
        }

        // Seed Items if not exists
        const itemCount = await dbGet('SELECT count(*) as count FROM items');
        if (!itemCount || parseInt(itemCount.count) === 0) {
            console.log('Seeding items...');
            const mockInventory = [
                { name: 'Wireless Headphones', sku: 'AUDIO-001', quantity: 45, price: 129.99, category: 'Electronics' },
                { name: 'Ergonomic Chair', sku: 'FUR-002', quantity: 8, price: 299.99, category: 'Furniture' },
                { name: 'Mechanical Keyboard', sku: 'TECH-003', quantity: 12, price: 159.50, category: 'Electronics' },
            ];
            for (const item of mockInventory) {
                await dbRun(
                    'INSERT OR IGNORE INTO items (name, sku, quantity, price, category, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
                    [item.name, item.sku, item.quantity, item.price, item.category, new Date().toISOString()]
                );
            }
        }

        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// Run DB init (non-blocking — Vercel will handle this before first request)
initDB();

// --- Endpoints ---

// POS Checkout
app.post('/api/pos/checkout', async (req, res) => {
    const { cart, paymentMethod, total } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    try {
        // 1. Create Transaction
        const transResult = await dbRun(
            'INSERT INTO transactions (total, payment_method, date) VALUES (?, ?, ?)',
            [total, paymentMethod, new Date().toISOString()]
        );
        const transactionId = transResult.lastInsertRowid;

        // 2. Process each cart item
        for (const item of cart) {
            const dbItem = await dbGet('SELECT quantity, name FROM items WHERE id = ?', [item.id]);
            if (!dbItem || parseInt(dbItem.quantity) < item.cartQuantity) {
                return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
            }

            await dbRun('UPDATE items SET quantity = quantity - ? WHERE id = ?', [item.cartQuantity, item.id]);

            await dbRun(
                'INSERT INTO transaction_items (transaction_id, item_id, quantity, price) VALUES (?, ?, ?, ?)',
                [transactionId, item.id, item.cartQuantity, item.price]
            );

            await dbRun(
                'INSERT INTO activity_log (type, item_name, quantity_change, timestamp) VALUES (?, ?, ?, ?)',
                ['Sale', item.name, -item.cartQuantity, new Date().toISOString()]
            );
        }

        res.status(201).json({ message: 'Transaction successful', transactionId });
    } catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get All Items
app.get('/api/inventory', async (req, res) => {
    try {
        const items = await dbAll('SELECT * FROM items');
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Item
app.post('/api/inventory', async (req, res) => {
    const { name, sku, quantity, price, category } = req.body;
    try {
        const result = await dbRun(
            'INSERT INTO items (name, sku, quantity, price, category, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
            [name, sku, quantity, price, category, new Date().toISOString()]
        );
        await dbRun(
            'INSERT INTO activity_log (type, item_name, quantity_change, timestamp) VALUES (?, ?, ?, ?)',
            ['New Item', name, quantity, new Date().toISOString()]
        );
        res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Item
app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { name, sku, quantity, price, category } = req.body;
    try {
        const oldItem = await dbGet('SELECT * FROM items WHERE id = ?', [id]);
        if (!oldItem) return res.status(404).json({ error: 'Item not found' });

        await dbRun(
            'UPDATE items SET name = ?, sku = ?, quantity = ?, price = ?, category = ?, last_updated = ? WHERE id = ?',
            [name, sku, quantity, price, category, new Date().toISOString(), id]
        );

        if (parseInt(quantity) !== parseInt(oldItem.quantity)) {
            const type = parseInt(quantity) > parseInt(oldItem.quantity) ? 'Restock' : 'Sale';
            const change = Math.abs(parseInt(quantity) - parseInt(oldItem.quantity));
            await dbRun(
                'INSERT INTO activity_log (type, item_name, quantity_change, timestamp) VALUES (?, ?, ?, ?)',
                [type, name, parseInt(quantity) > parseInt(oldItem.quantity) ? change : -change, new Date().toISOString()]
            );
        }

        res.json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Item
app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const item = await dbGet('SELECT name FROM items WHERE id = ?', [id]);
        await dbRun('DELETE FROM items WHERE id = ?', [id]);
        if (item) {
            await dbRun(
                'INSERT INTO activity_log (type, item_name, quantity_change, timestamp) VALUES (?, ?, ?, ?)',
                ['Delete', item.name, 0, new Date().toISOString()]
            );
        }
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Categories ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await dbAll('SELECT * FROM categories');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name, color, icon } = req.body;
    try {
        const result = await dbRun(
            'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
            [name, color, icon || 'Box']
        );
        res.status(201).json({ id: result.lastInsertRowid, name, color, icon });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM categories WHERE id = ?', [id]);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Database
app.post('/api/reset', async (req, res) => {
    try {
        await db.executeMultiple(`
            DELETE FROM transaction_items;
            DELETE FROM transactions;
            DELETE FROM activity_log;
            DELETE FROM items;
            DELETE FROM suppliers;
        `);
        res.json({ message: 'Database reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Stats
app.get('/api/dashboard', async (req, res) => {
    try {
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as totalItems, 
                SUM(quantity * price) as totalValue,
                SUM(CASE WHEN quantity < 5 THEN 1 ELSE 0 END) as lowStock
            FROM items
        `);
        const activity = await dbAll('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 5');
        res.json({ stats, activity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Suppliers ---
app.get('/api/suppliers', async (req, res) => {
    try {
        const suppliers = await dbAll('SELECT * FROM suppliers');
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/suppliers', async (req, res) => {
    const { name, contact, email } = req.body;
    try {
        const result = await dbRun(
            'INSERT INTO suppliers (name, contact, email) VALUES (?, ?, ?)',
            [name, contact, email]
        );
        res.status(201).json({ id: result.lastInsertRowid, name, contact, email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/suppliers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM suppliers WHERE id = ?', [id]);
        res.json({ message: 'Supplier deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Auth ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dbGet(
            'SELECT * FROM users WHERE username = ? AND password = ?',
            [username, password]
        );
        if (user) {
            const { password: _pw, ...userWithoutPass } = user;
            res.json(userWithoutPass);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Analytics ---
app.get('/api/analytics/sales', async (req, res) => {
    try {
        const sales = await dbAll(`
            SELECT 
                date(date) as date,
                SUM(total) as revenue,
                COUNT(id) as transactions
            FROM transactions
            WHERE date(date) >= date('now', '-7 days')
            GROUP BY date(date)
            ORDER BY date
        `);
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/top-products', async (req, res) => {
    try {
        const products = await dbAll(`
            SELECT 
                i.name,
                SUM(ti.quantity) as sold
            FROM transaction_items ti
            JOIN items i ON ti.item_id = i.id
            GROUP BY ti.item_id
            ORDER BY sold DESC
            LIMIT 5
        `);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/daily-sales', async (req, res) => {
    try {
        const sales = await dbAll(`
            SELECT 
                payment_method,
                SUM(total) as total,
                COUNT(id) as count
            FROM transactions
            WHERE date(date) = date('now')
            GROUP BY payment_method
        `);
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export for Vercel (serverless) — also listen locally when not on Vercel
if (process.env.VERCEL) {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
