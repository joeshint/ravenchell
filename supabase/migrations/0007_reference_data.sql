-- =============================================================================
-- 0007_reference_data.sql
-- CvSU Lost and Found System — required reference data (safe to re-run)
--
-- This is configuration the app needs in every environment, not demo data.
-- Administrators can edit all of it later from the admin pages.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- System settings
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('system_name',           '"CvSU Lost and Found"',            'Name shown in the header and emails.', true),
  ('allowed_email_domains', '["cvsu.edu.ph"]',                  'Only these email domains may register. Empty array = any domain.', true),
  ('require_lost_approval', 'true',                             'If true, lost-item reports must be approved by an admin before they are listed.', true),
  ('max_upload_mb',         '5',                                'Maximum image size shown to users (the bucket limit is the real enforcement).', true),
  ('claim_office',          '"Office of Student Affairs and Services (OSAS)"', 'Default office where verified claims are released.', true),
  ('claim_instructions',    '"Bring a valid CvSU ID and any proof of ownership when you pick up your item."', 'Shown to claimants after approval.', true),
  ('support_email',         '""',                               'Contact email shown in the footer (optional).', true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Item categories (icon = lucide-react component name)
-- -----------------------------------------------------------------------------
insert into public.item_categories (name, slug, description, icon, sort_order) values
  ('Electronics',               'electronics',               'Phones, laptops, tablets, chargers, earphones', 'Smartphone', 1),
  ('Identification Cards',      'identification-cards',      'School IDs, government IDs, licenses',         'IdCard',     2),
  ('Wallets and Bags',          'wallets-and-bags',          'Wallets, purses, backpacks, pouches',          'Wallet',     3),
  ('Clothing',                  'clothing',                  'Uniforms, jackets, PE attire, caps',           'Shirt',      4),
  ('Books and School Supplies', 'books-and-school-supplies', 'Books, notebooks, calculators, art materials', 'BookOpen',   5),
  ('Accessories',               'accessories',               'Watches, eyeglasses, jewelry, umbrellas',      'Watch',      6),
  ('Keys',                      'keys',                      'House keys, car keys, locker keys',            'KeyRound',   7),
  ('Documents',                 'documents',                 'Certificates, forms, envelopes, receipts',     'FileText',   8),
  ('Others',                    'others',                    'Anything that does not fit another category',  'Package',    9)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Campuses (CvSU main campus + satellite campuses). Verify names/codes with
-- the university and adjust from Admin → Campus Locations.
-- -----------------------------------------------------------------------------
insert into public.campuses (name, code, address, sort_order) values
  ('Main Campus (Indang)',     'MAIN',  'Indang, Cavite',          1),
  ('CCAT Campus (Rosario)',    'CCAT',  'Rosario, Cavite',         2),
  ('Bacoor City Campus',       'BACOOR','Bacoor City, Cavite',     3),
  ('Carmona Campus',           'CARMONA','Carmona, Cavite',        4),
  ('Cavite City Campus',       'CAVCITY','Cavite City, Cavite',    5),
  ('General Trias City Campus','GENTRI','General Trias City, Cavite', 6),
  ('Imus Campus',              'IMUS',  'Imus City, Cavite',       7),
  ('Maragondon Campus',        'MARA',  'Maragondon, Cavite',      8),
  ('Naic Campus',              'NAIC',  'Naic, Cavite',            9),
  ('Silang Campus',            'SILANG','Silang, Cavite',          10),
  ('Tanza Campus',             'TANZA', 'Tanza, Cavite',           11),
  ('Trece Martires City Campus','TMC',  'Trece Martires City, Cavite', 12)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Generic locations for every campus. Custody points are where found items
-- are kept until released.
-- -----------------------------------------------------------------------------
insert into public.campus_locations (campus_id, name, is_custody_point)
select c.id, l.name, l.is_custody_point
from public.campuses c
cross join (values
  ('Office of Student Affairs and Services (OSAS)', true),
  ('Security Office / Main Gate',                   true),
  ('Library',                                       false),
  ('Canteen / Cafeteria',                           false),
  ('Classroom / Lecture Hall',                      false),
  ('Laboratory',                                    false),
  ('Gymnasium / Covered Court',                     false),
  ('Administration Building',                       false),
  ('Parking Area',                                  false),
  ('Restroom',                                      false),
  ('Hallway / Corridor',                            false),
  ('Open Grounds / Oval',                           false),
  ('Other (specify in details)',                    false)
) as l (name, is_custody_point)
on conflict do nothing;
