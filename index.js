// Main application server for Emotional Support Apparel by K&D
// Serves on port 3000 to all interfaces (0.0.0.0)
// Powered by Express and lightweight memory-friendly EJS templates.

const express = require('express');
const path = require('path');
const { products, customCategories } = require('./products');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static public assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Custom renderer middleware to handle nested EJS layout seamlessly
app.use((req, res, next) => {
    res.renderView = (view, data = {}) => {
        // Render child view first
        app.render(view, { ...data, products }, (err, compiledBody) => {
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
            tagline: "For the high-achiever in low-power mode.",
            desc: "You’re doing a lot. Probably too much. The Burnout Collection is our tribute to the over-extended. Featuring heavyweight fleece and crisp ceramics designed to handle the weight of another 'per my last email.'"
        },
        introvert: {
            name: "The Introvert Collection",
            tagline: "Soft clothes for hard exits.",
            desc: "Home is where the soft clothes are. This collection is a love letter to the cancelled plan and the early departure. Premium fabrics that feel as good as a 'texting is fine' boundary."
        },
        overthinker: {
            name: "The Overthinker Collection",
            tagline: "High-end fabric for low-end regrets.",
            desc: "For the professional analyzer. Whether you’re replaying a conversation from 2012 or drafting a text you’ll never send, do it in luxury. Designed to be as deep and layered as your thought process."
        },
        corporate: {
            name: "The Corporate Survivor Collection",
            tagline: "Synergy is not a personality.",
            desc: "Surviving the 9-to-5 with your sanity (mostly) intact. From mugs that hold your liquid patience to tees that speak the truth your HR department won't."
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
    const isMock = req.query.mock === 'true';
    
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
