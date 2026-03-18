import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
export const stripe = secret ? new Stripe(secret) : null;
