// Main application server for Emotional Support Apparel by K&D
// Serves on port 3000 to all interfaces (0.0.0.0)
// Powered by Express and lightweight memory-friendly EJS templates.

const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { products, customCategories } = require('./products');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static public assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Multer config: save uploaded designs to public/images/products/
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/images/products'));
    },
    filename: (req, file, cb) => {
        // Use a temp name — we'll rename after we know the productId
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'upload-temp-' + Date.now() + ext);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PNG, JPG, GIF, and WebP images are allowed'));
        }
    }
});

// Custom renderer middleware to handle nested EJS layout seamlessly
app.use((req, res, next) => {
    res.renderView = (view, data = {}) => {
        // Render child view first
        app.render(view, { 
            ...data, 
            products,
            paypalClientId: process.env.PAYPAL_CLIENT_ID || 'sb',
            paypalBusinessEmail: process.env.PAYPAL_BUSINESS_EMAIL || 'kdjones219@gmail.com'
        }, (err, compiledBody) => {
            if (err) {
                console.error("View Render Error:", err);
                return res.status(500).send(`Render Error: ${err.message}`);
            }
            // Inject body into parent layout
            res.render('layout', {
                ...data,
                body: compiledBody,
                title: data.title || "Premium Emotional-Support Gear"
            });
        });
    };
    next();
});

// --- ROUTES ---

// 1. Homepage Route
app.get('/', (req, res) => {
    res.renderView('index', {
        title: "Soft Clothes, Hard Life. Premium Emotional-Support Gear",
        products
    });
});

// 2. Curated Collections Route
app.get('/collections/:id', (req, res) => {
    const collectionId = req.params.id;
    const activeCategory = req.query.category || null;

    // Define collection names and descriptions
    const collectionMetadata = {
        burnout: {
            name: "The Burnout Collection",
            tagline: "Running on fumes, but make it fashion.",
            desc: "For those who have reached the 'if I sit down I'll never get up' stage of life. Featuring heavyweight fleece that feels like a long-overdue sick day you're too afraid to take."
        },
        introvert: {
            name: "The Introvert Collection",
            tagline: "Please don't look at me.",
            desc: "A love letter to the 'Read' receipt and the early exit. These clothes are designed to facilitate your successful disappearance from any social situation. If you can read this, you're too close."
        },
        overthinker: {
            name: "The Overthinker Collection",
            tagline: "Analyzing every mistake since birth.",
            desc: "For the professional ruminator. Whether you're drafting an apology for a minor inconvenience or replaying a 3-second interaction from a decade ago, do it in luxury."
        },
        corporate: {
            name: "The Corporate Survivor Collection",
            tagline: "This meeting could have been a nap.",
            desc: "Surviving the 9-to-5 with your sanity hanging by a thread. Gear for the 'Per my last email' warriors who know that synergy is just a fancy word for 'I have no idea what I'm doing.'"
        }
    };

    const metadata = collectionMetadata[collectionId];
    if (!metadata) {
        return res.status(404).send("Collection not found. Did you overthink the URL path?");
    }

    // Filter products belonging to this collection
    let filteredProducts = products.filter(p => p.collections.includes(collectionId));
    
    // Optional category filtering
    if (activeCategory) {
        filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
    }

    res.renderView('collection', {
        title: `${metadata.name} | Branded Drop`,
        collectionId,
        collectionName: metadata.name,
        collectionTagline: metadata.tagline,
        collectionDescription: metadata.desc,
        filteredProducts,
        activeCategory
    });
});

// 3. Product Details Route
app.get('/products/:id', (req, res) => {
    const productId = req.params.id;
    const product = products.find(p => p.id === productId);

    if (!product) {
        return res.status(404).send("Product not found. Our inventory is currently buffering.");
    }

    res.renderView('product', {
        title: `${product.name} | Premium ESA Gear`,
        product
    });
});

// 4. Live Custom Sublimation Designer Route
app.get('/design', (req, res) => {
    const activeBase = req.query.product || "hoodies";

    res.renderView('custom', {
        title: "Live Sublimation Designer Lab | Custom Gear",
        customCategories,
        activeBase
    });
});

// 5. Domain Planning & Roadmap Route
app.get('/domain-plan', (req, res) => {
    res.renderView('domain', {
        title: "Domain Launch Plan & Architecture | emotionalsupportapparel.com"
    });
});

