export const POWDER_CATEGORIES = [
  'Pantry Staples',
  'Performance',
  'Drinks',
  'Household',
  'Outdoors',
  'Questionable',
  'Impossible',
] as const;

export type PowderCategory = (typeof POWDER_CATEGORIES)[number];

export type PowderProduct = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  category: PowderCategory;
  stock_count: number;
  sales_count: number;
  newest_rank: number;
  image_set_id: string;
  slug: string;
  consumption_warning: 'Not for consumption' | null;
  visual: {
    label_color: string;
    powder_color: string;
    mark: string;
    batch_code: string;
  };
};

const nonConsumable = 'Not for consumption' as const;

const visual = (
  label_color: string,
  powder_color: string,
  mark: string,
  batch_code: string,
): PowderProduct['visual'] => ({ label_color, powder_color, mark, batch_code });

export const POWDER_CATALOG = [
  // Pantry Staples — credible enough to begin with.
  {
    id: 1,
    name: 'Protein Powder',
    description:
      'Vanilla whey protein powder, 900g. For shakes, oats, and taking breakfast unusually seriously.',
    price_cents: 3295,
    compare_at_price_cents: null,
    category: 'Pantry Staples',
    stock_count: 42,
    sales_count: 680,
    newest_rank: 1,
    image_set_id: 'protein-powder',
    slug: 'protein-powder',
    consumption_warning: null,
    visual: visual('#d9583b', '#f4dfb5', 'P', 'PAN-01'),
  },
  {
    id: 2,
    name: 'Powdered Oats',
    description: 'Stone-ground oat flour, 750g. Porridge plans with less chewing.',
    price_cents: 1195,
    compare_at_price_cents: null,
    category: 'Pantry Staples',
    stock_count: 56,
    sales_count: 410,
    newest_rank: 2,
    image_set_id: 'powdered-oats',
    slug: 'powdered-oats',
    consumption_warning: null,
    visual: visual('#d5a12d', '#dac18b', 'O', 'PAN-02'),
  },
  {
    id: 3,
    name: 'Cocoa Powder',
    description: 'Deep cocoa powder, 250g. Brownies, hot drinks, and controlled drama.',
    price_cents: 895,
    compare_at_price_cents: 1095,
    category: 'Pantry Staples',
    stock_count: 38,
    sales_count: 495,
    newest_rank: 3,
    image_set_id: 'cocoa-powder',
    slug: 'cocoa-powder',
    consumption_warning: null,
    visual: visual('#71412c', '#6a3828', 'C', 'PAN-03'),
  },
  {
    id: 4,
    name: 'Powdered Peanut Butter',
    description:
      'Defatted peanut butter powder, 180g. Stir into sauces or rebuild a sandwich internally.',
    price_cents: 1095,
    compare_at_price_cents: null,
    category: 'Pantry Staples',
    stock_count: 44,
    sales_count: 360,
    newest_rank: 4,
    image_set_id: 'powdered-peanut-butter',
    slug: 'powdered-peanut-butter',
    consumption_warning: null,
    visual: visual('#d68132', '#d5ad68', 'PB', 'PAN-04'),
  },
  {
    id: 5,
    name: 'Tomato Powder',
    description: 'Concentrated tomato powder, 200g. Soup, sauces, and emergency redness.',
    price_cents: 795,
    compare_at_price_cents: null,
    category: 'Pantry Staples',
    stock_count: 47,
    sales_count: 290,
    newest_rank: 5,
    image_set_id: 'tomato-powder',
    slug: 'tomato-powder',
    consumption_warning: null,
    visual: visual('#c9483d', '#d85643', 'T', 'PAN-05'),
  },
  {
    id: 6,
    name: 'Mushroom Powder',
    description: 'Dried porcini powder, 100g. Savoury depth without visible mushrooms.',
    price_cents: 1295,
    compare_at_price_cents: 1495,
    category: 'Pantry Staples',
    stock_count: 31,
    sales_count: 275,
    newest_rank: 6,
    image_set_id: 'mushroom-powder',
    slug: 'mushroom-powder',
    consumption_warning: null,
    visual: visual('#8a6847', '#9a7e57', 'M', 'PAN-06'),
  },
  {
    id: 7,
    name: 'Roasted Garlic Powder',
    description: 'Slow-roasted garlic powder, 120g. Dinner gets its paperwork done.',
    price_cents: 695,
    compare_at_price_cents: null,
    category: 'Pantry Staples',
    stock_count: 63,
    sales_count: 390,
    newest_rank: 7,
    image_set_id: 'roasted-garlic-powder',
    slug: 'roasted-garlic-powder',
    consumption_warning: null,
    visual: visual('#b67e2c', '#d8bf85', 'G', 'PAN-07'),
  },

  // Performance — still recognisable, increasingly committed.
  {
    id: 8,
    name: 'Electrolyte Powder',
    description: 'Citrus electrolyte mix, 300g. Add to water after ordinary exertion.',
    price_cents: 1495,
    compare_at_price_cents: null,
    category: 'Performance',
    stock_count: 50,
    sales_count: 540,
    newest_rank: 8,
    image_set_id: 'electrolyte-powder',
    slug: 'electrolyte-powder',
    consumption_warning: null,
    visual: visual('#2476a8', '#b8dc48', 'E', 'PER-01'),
  },
  {
    id: 9,
    name: 'Recovery Cocoa',
    description:
      'Cocoa recovery drink mix, 500g. Chocolate-flavoured post-exercise administration.',
    price_cents: 2395,
    compare_at_price_cents: 2795,
    category: 'Performance',
    stock_count: 29,
    sales_count: 340,
    newest_rank: 9,
    image_set_id: 'recovery-cocoa',
    slug: 'recovery-cocoa',
    consumption_warning: null,
    visual: visual('#51362f', '#8b583e', 'RC', 'PER-02'),
  },
  {
    id: 10,
    name: 'Beetroot Powder',
    description: 'Beetroot powder, 250g. Bright colour for drinks with personal objectives.',
    price_cents: 1395,
    compare_at_price_cents: null,
    category: 'Performance',
    stock_count: 35,
    sales_count: 215,
    newest_rank: 10,
    image_set_id: 'beetroot-powder',
    slug: 'beetroot-powder',
    consumption_warning: null,
    visual: visual('#a82d4b', '#bd3555', 'B', 'PER-03'),
  },
  {
    id: 11,
    name: 'Pea Protein Powder',
    description: 'Unflavoured pea protein powder, 750g. A quiet, practical scoop.',
    price_cents: 2695,
    compare_at_price_cents: null,
    category: 'Performance',
    stock_count: 34,
    sales_count: 305,
    newest_rank: 11,
    image_set_id: 'pea-protein-powder',
    slug: 'pea-protein-powder',
    consumption_warning: null,
    visual: visual('#658a47', '#c5d69c', 'PP', 'PER-04'),
  },
  {
    id: 12,
    name: 'Banana Powder',
    description: 'Freeze-dried banana powder, 200g. Smoothies without banana logistics.',
    price_cents: 1295,
    compare_at_price_cents: 1595,
    category: 'Performance',
    stock_count: 40,
    sales_count: 330,
    newest_rank: 12,
    image_set_id: 'banana-powder',
    slug: 'banana-powder',
    consumption_warning: null,
    visual: visual('#e0b82f', '#e5ce65', 'B', 'PER-05'),
  },
  {
    id: 13,
    name: 'Oat Milk Powder',
    description: 'Barista oat milk powder, 400g. Foam arrives after a measured delay.',
    price_cents: 1795,
    compare_at_price_cents: null,
    category: 'Performance',
    stock_count: 45,
    sales_count: 365,
    newest_rank: 13,
    image_set_id: 'oat-milk-powder',
    slug: 'oat-milk-powder',
    consumption_warning: null,
    visual: visual('#b8894b', '#e3d2b0', 'OM', 'PER-06'),
  },

  // Drinks — normal objects, granulated.
  {
    id: 14,
    name: 'Matcha Powder',
    description: 'Ceremonial-style matcha powder, 30g. Whisk it until your calendar feels cleaner.',
    price_cents: 1895,
    compare_at_price_cents: null,
    category: 'Drinks',
    stock_count: 33,
    sales_count: 520,
    newest_rank: 14,
    image_set_id: 'matcha-powder',
    slug: 'matcha-powder',
    consumption_warning: null,
    visual: visual('#476b35', '#77a94f', 'M', 'DRK-01'),
  },
  {
    id: 15,
    name: 'Coffee Powder',
    description:
      'Instant single-origin coffee powder, 100g. A cup of coffee with no visible beans.',
    price_cents: 1495,
    compare_at_price_cents: 1795,
    category: 'Drinks',
    stock_count: 48,
    sales_count: 610,
    newest_rank: 15,
    image_set_id: 'coffee-powder',
    slug: 'coffee-powder',
    consumption_warning: null,
    visual: visual('#56382d', '#8a5b3d', 'C', 'DRK-02'),
  },
  {
    id: 16,
    name: 'Strawberry Milk Powder',
    description: 'Strawberry milk drink mix, 350g. Pink milk, pending water.',
    price_cents: 1095,
    compare_at_price_cents: null,
    category: 'Drinks',
    stock_count: 52,
    sales_count: 270,
    newest_rank: 16,
    image_set_id: 'strawberry-milk-powder',
    slug: 'strawberry-milk-powder',
    consumption_warning: null,
    visual: visual('#d85475', '#ef9aac', 'SM', 'DRK-03'),
  },
  {
    id: 17,
    name: 'Lemonade Powder',
    description: 'Sharp lemonade powder, 400g. Stir, chill, and accept summer by committee.',
    price_cents: 995,
    compare_at_price_cents: null,
    category: 'Drinks',
    stock_count: 58,
    sales_count: 305,
    newest_rank: 17,
    image_set_id: 'lemonade-powder',
    slug: 'lemonade-powder',
    consumption_warning: null,
    visual: visual('#d4ad25', '#f1e36e', 'L', 'DRK-04'),
  },
  {
    id: 18,
    name: 'Chai Powder',
    description: 'Spiced chai powder, 250g. Tea leaves have been spared the meeting.',
    price_cents: 1195,
    compare_at_price_cents: 1395,
    category: 'Drinks',
    stock_count: 37,
    sales_count: 350,
    newest_rank: 18,
    image_set_id: 'chai-powder',
    slug: 'chai-powder',
    consumption_warning: null,
    visual: visual('#a85e29', '#c98950', 'CH', 'DRK-05'),
  },
  {
    id: 19,
    name: 'Cherry Soda Powder',
    description: 'Cherry soda drink mix, 180g. Bubbles sold separately by physics.',
    price_cents: 895,
    compare_at_price_cents: null,
    category: 'Drinks',
    stock_count: 46,
    sales_count: 225,
    newest_rank: 19,
    image_set_id: 'cherry-soda-powder',
    slug: 'cherry-soda-powder',
    consumption_warning: null,
    visual: visual('#b52d45', '#dc4862', 'CS', 'DRK-06'),
  },

  // Household — useful-looking, explicitly not edible.
  {
    id: 20,
    name: 'Laundry Powder',
    description: 'Cedar laundry powder, 1kg. For clothes that have seen things.',
    price_cents: 1595,
    compare_at_price_cents: null,
    category: 'Household',
    stock_count: 54,
    sales_count: 445,
    newest_rank: 20,
    image_set_id: 'laundry-powder',
    slug: 'laundry-powder',
    consumption_warning: nonConsumable,
    visual: visual('#2b789d', '#e7eef0', 'LP', 'HOU-01'),
  },
  {
    id: 21,
    name: 'Dishwasher Powder',
    description: 'Citrus dishwasher powder, 800g. Plates receive a fresh start.',
    price_cents: 1395,
    compare_at_price_cents: 1695,
    category: 'Household',
    stock_count: 43,
    sales_count: 320,
    newest_rank: 21,
    image_set_id: 'dishwasher-powder',
    slug: 'dishwasher-powder',
    consumption_warning: nonConsumable,
    visual: visual('#438e89', '#e2eee0', 'DP', 'HOU-02'),
  },
  {
    id: 22,
    name: 'Carpet Refresh Powder',
    description: 'Dry carpet refresh powder, 500g. Vacuum after the room has reflected.',
    price_cents: 1295,
    compare_at_price_cents: null,
    category: 'Household',
    stock_count: 30,
    sales_count: 160,
    newest_rank: 22,
    image_set_id: 'carpet-refresh-powder',
    slug: 'carpet-refresh-powder',
    consumption_warning: nonConsumable,
    visual: visual('#795b98', '#c8b5d5', 'CR', 'HOU-03'),
  },
  {
    id: 23,
    name: 'Window Powder',
    description: 'Dry window-cleaning powder, 350g. Add water; see through your decisions.',
    price_cents: 1195,
    compare_at_price_cents: null,
    category: 'Household',
    stock_count: 39,
    sales_count: 145,
    newest_rank: 23,
    image_set_id: 'window-powder',
    slug: 'window-powder',
    consumption_warning: nonConsumable,
    visual: visual('#4c96b4', '#b6e0ec', 'W', 'HOU-04'),
  },
  {
    id: 24,
    name: 'Sock Drawer Powder',
    description: 'Lavender drawer powder, 150g. Socks deserve a formal atmosphere.',
    price_cents: 995,
    compare_at_price_cents: 1295,
    category: 'Household',
    stock_count: 41,
    sales_count: 185,
    newest_rank: 24,
    image_set_id: 'sock-drawer-powder',
    slug: 'sock-drawer-powder',
    consumption_warning: nonConsumable,
    visual: visual('#7d579a', '#c1a8d1', 'SD', 'HOU-05'),
  },
  {
    id: 25,
    name: 'Bookshelf Dusting Powder',
    description: 'Static-lifting dusting powder, 200g. Your unread books will look prepared.',
    price_cents: 1095,
    compare_at_price_cents: null,
    category: 'Household',
    stock_count: 27,
    sales_count: 120,
    newest_rank: 25,
    image_set_id: 'bookshelf-dusting-powder',
    slug: 'bookshelf-dusting-powder',
    consumption_warning: nonConsumable,
    visual: visual('#8b7655', '#d2c29f', 'BD', 'HOU-06'),
  },
  {
    id: 26,
    name: 'Mop Bucket Powder',
    description: 'Floor-cleaning powder, 750g. A bucket becomes a plan.',
    price_cents: 1495,
    compare_at_price_cents: null,
    category: 'Household',
    stock_count: 36,
    sales_count: 210,
    newest_rank: 26,
    image_set_id: 'mop-bucket-powder',
    slug: 'mop-bucket-powder',
    consumption_warning: nonConsumable,
    visual: visual('#357f7d', '#acd5ce', 'MB', 'HOU-07'),
  },

  // Outdoors — scenery begins to enter the supply chain.
  {
    id: 27,
    name: 'Powdered Campfire',
    description: 'Smoky campfire-scented powder, 200g. Sprinkle nowhere near an actual flame.',
    price_cents: 1695,
    compare_at_price_cents: null,
    category: 'Outdoors',
    stock_count: 24,
    sales_count: 390,
    newest_rank: 27,
    image_set_id: 'powdered-campfire',
    slug: 'powdered-campfire',
    consumption_warning: nonConsumable,
    visual: visual('#b6452d', '#715044', 'CF', 'OUT-01'),
  },
  {
    id: 28,
    name: 'Powdered Beach',
    description: 'Sea-air beach ambience powder, 250g. Sand-free by administrative decree.',
    price_cents: 1795,
    compare_at_price_cents: 2195,
    category: 'Outdoors',
    stock_count: 25,
    sales_count: 340,
    newest_rank: 28,
    image_set_id: 'powdered-beach',
    slug: 'powdered-beach',
    consumption_warning: nonConsumable,
    visual: visual('#2f97a9', '#e3cb8c', 'B', 'OUT-02'),
  },
  {
    id: 29,
    name: 'Trail Dust Powder',
    description: 'Pine trail ambience powder, 180g. For indoor routes with no map.',
    price_cents: 1395,
    compare_at_price_cents: null,
    category: 'Outdoors',
    stock_count: 28,
    sales_count: 190,
    newest_rank: 29,
    image_set_id: 'trail-dust-powder',
    slug: 'trail-dust-powder',
    consumption_warning: nonConsumable,
    visual: visual('#557447', '#9a8261', 'TD', 'OUT-03'),
  },
  {
    id: 30,
    name: 'Morning Fog Powder',
    description: 'Atmospheric fog-effect powder, 120g. Visibility sold in a separate bag.',
    price_cents: 1595,
    compare_at_price_cents: null,
    category: 'Outdoors',
    stock_count: 22,
    sales_count: 175,
    newest_rank: 30,
    image_set_id: 'morning-fog-powder',
    slug: 'morning-fog-powder',
    consumption_warning: nonConsumable,
    visual: visual('#69879b', '#d3dfe3', 'MF', 'OUT-04'),
  },
  {
    id: 31,
    name: 'Pine Needle Powder',
    description: 'Forest-floor scent powder, 150g. Hike adjacent, without boots.',
    price_cents: 1295,
    compare_at_price_cents: 1495,
    category: 'Outdoors',
    stock_count: 34,
    sales_count: 205,
    newest_rank: 31,
    image_set_id: 'pine-needle-powder',
    slug: 'pine-needle-powder',
    consumption_warning: nonConsumable,
    visual: visual('#38634d', '#7b9b69', 'PN', 'OUT-05'),
  },
  {
    id: 32,
    name: 'Summit Air Powder',
    description: 'Crisp alpine ambience powder, 100g. Open only at ground level.',
    price_cents: 1895,
    compare_at_price_cents: null,
    category: 'Outdoors',
    stock_count: 19,
    sales_count: 135,
    newest_rank: 32,
    image_set_id: 'summit-air-powder',
    slug: 'summit-air-powder',
    consumption_warning: nonConsumable,
    visual: visual('#557da8', '#d4e3ed', 'SA', 'OUT-06'),
  },

  // Questionable — domestic concepts receive powders.
  {
    id: 33,
    name: 'Powdered House',
    description:
      'Architectural house powder, conceptual quantity. Add nothing; it is already a house.',
    price_cents: 2495,
    compare_at_price_cents: null,
    category: 'Questionable',
    stock_count: 17,
    sales_count: 260,
    newest_rank: 33,
    image_set_id: 'powdered-house',
    slug: 'powdered-house',
    consumption_warning: nonConsumable,
    visual: visual('#a96d46', '#d6c1a8', 'H', 'QUE-01'),
  },
  {
    id: 34,
    name: 'Powdered Wi-Fi',
    description: 'Wireless-network powder, conceptual quantity. For rooms requesting more bars.',
    price_cents: 2295,
    compare_at_price_cents: 2795,
    category: 'Questionable',
    stock_count: 21,
    sales_count: 330,
    newest_rank: 34,
    image_set_id: 'powdered-wifi',
    slug: 'powdered-wifi',
    consumption_warning: nonConsumable,
    visual: visual('#3e75ad', '#a4c8e4', 'WF', 'QUE-02'),
  },
  {
    id: 35,
    name: 'Powdered Tuesday',
    description: 'Weekday powder, conceptual quantity. Apply only when Monday has concluded.',
    price_cents: 1995,
    compare_at_price_cents: null,
    category: 'Questionable',
    stock_count: 26,
    sales_count: 245,
    newest_rank: 35,
    image_set_id: 'powdered-tuesday',
    slug: 'powdered-tuesday',
    consumption_warning: nonConsumable,
    visual: visual('#4e77a7', '#bbc9da', 'TU', 'QUE-03'),
  },
  {
    id: 36,
    name: 'Powdered Meeting',
    description: 'Corporate meeting powder, conceptual quantity. Contains no actionable minutes.',
    price_cents: 2195,
    compare_at_price_cents: null,
    category: 'Questionable',
    stock_count: 18,
    sales_count: 155,
    newest_rank: 36,
    image_set_id: 'powdered-meeting',
    slug: 'powdered-meeting',
    consumption_warning: nonConsumable,
    visual: visual('#5e6472', '#b7bac1', 'MT', 'QUE-04'),
  },
  {
    id: 37,
    name: 'Powdered Spare Key',
    description: 'Emergency key powder, conceptual quantity. Keep somewhere extremely memorable.',
    price_cents: 1695,
    compare_at_price_cents: 1995,
    category: 'Questionable',
    stock_count: 23,
    sales_count: 180,
    newest_rank: 37,
    image_set_id: 'powdered-spare-key',
    slug: 'powdered-spare-key',
    consumption_warning: nonConsumable,
    visual: visual('#9a7727', '#d3b969', 'SK', 'QUE-05'),
  },
  {
    id: 38,
    name: 'Powdered Queue',
    description: 'British queue powder, conceptual quantity. First come, first finely considered.',
    price_cents: 2095,
    compare_at_price_cents: null,
    category: 'Questionable',
    stock_count: 20,
    sales_count: 140,
    newest_rank: 38,
    image_set_id: 'powdered-queue',
    slug: 'powdered-queue',
    consumption_warning: nonConsumable,
    visual: visual('#7a5e8f', '#c7b4d4', 'Q', 'QUE-06'),
  },

  // Impossible — hero product is intentionally the bestseller.
  {
    id: 39,
    name: 'Powdered Five More Minutes',
    description:
      'Temporal delay powder, conceptual quantity. Use when alarm negotiations continue.',
    price_cents: 2395,
    compare_at_price_cents: null,
    category: 'Impossible',
    stock_count: 16,
    sales_count: 470,
    newest_rank: 39,
    image_set_id: 'powdered-five-more-minutes',
    slug: 'powdered-five-more-minutes',
    consumption_warning: nonConsumable,
    visual: visual('#62508d', '#b7a2d4', '5M', 'IMP-01'),
  },
  {
    id: 40,
    name: 'Powdered Gravity',
    description:
      'Portable gravity powder, conceptual quantity. Handle with appropriate downward respect.',
    price_cents: 2995,
    compare_at_price_cents: 3495,
    category: 'Impossible',
    stock_count: 14,
    sales_count: 440,
    newest_rank: 40,
    image_set_id: 'powdered-gravity',
    slug: 'powdered-gravity',
    consumption_warning: nonConsumable,
    visual: visual('#393e62', '#8288ae', 'G', 'IMP-02'),
  },
  {
    id: 41,
    name: 'Powdered Silence',
    description:
      'Acoustic silence powder, conceptual quantity. Open away from meaningful conversations.',
    price_cents: 2695,
    compare_at_price_cents: null,
    category: 'Impossible',
    stock_count: 15,
    sales_count: 280,
    newest_rank: 41,
    image_set_id: 'powdered-silence',
    slug: 'powdered-silence',
    consumption_warning: nonConsumable,
    visual: visual('#55555e', '#d9d8d1', 'S', 'IMP-03'),
  },
  {
    id: 42,
    name: 'Powdered Moonlight',
    description:
      'Lunar light powder, conceptual quantity. Best stored somewhere without a ceiling.',
    price_cents: 3195,
    compare_at_price_cents: null,
    category: 'Impossible',
    stock_count: 12,
    sales_count: 295,
    newest_rank: 42,
    image_set_id: 'powdered-moonlight',
    slug: 'powdered-moonlight',
    consumption_warning: nonConsumable,
    visual: visual('#596d9d', '#d8d8e8', 'ML', 'IMP-04'),
  },
  {
    id: 43,
    name: 'Powdered Weekend',
    description: 'Two-day weekend powder, conceptual quantity. Results vary by calendar.',
    price_cents: 2895,
    compare_at_price_cents: null,
    category: 'Impossible',
    stock_count: 13,
    sales_count: 385,
    newest_rank: 43,
    image_set_id: 'powdered-weekend',
    slug: 'powdered-weekend',
    consumption_warning: nonConsumable,
    visual: visual('#dd8150', '#edbc75', 'WE', 'IMP-05'),
  },
  {
    id: 44,
    name: 'Powdered Horizon',
    description:
      'Distant horizon powder, conceptual quantity. Creates perspective without improving forecasts.',
    price_cents: 2795,
    compare_at_price_cents: 3295,
    category: 'Impossible',
    stock_count: 11,
    sales_count: 230,
    newest_rank: 44,
    image_set_id: 'powdered-horizon',
    slug: 'powdered-horizon',
    consumption_warning: nonConsumable,
    visual: visual('#b46851', '#e4b978', 'HZ', 'IMP-06'),
  },
  {
    id: 45,
    name: 'Powdered Water',
    description: 'Dehydrated water powder, conceptual quantity. Add water to continue.',
    price_cents: 1995,
    compare_at_price_cents: null,
    category: 'Impossible',
    stock_count: 64,
    sales_count: 1200,
    newest_rank: 45,
    image_set_id: 'powdered-water',
    slug: 'powdered-water',
    consumption_warning: nonConsumable,
    visual: visual('#287fa6', '#b9e2ee', 'H2O', 'IMP-07'),
  },
] as const satisfies readonly PowderProduct[];

