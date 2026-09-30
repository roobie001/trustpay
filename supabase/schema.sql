-- MedioPoint escrow schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists escrow_orders (
  id uuid primary key default gen_random_uuid(),
  item_title text not null,
  amount numeric not null,
  delivery_fee numeric not null default 0,
  seller_name text not null,
  seller_phone text not null,
  seller_bank text,
  seller_account_number text,
  buyer_name text,
  buyer_phone text,
  status text not null default 'PENDING_PAYMENT'
    check (status in (
      'PENDING_PAYMENT',
      'HELD_IN_ESCROW',
      'DISPATCHED',
      'FUNDS_RELEASED',
      'DISPUTED'
    )),
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds columns to a table created before they existed.
alter table escrow_orders add column if not exists seller_bank text;
alter table escrow_orders add column if not exists seller_account_number text;
alter table escrow_orders add column if not exists seller_bank_code text;
alter table escrow_orders add column if not exists paystack_reference text;
alter table escrow_orders add column if not exists paid_at timestamptz;
alter table escrow_orders add column if not exists transfer_code text;
alter table escrow_orders add column if not exists transfer_reference text;

alter table escrow_orders enable row level security;

-- Read access stays open: both the buyer and seller pages fetch the order
-- client-side with the anon/publishable key, and this table no longer holds
-- any secret (the seller's access token lives in escrow_order_secrets below).
drop policy if exists "Anyone can read escrow orders" on escrow_orders;
create policy "Anyone can read escrow orders"
  on escrow_orders for select
  using (true);

-- Order creation now happens server-side via POST /api/orders (service role),
-- so it can also write the seller's secret key in the same transaction-ish
-- flow. No anon insert policy is needed or granted.
drop policy if exists "Anyone can create escrow orders" on escrow_orders;

-- Buyers/sellers can still move the order through the non-financial states
-- (dispatch, dispute) with the anon key, but a client can never set status
-- to FUNDS_RELEASED directly, and a row that is already FUNDS_RELEASED can
-- no longer be modified by anon/authenticated clients at all. The only path
-- to FUNDS_RELEASED is POST /api/orders/[id]/release, which uses the service
-- role (bypasses RLS) after a real Paystack transfer succeeds.
drop policy if exists "Anyone can update escrow orders" on escrow_orders;
create policy "Anyone can update escrow orders except release"
  on escrow_orders for update
  using (status is distinct from 'FUNDS_RELEASED')
  with check (status is distinct from 'FUNDS_RELEASED');

-- Seller access tokens, isolated in their own table with RLS enabled and NO
-- policies defined. That means anon/authenticated clients get zero access —
-- not even via a stray `select("*")` on escrow_orders or a realtime
-- subscription, since the secret never lives on that table. Only the
-- service role (which bypasses RLS entirely) can read or write this table,
-- from app/api/orders (create) and app/api/orders/[id]/verify-seller (check).
create table if not exists escrow_order_secrets (
  order_id uuid primary key references escrow_orders (id) on delete cascade,
  seller_secret_key text not null unique,
  created_at timestamptz not null default now()
);

alter table escrow_order_secrets enable row level security;
