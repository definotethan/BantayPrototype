const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./db')

let users = [
    {
        id: 1,
        username: 'zagreus',
        password: 'cerberus',
    },
    {
        id: 2,
        username: 'melinoe',
        password: 'b4d3ec1',
    }
]
let sessions = {}
let products = [
    {
        id: 1,
        name: 'Americano',
        price: 100,
        description: 'Espresso, diluted with hot water for a lighter experience',
    },
    {
        id: 2,
        name: 'Cappuccino',
        price: 110,
        description: 'Espresso with steamed milk',
    },
    {
        id: 3,
        name: 'Espresso',
        price: 90,
        description: 'A strong shot of coffee',
    },
    {
        id: 4,
        name: 'Macchiato',
        price: 120,
        description: 'Espresso with a small amount of milk',
    },
]

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS cjs_user (username TEXT, password TEXT)")
    db.run("CREATE TABLE IF NOT EXISTS cjs_product (name TEXT, price INTEGER, description TEXT)")
    db.run("CREATE TABLE IF NOT EXISTS cjs_session (token TEXT, user_id INTEGER)")
    db.run("CREATE TABLE IF NOT EXISTS cjs_cart_item (product_id, quantity, user_id)")
    db.run("CREATE TABLE IF NOT EXISTS cjs_transaction (user_id INTEGER, created_at TEXT)")
    db.run("CREATE TABLE IF NOT EXISTS cjs_line_item (transaction_id INTEGER, product_id INTEGER, quantity INTEGER)")

    db.get('SELECT COUNT(*) AS count FROM cjs_user', [], (err, row) => {
        let count = row.count
        if (count == 0) {
            let stmt = db.prepare("INSERT INTO cjs_user (username, password) VALUES (?, ?)")
            users.forEach(v => {
                stmt.run(v.username, v.password)
            })
        }
    })

    db.get('SELECT COUNT(*) AS count FROM cjs_product', [], (err, row) => {
        let count = row.count
        if (count == 0) {
            let stmt = db.prepare("INSERT INTO cjs_product (name, price, description) VALUES (?, ?, ?)")
            products.forEach(v => {
                stmt.run(v.name, v.price, v.description)
            })
        }
    })
})

function getProducts() {
    return new Promise((resolve, reject) => {
        db.all('SELECT rowid, * FROM cjs_product', (err, rows) => {
            let result = rows.map(x => {
                return {id: x.rowid, name: x.name, price: x.price, description: x.description}
            })
            console.log(result)
            resolve(result)
        })
    })
}
function getProductById(id) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT rowid, * FROM cjs_product WHERE rowid = ?'
        db.get(query, [id], (err, row) => {
            resolve({
                id: row.rowid,
                name: row.name,
                price: row.price,
                description: row.description,
            })
        })
    })
}
function getUsers() {
    return new Promise((resolve, reject) => {
        let query = 'SELECT rowid, * FROM cjs_user'
        db.all(query, [], (err, rows) => {
            let results = []
            rows.forEach(row => {
                results.push({
                    id: row.rowid,
                    username: row.username,
                    password: row.password,
                })
            })
            resolve(results)
        })
    })
}
function getUserById(id) {
    console.log('Fetching user with ID:', id);
    console.log('User ID:', id, 'Type:', typeof id);
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM cjs_user WHERE rowid = ?';
        db.get(query, [id], (err, row) => {
            resolve({
                id: id,
                username: row.username,
                password: row.password,
            });
        });
    });
}
function getUserByUsername(username) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT rowid, * FROM cjs_user WHERE username = ?'
        db.get(query, [username], (err, row) => {
            resolve({
                id: row.rowid,
                username: row.username,
                password: row.password,
            })
        })
    })
}
function getSessions() {
    return new Promise((resolve, reject) => {
        let query = 'SELECT rowid, * FROM cjs_session'
        db.all(query, (err, rows) => {
            let results = {}
            rows.forEach(row => {
                results[row.token] = row.user_id
            })
            resolve(results)
        })
    })
}
function getUserBySessionToken(sessionToken) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM cjs_session WHERE token = ?'
        db.get(query, [sessionToken], (err, row) => {
            if (row) {
                let userId = row.user_id
                resolve(getUserById(userId))
            } else {
                resolve('')
            }
        })
    })
}
function setSession(sessionToken, userId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            let stmt = db.prepare('INSERT INTO cjs_session (token, user_id) VALUES (?, ?)')
            stmt.run(sessionToken, userId)
            resolve(true)
        })
    })
}
function createCartItem(productId, quantity, userId) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            let stmt = db.prepare('INSERT INTO cjs_cart_item (product_id, quantity, user_id) VALUES (?, ?, ?)')
            stmt.run(productId, quantity, userId)
            resolve(true)
        })
    })
}
function getCartItemsByUser(user) {
    return new Promise((resolve, reject) => {
        let userId = user.id
        let query = `
        SELECT
            SUM(cjs_cart_item.quantity) AS quantity,
            cjs_product.name AS product_name
        FROM cjs_cart_item LEFT JOIN cjs_product
        ON cjs_cart_item.product_id = cjs_product.rowid
        WHERE cjs_cart_item.user_id = ?
        GROUP BY cjs_product.name
        `
        db.all(query, [userId], (err, rows) => {
            let result = rows.map(row => {
                return {
                    userId: userId,
                    quantity: row.quantity,
                    productName: row.product_name,
                }
            })
            resolve(result)
        })
    })
}
function checkoutCartForUser(user) {
    return new Promise((resolve, reject) => {
        let userId = user.id
        let query = 'SELECT SUM(quantity) AS quantity, user_id, product_id FROM cjs_cart_item WHERE user_id = ? GROUP BY user_id, product_id'
        db.all(query, [userId], (err, rows) => {
            resolve(rows.map((row) => {
                return {
                    userId: userId,
                    productId: row.product_id,
                    quantity: row.quantity
                }
            }))
        })
    }).then((cartItems) => {
        return new Promise((resolve, reject) => {
            let userId = cartItems[0].userId
            let now = (new Date()).toUTCString()
            db.serialize(() => {
                let query = 'INSERT INTO cjs_transaction (created_at, user_id) VALUES (?, ?)'
                db.run(query, [now, userId], function() {
                    let transactionId = this.lastID
                    console.log(`tx_id: ${transactionId}`)
                    let stmt = 'INSERT INTO cjs_line_item (transaction_id, product_id, quantity) VALUES (?, ?, ?)'
                    stmt = db.prepare(stmt)
                    cartItems.forEach(cartItem => {
                        stmt.run(transactionId, cartItem.productId, cartItem.quantity)
                    })
                    resolve(userId)
                })
            })
        })
    }).then((userId) => {
        return new Promise((resolve, reject) => {
            let query = 'DELETE FROM cjs_cart_item WHERE user_id = ?'
            db.run(query, [Number(userId)], () => {
                resolve(true)
            })
        })
    })
}

module.exports = {
    getProducts,
    getProductById,
    getUsers,
    getUserById,
    getUserByUsername,
    getSessions,
    getUserBySessionToken,
    setSession,
    createCartItem,
    getCartItemsByUser,
    checkoutCartForUser,
}