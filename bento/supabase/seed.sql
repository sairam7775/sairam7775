-- Bento · seed · the geography spine
--
-- Regions and prefectures are fixed administrative divisions: small,
-- authoritative, and they do not change, so they are seeded rather than
-- imported. Destinations are seeded at STUB tier, which claims nothing
-- beyond "this place exists and is here" — everything a traveller would
-- act on arrives later through the draft-and-verify pipeline (§10).
--
-- scripts/import-geography.ts enriches these with Wikidata ids and
-- coordinates. Run it locally; it needs network access this repo's CI
-- does not have.

-- ------------------------------------------------------------- regions

insert into regions (id, name, name_ja, sort_order) values
  ('hokkaido', 'Hokkaido', '北海道', 1),
  ('tohoku',   'Tohoku',   '東北',   2),
  ('kanto',    'Kanto',    '関東',   3),
  ('chubu',    'Chubu',    '中部',   4),
  ('kansai',   'Kansai',   '関西',   5),
  ('chugoku',  'Chugoku',  '中国',   6),
  ('shikoku',  'Shikoku',  '四国',   7),
  ('kyushu',   'Kyushu',   '九州',   8),
  ('okinawa',  'Okinawa',  '沖縄',   9)
on conflict (id) do nothing;

-- ---------------------------------------------------------- prefectures
-- All 47. Mie is placed in Kansai, which is the Kinki convention; it is
-- also commonly grouped with Tokai in Chubu. If a route ever looks odd
-- around Ise, this line is why.

insert into prefectures (id, region_id, name, name_ja) values
  ('hokkaido',  'hokkaido', 'Hokkaido',  '北海道'),

  ('aomori',    'tohoku', 'Aomori',    '青森県'),
  ('iwate',     'tohoku', 'Iwate',     '岩手県'),
  ('miyagi',    'tohoku', 'Miyagi',    '宮城県'),
  ('akita',     'tohoku', 'Akita',     '秋田県'),
  ('yamagata',  'tohoku', 'Yamagata',  '山形県'),
  ('fukushima', 'tohoku', 'Fukushima', '福島県'),

  ('ibaraki',   'kanto', 'Ibaraki',   '茨城県'),
  ('tochigi',   'kanto', 'Tochigi',   '栃木県'),
  ('gunma',     'kanto', 'Gunma',     '群馬県'),
  ('saitama',   'kanto', 'Saitama',   '埼玉県'),
  ('chiba',     'kanto', 'Chiba',     '千葉県'),
  ('tokyo',     'kanto', 'Tokyo',     '東京都'),
  ('kanagawa',  'kanto', 'Kanagawa',  '神奈川県'),

  ('niigata',   'chubu', 'Niigata',   '新潟県'),
  ('toyama',    'chubu', 'Toyama',    '富山県'),
  ('ishikawa',  'chubu', 'Ishikawa',  '石川県'),
  ('fukui',     'chubu', 'Fukui',     '福井県'),
  ('yamanashi', 'chubu', 'Yamanashi', '山梨県'),
  ('nagano',    'chubu', 'Nagano',    '長野県'),
  ('gifu',      'chubu', 'Gifu',      '岐阜県'),
  ('shizuoka',  'chubu', 'Shizuoka',  '静岡県'),
  ('aichi',     'chubu', 'Aichi',     '愛知県'),

  ('mie',       'kansai', 'Mie',       '三重県'),
  ('shiga',     'kansai', 'Shiga',     '滋賀県'),
  ('kyoto',     'kansai', 'Kyoto',     '京都府'),
  ('osaka',     'kansai', 'Osaka',     '大阪府'),
  ('hyogo',     'kansai', 'Hyogo',     '兵庫県'),
  ('nara',      'kansai', 'Nara',      '奈良県'),
  ('wakayama',  'kansai', 'Wakayama',  '和歌山県'),

  ('tottori',   'chugoku', 'Tottori',   '鳥取県'),
  ('shimane',   'chugoku', 'Shimane',   '島根県'),
  ('okayama',   'chugoku', 'Okayama',   '岡山県'),
  ('hiroshima', 'chugoku', 'Hiroshima', '広島県'),
  ('yamaguchi', 'chugoku', 'Yamaguchi', '山口県'),

  ('tokushima', 'shikoku', 'Tokushima', '徳島県'),
  ('kagawa',    'shikoku', 'Kagawa',    '香川県'),
  ('ehime',     'shikoku', 'Ehime',     '愛媛県'),
  ('kochi',     'shikoku', 'Kochi',     '高知県'),

  ('fukuoka',   'kyushu', 'Fukuoka',   '福岡県'),
  ('saga',      'kyushu', 'Saga',      '佐賀県'),
  ('nagasaki',  'kyushu', 'Nagasaki',  '長崎県'),
  ('kumamoto',  'kyushu', 'Kumamoto',  '熊本県'),
  ('oita',      'kyushu', 'Oita',      '大分県'),
  ('miyazaki',  'kyushu', 'Miyazaki',  '宮崎県'),
  ('kagoshima', 'kyushu', 'Kagoshima', '鹿児島県'),

  ('okinawa',   'okinawa', 'Okinawa',  '沖縄県')
on conflict (id) do nothing;

-- ------------------------------------------------------------ fx anchor

insert into fx_rates (currency, jpy_per_unit) values ('JPY', 1.0)
on conflict (currency) do nothing;
