-- Jalankan file ini di Supabase SQL Editor jika tabel sudah pernah dibuat.
-- Policy diperlukan agar frontend dengan publishable key bisa menyimpan data.

alter table suppliers enable row level security;
alter table material_categories enable row level security;
alter table materials enable row level security;
alter table stock_transactions enable row level security;
alter table purchase_orders enable row level security;

drop policy if exists suppliers_public_access on suppliers;
create policy suppliers_public_access on suppliers for all to anon, authenticated using (true) with check (true);

drop policy if exists material_categories_public_access on material_categories;
create policy material_categories_public_access on material_categories for all to anon, authenticated using (true) with check (true);

drop policy if exists materials_public_access on materials;
create policy materials_public_access on materials for all to anon, authenticated using (true) with check (true);

drop policy if exists stock_transactions_public_access on stock_transactions;
create policy stock_transactions_public_access on stock_transactions for all to anon, authenticated using (true) with check (true);

drop policy if exists purchase_orders_public_access on purchase_orders;
create policy purchase_orders_public_access on purchase_orders for all to anon, authenticated using (true) with check (true);

grant select, insert, update on purchase_orders to anon, authenticated;
grant execute on function receive_purchase_order(bigint) to anon, authenticated;

grant select, insert, update, delete on material_categories to anon, authenticated;
grant usage, select on sequence material_categories_id_seq to anon, authenticated;