// Stripe Checkout Session Creation
app.post('/create-checkout-session', async (req, res) => {
    const { productId, name, price, size, color, customText, customFont, customTextColor, customImage, category } = req.body;
    
    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const isMock = !stripeKey || stripeKey === 'sk_test_mock_key';
    
    const lineItemName = name || (category ? `Custom ${category.toUpperCase()}` : "Custom ESA Creation");
    const lineItemPrice = parseFloat(price) || 85.00;
    
    const metadata = {
        productId: productId || 'custom',
        size: size || 'M',
        color: color || 'Cream',
        customText: customText || '',
        customFont: customFont || '',
        customTextColor: customTextColor || '',
        customImage: customImage ? (customImage.length > 500 ? customImage.substring(0, 500) + '...' : customImage) : '', // truncate dataURL if needed
    };

    if (isMock) {
        // Mock Stripe Session URL in dev/sandbox environment
        console.log("Mock Stripe Session created with metadata:", metadata);
        // Simulate a checkout redirect to /success with query parameters mimicking Stripe
        const mockSessionId = 'cs_test_mock_' + Math.random().toString(36).substring(2, 15);
        const queryParams = new URLSearchParams({
            session_id: mockSessionId,
            productId: metadata.productId,
            name: lineItemName,
            price: lineItemPrice,
            size: metadata.size,
            color: metadata.color,
            customText: metadata.customText,
            mock: 'true'
        }).toString();
        
        return res.json({ id: mockSessionId, url: `/success?${queryParams}` });
    }

    try {
        const stripe = require('stripe')(stripeKey);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: lineItemName,
                            description: `Emotional Support Apparel by K&D - Size: ${size || 'M'}, Color: ${color || 'Cream'} ${customText ? `(Custom Text: "${customText}")` : ''}`,
                        },
                        unit_amount: Math.round(lineItemPrice * 100), // in cents
                    },
                    quantity: 1,
                },
            ],
            metadata: metadata,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/cancel`,
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Success Page Route
app.get('/success', async (req, res) => {
    const sessionId = req.query.session_id;
    const isMock = req.query.mock === 'true' || req.query.paypal === 'true';
    
    let orderDetails = {
        orderId: sessionId || 'ESA-ORDER-MOCK',
        name: req.query.name || "Emotional Support Hoodie",
        price: parseFloat(req.query.price) || 78.00,
        size: req.query.size || "M",
        color: req.query.color || "Cream",
        customText: req.query.customText || "",
        email: "customer@emosupportapparel.com"
    };

    if (!isMock && sessionId && process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            orderDetails.orderId = session.id;
            orderDetails.email = session.customer_details ? session.customer_details.email : 'customer@emosupportapparel.com';
            
            // Retrieve from line items or metadata
            if (session.metadata) {
                orderDetails.size = session.metadata.size || 'M';
                orderDetails.color = session.metadata.color || 'Cream';
                orderDetails.customText = session.metadata.customText || '';
            }
            
            const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
            if (lineItems.data && lineItems.data.length > 0) {
                orderDetails.name = lineItems.data[0].description;
                orderDetails.price = lineItems.data[0].amount_total / 100;
            }
        } catch (err) {
            console.error("Error retrieving Stripe session:", err);
        }
    }

    res.renderView('success', {
        title: "Order Confirmed! Your Emotional Support is En Route",
        orderDetails
    });
});

// Cancel Page Route
app.get('/cancel', (req, res) => {
    res.renderView('cancel', {
        title: "Checkout Cancelled | Emotional Support Apparel"
    });
});

// --- PAYPAL CHECKOUT INTEGRATION ---

// Helper: Fetch PayPal OAuth Access Token
async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        return null;
    }
    
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    
    try {
        const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            body: 'grant_type=client_credentials',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        const data = await response.json();
        return data.access_token;
    } catch (err) {
        console.error("PayPal Token Error:", err);
        return null;
    }
}

// 1. Create PayPal Order Route
app.post('/create-paypal-order', async (req, res) => {
    const { productId, name, price, size, color, customText, customImage, category } = req.body;
    
    const isMock = !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;
    const lineItemName = name || (category ? `Custom ${category.toUpperCase()}` : "Custom ESA Creation");
    const lineItemPrice = parseFloat(price) || 85.00;
    
    if (isMock) {
        const mockOrderId = 'PAYPAL-MOCK-' + Math.random().toString(36).substring(2, 15).toUpperCase();
        console.log("Mock PayPal Order created:", mockOrderId);
        return res.json({ id: mockOrderId });
    }
    
    try {
        const accessToken = await getPayPalAccessToken();
        if (!accessToken) {
            throw new Error("Unable to retrieve PayPal Access Token.");
        }
        const baseUrl = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
        
        const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        amount: {
                            currency_code: 'USD',
                            value: lineItemPrice.toFixed(2)
                        },
                        description: `Emotional Support Apparel by K&D - ${lineItemName} (Size: ${size || 'M'}, Color: ${color || 'Cream'}) ${customText ? `(Custom: "${customText}")` : ''}`,
                        payee: {
                            email_address: process.env.PAYPAL_BUSINESS_EMAIL || 'kdjones219@gmail.com'
                        }
                    }
                ],
                application_context: {
                    brand_name: 'Emotional Support Apparel by K&D',
                    shipping_preference: 'NO_SHIPPING',
                    user_action: 'PAY_NOW'
                }
            })
        });
        
        const order = await response.json();
        res.json({ id: order.id });
    } catch (err) {
        console.error("PayPal Create Order Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Capture PayPal Order Route
app.post('/capture-paypal-order', async (req, res) => {
    const { orderId } = req.body;
    
    const isMock = !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET;
    
    if (isMock) {
        console.log("Mock PayPal Order captured:", orderId);
        return res.json({ status: 'COMPLETED' });
    }
    
    try {
        const accessToken = await getPayPalAccessToken();
        if (!accessToken) {
            throw new Error("Unable to retrieve PayPal Access Token.");
        }
        const baseUrl = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
        
        const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            }
        });
        
        const capture = await response.json();
        res.json(capture);
    } catch (err) {
        console.error("PayPal Capture Order Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- OWNER UPLOAD PAGE ---

// Simple session-based auth for the upload page
const UPLOAD_PASSWORD = 'esaboss2026'; // simple password

// GET upload page — check for password cookie
app.get('/admin', (req, res) => {
    const authed = req.cookies && req.cookies.upload_auth === UPLOAD_PASSWORD;
    res.renderView('upload', {
        title: "Upload Designs | Admin",
        authed,
        products,
        message: null
    });
});

// POST password form
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === UPLOAD_PASSWORD) {
        res.cookie('upload_auth', UPLOAD_PASSWORD, { maxAge: 86400000, httpOnly: true }); // 24hr
        res.redirect('/admin');
    } else {
        res.renderView('upload', {
            title: "Upload Designs | Admin",
            authed: false,
            products,
            message: 'Wrong password. Try again.'
        });
    }
});

// POST upload image — requires auth
app.post('/admin/upload', (req, res, next) => {
    const authed = req.cookies && req.cookies.upload_auth === UPLOAD_PASSWORD;
    if (!authed) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}, upload.single('design'), (req, res) => {
    const file = req.file;
    const productId = req.body.productId || '';
    
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Rename temp file to the product ID filename
    const targetName = productId + '.png';
    const targetPath = path.join(__dirname, 'public/images/products', targetName);
    
    try {
        // Remove old file if it exists
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }
        // Rename temp file to target
        fs.renameSync(file.path, targetPath);
    } catch (err) {
        console.error('File rename error:', err);
        // If rename fails, just leave the temp file
    }
    
    res.json({ 
        success: true, 
        filename: targetName,
        productId: productId,
        path: '/images/products/' + targetName,
        message: productId ? `Design uploaded for "${productId}"` : 'Design uploaded!'
    });
});

// Logout
app.get('/admin/logout', (req, res) => {
    res.clearCookie('upload_auth');
    res.redirect('/admin');
});

// 404 Fallback
app.use((req, res) => {
    res.status(404).send("This page is experiencing a minor inconvenience. 404 - Not Found.");
});

// Bind to port 3000 on ALL interfaces (0.0.0.0) if run directly
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`====================================================`);
        console.log(` Emotional Support Apparel Server is LIVE!`);
        console.log(` Listening on port ${PORT} bound to all interfaces.`);
        console.log(` URL: http://0.0.0.0:${PORT}`);
        console.log(` ...because therapy is expensive.`);
        console.log(`====================================================`);
    });
}

module.exports = app;
