-- Memperbolehkan penghapusan destinasi dari panel admin secara aman.
-- Item rencana (trip_items) yang mereferensi destinasi akan dihapus otomatis (cascade).

alter table trip_items
  drop constraint if exists trip_items_destination_id_fkey,
  add constraint trip_items_destination_id_fkey
    foreign key (destination_id) references destinations(id) on delete cascade;