export const POWDER_IMAGE_SET_IDS = POWDER_CATALOG.map((product) => product.image_set_id);

const NON_CONSUMABLE_CATEGORIES = new Set<PowderCategory>([
  'Household',
  'Outdoors',
  'Questionable',
  'Impossible',
]);

const assertUnique = (label: string, values: readonly (string | number)[]) => {
  if (new Set(values).size !== values.length)
    throw new Error(`Powder catalog has duplicate ${label}`);
};

/**
 * Validates canonical content. Phase 2 supplies generated manifest IDs here;
 * Phase 1 validates the stable catalog art-ID set itself.
 */
export function validatePowderCatalog(
  products: readonly PowderProduct[] = POWDER_CATALOG,
  generatedImageSetIds: readonly string[] = POWDER_IMAGE_SET_IDS,
): void {
  if (products.length !== 45)
    throw new Error(`Powder catalog expected 45 products, got ${products.length}`);
  if (new Set(products.map((product) => product.category)).size !== POWDER_CATEGORIES.length)
    throw new Error('Powder catalog category coverage is incomplete');

  for (const category of POWDER_CATEGORIES) {
    if (products.filter((product) => product.category === category).length < 5)
      throw new Error(`Powder catalog category ${category} has fewer than 5 products`);
  }

  assertUnique(
    'IDs',
    products.map((product) => product.id),
  );
  assertUnique(
    'names',
    products.map((product) => product.name),
  );
  assertUnique(
    'slugs',
    products.map((product) => product.slug),
  );
  assertUnique(
    'image-set IDs',
    products.map((product) => product.image_set_id),
  );
  assertUnique(
    'newest ranks',
    products.map((product) => product.newest_rank),
  );

  const saleProducts = products.filter((product) => product.compare_at_price_cents !== null);
  if (saleProducts.length !== 14)
    throw new Error(`Powder catalog expected 14 sale products, got ${saleProducts.length}`);

  const manifestIds = new Set(generatedImageSetIds);
  for (const product of products) {
    if (!POWDER_CATEGORIES.includes(product.category))
      throw new Error(`Powder catalog has unsupported category ${product.category}`);
    if (!Number.isInteger(product.id) || product.id < 1)
      throw new Error(`Invalid ID for ${product.slug}`);
    if (!Number.isInteger(product.price_cents) || product.price_cents < 1)
      throw new Error(`Invalid price for ${product.slug}`);
    if (!Number.isInteger(product.stock_count) || product.stock_count < 0)
      throw new Error(`Invalid stock for ${product.slug}`);
    if (!Number.isInteger(product.sales_count) || product.sales_count < 0)
      throw new Error(`Invalid sales count for ${product.slug}`);
    if (
      product.compare_at_price_cents !== null &&
      (!Number.isInteger(product.compare_at_price_cents) ||
        product.compare_at_price_cents <= product.price_cents)
    )
      throw new Error(`Invalid sale price for ${product.slug}`);
    if (
      NON_CONSUMABLE_CATEGORIES.has(product.category) &&
      product.consumption_warning !== nonConsumable
    )
      throw new Error(`Missing consumption warning for ${product.slug}`);
    if (!manifestIds.has(product.image_set_id))
      throw new Error(`Missing generated image-set ID for ${product.slug}`);
  }

  const powderedWater = products.find((product) => product.slug === 'powdered-water');
  if (
    !powderedWater ||
    powderedWater.sales_count !== Math.max(...products.map((product) => product.sales_count))
  )
    throw new Error('Powdered Water must remain catalog bestseller');
}

validatePowderCatalog();
