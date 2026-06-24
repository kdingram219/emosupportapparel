# 🧒 Owner's Setup Guide — Make This Thing Work

## You have 3 jobs. That's it.

### ✅ Job 1: Preview the site
Your PR automatically deployed a live preview on Vercel. No action needed — it's already online.
**Preview URL:** (see the Vercel bot comment on your PR)

Click around. Tell me what you want changed. The homepage has a dark hero, interactive color swatches on product pages, everything's running.

---

### ✅ Job 2: Give me your design images (when ready)
Right now, each product page shows the witty slogan text as a placeholder "design" on the shirt (e.g. "SOCIAL BATTERY: 2%" in big white letters on a black shirt).

When you have your actual design artwork, drop the image files into:
```
/public/images/products/[product-id].png
```

The file name must match the product ID. Example: `emotional-support-hoodie.png`, `social-battery-2-percent-tee.png`.

I can do this for you if you just send me the files.

---

### ✅ Job 3: Give me your Stripe key (when ready to sell)
Right now the checkout is in "mock mode" — it simulates buying without charging anyone. When you want real payments:

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret Key** (starts with `sk_live_...`)
3. Tell me the key

I'll add it as an environment variable on Vercel and real payments will work instantly.

---

### That's really it.
1. ✅ Preview is live — start looking
2. ⏳ Real design images — whenever you have them
3. ⏳ Stripe key — when you're ready to take real money

Want anything else changed? Colors? Fonts? Hero headline text? Just tell me.