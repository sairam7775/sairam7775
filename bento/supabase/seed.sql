-- Bento · seed
--
-- Regions and prefectures are fixed, small, and never change, so they are
-- seeded rather than imported. The full city list for Japan arrives in P2
-- from open data; the cities below are the ones P5 takes to deep tier
-- (D15) plus the two that ship with them.

insert into regions (id, name, name_ja, sort_order) values
  ('hokkaido', 'Hokkaido',  '北海道', 1),
  ('tohoku',   'Tohoku',    '東北',   2),
  ('kanto',    'Kanto',     '関東',   3),
  ('chubu',    'Chubu',     '中部',   4),
  ('kansai',   'Kansai',    '関西',   5),
  ('chugoku',  'Chugoku',   '中国',   6),
  ('shikoku',  'Shikoku',   '四国',   7),
  ('kyushu',   'Kyushu',    '九州',   8),
  ('okinawa',  'Okinawa',   '沖縄',   9)
on conflict (id) do nothing;

insert into prefectures (id, region_id, name, name_ja) values
  ('kyoto',     'kansai',  'Kyoto',     '京都府'),
  ('osaka',     'kansai',  'Osaka',     '大阪府'),
  ('nara',      'kansai',  'Nara',      '奈良県'),
  ('hyogo',     'kansai',  'Hyogo',     '兵庫県'),
  ('hiroshima', 'chugoku', 'Hiroshima', '広島県'),
  ('tokyo',     'kanto',   'Tokyo',     '東京都')
on conflict (id) do nothing;

-- D15: the Kansai–Sanyo corridor goes deep first. All four sit on one rail
-- line, so a single transit graph serves them — cheaper per city than two
-- disconnected regions would have been.
insert into cities (id, prefecture_id, name, name_ja, coverage_tier, transit_note) values
  ('kyoto-city', 'kyoto', 'Kyoto', '京都市', 'stub',
    'Tourist bus routes are slow and overloaded. Prefer subway, walking and the occasional taxi.'),
  ('osaka-city', 'osaka', 'Osaka', '大阪市', 'stub',
    'Midosuji line covers most of what a visitor needs. 29 min to Kyoto on the JR Special Rapid.'),
  ('nara-city',  'nara',  'Nara',  '奈良市', 'stub',
    'Most of Nara Park is walkable from Kintetsu Nara. Kintetsu is closer to the park than JR.'),
  ('hiroshima-city', 'hiroshima', 'Hiroshima', '広島市', 'stub',
    'Trams are slow but simple. Miyajima is ferry from Miyajimaguchi, covered by JR.'),
  -- Ships with Hiroshima: Itsukushima is a shrine, and nobody visits one
  -- without the other.
  ('miyajima', 'hiroshima', 'Miyajima', '宮島', 'stub',
    'Ferry from Miyajimaguchi, 10 min. Last ferry back is earlier than people expect.'),
  -- An en-route cluster rather than a city: directly on the line between
  -- Osaka and Hiroshima, and the best surviving castle in Japan.
  ('himeji', 'hyogo', 'Himeji', '姫路', 'stub',
    'Castle is a 15 min walk straight up the main road from the station. Half a day is enough.')
on conflict (id) do nothing;

-- A starting rate so the currency picker has something to show before the
-- first refresh job runs. Replaced daily; the UI shows fetched_at.
insert into fx_rates (currency, jpy_per_unit) values
  ('JPY', 1.0)
on conflict (currency) do nothing;
