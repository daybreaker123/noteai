-- Stripe subscription metadata for Pro users (cancel at period end, renewal display)
alter table public.user_plans add column if not exists stripe_subscription_id text;
alter table public.user_plans add column if not exists subscription_current_period_end timestamptz;
alter table public.user_plans add column if not exists subscription_cancel_at_period_end boolean not null default false;

comment on column public.user_plans.stripe_subscription_id is 'Stripe subscription id (sub_...) for cancel/renewal.';
comment on column public.user_plans.subscription_current_period_end is 'End of current billing period from Stripe.';
comment on column public.user_plans.subscription_cancel_at_period_end is 'True if subscription is set to cancel at period end.';
