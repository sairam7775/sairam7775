-- Bento · seed · destinations at stub tier
--
-- Every row here claims only that the place exists and roughly where it
-- is. No durations, no crowd notes, no "worth it if" — stub tier means the
-- planner will say plainly that it does not know this place well enough
-- yet (§06), which is the honest state for a record nobody has verified.
--
-- Four cities move to deep tier in P5 (D15): Osaka, Kyoto, Nara,
-- Hiroshima, with Miyajima and Himeji alongside.

insert into cities (id, prefecture_id, name, name_ja, coverage_tier, transit_note) values
  -- ---- Hokkaido
  ('sapporo',    'hokkaido', 'Sapporo',    '札幌',   'stub', null),
  ('hakodate',   'hokkaido', 'Hakodate',   '函館',   'stub', null),
  ('otaru',      'hokkaido', 'Otaru',      '小樽',   'stub', null),
  ('furano',     'hokkaido', 'Furano',     '富良野', 'stub', null),
  ('biei',       'hokkaido', 'Biei',       '美瑛',   'stub', null),
  ('niseko',     'hokkaido', 'Niseko',     'ニセコ', 'stub', null),
  ('asahikawa',  'hokkaido', 'Asahikawa',  '旭川',   'stub', null),
  ('shiretoko',  'hokkaido', 'Shiretoko',  '知床',   'stub', null),
  ('noboribetsu','hokkaido', 'Noboribetsu','登別',   'stub', null),
  ('lake-toya',  'hokkaido', 'Lake Toya',  '洞爺湖', 'stub', null),

  -- ---- Tohoku
  ('sendai',        'miyagi',    'Sendai',        '仙台',   'stub', null),
  ('matsushima',    'miyagi',    'Matsushima',    '松島',   'stub', null),
  ('hirosaki',      'aomori',    'Hirosaki',      '弘前',   'stub', null),
  ('aomori-city',   'aomori',    'Aomori',        '青森',   'stub', null),
  ('kakunodate',    'akita',     'Kakunodate',    '角館',   'stub', null),
  ('nyuto-onsen',   'akita',     'Nyuto Onsen',   '乳頭温泉','stub', null),
  ('ginzan-onsen',  'yamagata',  'Ginzan Onsen',  '銀山温泉','stub', null),
  ('yamadera',      'yamagata',  'Yamadera',      '山寺',   'stub', null),
  ('zao',           'yamagata',  'Zao',           '蔵王',   'stub', null),
  ('aizu-wakamatsu','fukushima', 'Aizu-Wakamatsu','会津若松','stub', null),
  ('morioka',       'iwate',     'Morioka',       '盛岡',   'stub', null),
  ('hiraizumi',     'iwate',     'Hiraizumi',     '平泉',   'stub', null),

  -- ---- Kanto
  ('tokyo-city',   'tokyo',    'Tokyo',        '東京',   'stub',
    'Metro and JR cover everything. An IC card beats any tourist pass unless you ride constantly.'),
  ('yokohama',     'kanagawa', 'Yokohama',     '横浜',   'stub', null),
  ('kamakura',     'kanagawa', 'Kamakura',     '鎌倉',   'stub', null),
  ('hakone',       'kanagawa', 'Hakone',       '箱根',   'stub',
    'The Hakone Free Pass covers the loop: train, cable car, ropeway, boat, bus.'),
  ('nikko',        'tochigi',  'Nikko',        '日光',   'stub', null),
  ('kawagoe',      'saitama',  'Kawagoe',      '川越',   'stub', null),
  ('kusatsu-onsen','gunma',    'Kusatsu Onsen','草津温泉','stub', null),
  ('chichibu',     'saitama',  'Chichibu',     '秩父',   'stub', null),
  ('mito',         'ibaraki',  'Mito',         '水戸',   'stub', null),
  ('narita',       'chiba',    'Narita',       '成田',   'stub', null),

  -- ---- Chubu
  ('kanazawa',     'ishikawa',  'Kanazawa',     '金沢',   'stub', null),
  ('takayama',     'gifu',      'Takayama',     '高山',   'stub', null),
  ('shirakawa-go', 'gifu',      'Shirakawa-go', '白川郷', 'stub', null),
  ('gero-onsen',   'gifu',      'Gero Onsen',   '下呂温泉','stub', null),
  ('matsumoto',    'nagano',    'Matsumoto',    '松本',   'stub', null),
  ('nagano-city',  'nagano',    'Nagano',       '長野',   'stub', null),
  ('kamikochi',    'nagano',    'Kamikochi',    '上高地', 'stub', null),
  ('kiso-valley',  'nagano',    'Kiso Valley',  '木曽路', 'stub', null),
  ('yudanaka',     'nagano',    'Yudanaka',     '湯田中', 'stub', null),
  ('nagoya',       'aichi',     'Nagoya',       '名古屋', 'stub', null),
  ('inuyama',      'aichi',     'Inuyama',      '犬山',   'stub', null),
  ('toyama-city',  'toyama',    'Toyama',       '富山',   'stub', null),
  ('tateyama',     'toyama',    'Tateyama',     '立山',   'stub', null),
  ('kawaguchiko',  'yamanashi', 'Kawaguchiko',  '河口湖', 'stub', null),
  ('shizuoka-city','shizuoka',  'Shizuoka',     '静岡',   'stub', null),
  ('izu',          'shizuoka',  'Izu',          '伊豆',   'stub', null),
  ('eiheiji',      'fukui',     'Eiheiji',      '永平寺', 'stub', null),
  ('sado',         'niigata',   'Sado Island',  '佐渡島', 'stub', null),

  -- ---- Kansai
  ('kyoto-city',     'kyoto',    'Kyoto',          '京都',   'stub',
    'Tourist bus routes are slow and overloaded. Prefer subway, walking and the occasional taxi.'),
  ('osaka-city',     'osaka',    'Osaka',          '大阪',   'stub',
    'Midosuji line covers most of what a visitor needs. 29 min to Kyoto on the JR Special Rapid.'),
  ('nara-city',      'nara',     'Nara',           '奈良',   'stub',
    'Most of Nara Park is walkable from Kintetsu Nara, which is closer to the park than JR.'),
  ('kobe',           'hyogo',    'Kobe',           '神戸',   'stub', null),
  ('himeji',         'hyogo',    'Himeji',         '姫路',   'stub',
    'Castle is a 15 min walk straight up the main road from the station. Half a day is enough.'),
  ('kinosaki-onsen', 'hyogo',    'Kinosaki Onsen', '城崎温泉','stub', null),
  ('koyasan',        'wakayama', 'Koyasan',        '高野山', 'stub', null),
  ('kumano-kodo',    'wakayama', 'Kumano Kodo',    '熊野古道','stub', null),
  ('nachi',          'wakayama', 'Nachi',          '那智',   'stub', null),
  ('shirahama',      'wakayama', 'Shirahama',      '白浜',   'stub', null),
  ('ise',            'mie',      'Ise',            '伊勢',   'stub', null),
  ('otsu',           'shiga',    'Otsu',           '大津',   'stub', null),
  ('hikone',         'shiga',    'Hikone',         '彦根',   'stub', null),
  ('uji',            'kyoto',    'Uji',            '宇治',   'stub', null),
  ('amanohashidate', 'kyoto',    'Amanohashidate', '天橋立', 'stub', null),

  -- ---- Chugoku
  ('hiroshima-city', 'hiroshima', 'Hiroshima', '広島',   'stub',
    'Trams are slow but simple. Miyajima is ferry from Miyajimaguchi, covered by JR.'),
  ('miyajima',       'hiroshima', 'Miyajima',  '宮島',   'stub',
    'Ferry from Miyajimaguchi, 10 min. Last ferry back is earlier than people expect.'),
  ('onomichi',       'hiroshima', 'Onomichi',  '尾道',   'stub', null),
  ('okayama-city',   'okayama',   'Okayama',   '岡山',   'stub', null),
  ('kurashiki',      'okayama',   'Kurashiki', '倉敷',   'stub', null),
  ('matsue',         'shimane',   'Matsue',    '松江',   'stub', null),
  ('izumo',          'shimane',   'Izumo',     '出雲',   'stub', null),
  ('tsuwano',        'shimane',   'Tsuwano',   '津和野', 'stub', null),
  ('tottori-city',   'tottori',   'Tottori',   '鳥取',   'stub', null),
  ('iwakuni',        'yamaguchi', 'Iwakuni',   '岩国',   'stub', null),
  ('hagi',           'yamaguchi', 'Hagi',      '萩',     'stub', null),

  -- ---- Shikoku
  ('takamatsu',   'kagawa',    'Takamatsu',   '高松',   'stub', null),
  ('naoshima',    'kagawa',    'Naoshima',    '直島',   'stub', null),
  ('matsuyama',   'ehime',     'Matsuyama',   '松山',   'stub', null),
  ('kochi-city',  'kochi',     'Kochi',       '高知',   'stub', null),
  ('tokushima-city','tokushima','Tokushima',  '徳島',   'stub', null),
  ('iya-valley',  'tokushima', 'Iya Valley',  '祖谷',   'stub', null),

  -- ---- Kyushu
  ('fukuoka-city',   'fukuoka',   'Fukuoka',        '福岡',   'stub', null),
  ('dazaifu',        'fukuoka',   'Dazaifu',        '太宰府', 'stub', null),
  ('nagasaki-city',  'nagasaki',  'Nagasaki',       '長崎',   'stub', null),
  ('kumamoto-city',  'kumamoto',  'Kumamoto',       '熊本',   'stub', null),
  ('aso',            'kumamoto',  'Aso',            '阿蘇',   'stub', null),
  ('kurokawa-onsen', 'kumamoto',  'Kurokawa Onsen', '黒川温泉','stub', null),
  ('beppu',          'oita',      'Beppu',          '別府',   'stub', null),
  ('yufuin',         'oita',      'Yufuin',         '湯布院', 'stub', null),
  ('takachiho',      'miyazaki',  'Takachiho',      '高千穂', 'stub', null),
  ('kagoshima-city', 'kagoshima', 'Kagoshima',      '鹿児島', 'stub', null),
  ('yakushima',      'kagoshima', 'Yakushima',      '屋久島', 'stub', null),
  ('ibusuki',        'kagoshima', 'Ibusuki',        '指宿',   'stub', null),
  ('arita',          'saga',      'Arita',          '有田',   'stub', null),

  -- ---- Okinawa
  ('naha',       'okinawa', 'Naha',        '那覇',   'stub', null),
  ('ishigaki',   'okinawa', 'Ishigaki',    '石垣島', 'stub', null),
  ('miyakojima', 'okinawa', 'Miyakojima',  '宮古島', 'stub', null),
  ('taketomi',   'okinawa', 'Taketomi',    '竹富島', 'stub', null)
on conflict (id) do nothing;
