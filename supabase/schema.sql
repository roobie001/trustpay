-- TrustPay escrow schema
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

-- Safe to re-run: adds the payout columns to a table created before they existed.
alter table escrow_orders add column if not exists seller_bank text;
alter table escrow_orders add column if not exists seller_account_number text;

alter table escrow_orders enable row level security;

-- Hackathon-friendly open policies: anyone with the link can read/update an order.
-- Tighten these before shipping to production.
create policy "Anyone can read escrow orders"
  on escrow_orders for select
  using (true);

create policy "Anyone can create escrow orders"
  on escrow_orders for insert
  with check (true);

create policy "Anyone can update escrow orders"
  on escrow_orders for update
  using (true);
