export const mockProducts = [
  {
    id: 1,
    slug: "organic-moringa-powder",
    name: "AgrivaFoods Moringa Powder",
    tagline: "All The Goodness, Naturally.",
    category: "Superfood Powders",
    description: "Experience the remarkable benefits of AgrivaFoods Organic Moringa Powder, sourced from carefully shade-dried, pure Moringa oleifera leaves. Revered as the 'Miracle Tree', Moringa is loaded with essential plant protein, natural iron, calcium, and vital bio-active vitamins that revitalize daily stamina, enhance immune defense, and foster healthy hair and radiant skin.",
    shortDescription: "100% Pure Organic Moringa Leaf Powder. Glows Skin & Hair, Boosts Immunity, and Rich In Nutrients.",
    rating: 4.9,
    reviewCount: 124,
    badge: "Bestseller",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Store in a cool, dry place away from direct sunlight. Ensure zip-lock pouch is tightly sealed after every use.",
    usageInstructions: "Mix 1/2 to 1 teaspoon (2g - 5g) of AgrivaFoods Moringa Powder into warm water with a dash of lemon or honey. You can also easily blend it into morning smoothies, fresh green juices, curd, or sprinkle over fresh salads.",
    ingredients: ["100% Pure Organic Moringa (Moringa oleifera) Leaf Powder", "No preservatives, No added sugar, No artificial fillers"],
    benefits: [
      "Glows Skin & Hair: Packed with natural antioxidants, Vitamin E, and bio-actives",
      "Boosts Immunity: Fortifies cellular defenses with Vitamin C and iron",
      "Rich In Nutrients: Contains 90+ nutrients, 46 antioxidants, and essential plant amino acids",
      "Fights daily fatigue and supports long-lasting natural energy without crashes",
      "Supports healthy digestion and whole-body metabolic equilibrium"
    ],
    nutrition: {
      "Energy": "320 kcal",
      "Protein": "27.1 g",
      "Carbohydrates": "38.2 g",
      "Dietary Fiber": "19.2 g",
      "Fat": "2.3 g",
      "Calcium": "2003 mg",
      "Iron": "28.2 mg",
      "Vitamin A": "16.3 mg",
      "Vitamin C": "120 mg"
    },
    images: [
      "/assets/moringa-packaging.png",
      "/assets/moringa-bowl.png"
    ],
    variants: [
      {
        id: "mor-100",
        weight: "100g",
        price: 199,
        originalPrice: 199,
        stock: 65,
        sku: "AGR-MOR-100"
      }
    ]
  },
  {
    id: 2,
    slug: "beetroot-powder",
    name: "AgrivaFoods Beetroot Powder",
    tagline: "Athletic Stamina & Cardiovascular Wellness",
    category: "Superfood Powders",
    description: "AgrivaFoods Beetroot Powder is a rich, natural source of dietary nitrates, vital trace minerals, and pure betalain antioxidants. Crafted from premium dehydrated red beets, this vibrant scarlet powder naturally supports healthy nitric oxide production, enhancing athletic stamina, physical endurance, and optimal cardiovascular flow. With an earthy, mildly sweet profile, it is an ideal clean pre-workout addition.",
    shortDescription: "Pure dehydrated red beetroot powder packed with natural nitrates to power circulation and natural stamina.",
    rating: 4.8,
    reviewCount: 88,
    badge: "Pre-Workout Favorite",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Store in an airtight container in a cool, dry pantry. Natural moisture may cause slight clumping, which does not impact potency.",
    usageInstructions: "Mix 1 teaspoon (5g) in 250ml water, fresh juice, or a pre-workout drink 30 minutes before workout or brisk exercise. Also delicious blended into oatmeal, baking recipes, and savory dishes for natural color and nutrients.",
    ingredients: ["100% Pure Dehydrated Red Beetroot (Beta vulgaris) Powder", "Zero artificial colors, Zero added sugar"],
    benefits: [
      "Naturally high in dietary nitrates to support healthy blood flow & endurance",
      "Excellent natural pre-workout booster without caffeine jitters",
      "Promotes cardiovascular wellness and balanced arterial circulation",
      "Contains powerful Betalain antioxidants for cellular recovery",
      "Provides natural, clean plant energy for daily physical performance"
    ],
    nutrition: {
      "Energy": "350 kcal",
      "Protein": "11.3 g",
      "Carbohydrates": "70.1 g",
      "Natural Sugar": "55.0 g",
      "Dietary Fiber": "6.2 g",
      "Fat": "0.5 g",
      "Potassium": "1530 mg",
      "Iron": "6.1 mg",
      "Sodium": "260 mg"
    },
    images: [
      "/assets/beetroot-packaging.png"
    ],
    variants: [
      {
        id: "beet-100",
        weight: "100g",
        price: 129,
        originalPrice: 169,
        stock: 50,
        sku: "AGR-BEE-100"
      },
      {
        id: "beet-250",
        weight: "250g",
        price: 249,
        originalPrice: 299,
        stock: 80,
        sku: "AGR-BEE-250",
        isPopular: true
      },
      {
        id: "beet-500",
        weight: "500g",
        price: 449,
        originalPrice: 529,
        stock: 35,
        sku: "AGR-BEE-500"
      },
      {
        id: "beet-1kg",
        weight: "1kg",
        price: 799,
        originalPrice: 949,
        stock: 20,
        sku: "AGR-BEE-1000"
      }
    ]
  },
  {
    id: 3,
    slug: "amla-powder",
    name: "AgrivaFoods Amla Powder",
    tagline: "Natural Vitamin C & Hair Vitality Elixir",
    category: "Superfood Powders",
    description: "AgrivaFoods Amla (Indian Gooseberry) Powder is traditionally recognized as nature's highest concentrated botanical source of Vitamin C. Hand-harvested and sun-dried to lock in delicate antioxidants, it provides targeted immune defense, aids digestive enzymes, and nourishes hair follicles from within for lustrous growth and clear, revitalized skin.",
    shortDescription: "Authentic sun-dried Indian Gooseberry powder providing potent raw Vitamin C, collagen support, and hair strength.",
    rating: 4.9,
    reviewCount: 104,
    badge: "High Vitamin C",
    featured: true,
    currency: "INR",
    origin: "India",
    shelfLife: "12 Months",
    storageInstructions: "Keep tightly sealed in a dry environment away from dampness and direct sunlight. Keep seal air-tight.",
    usageInstructions: "Mix 1/2 teaspoon (2.5g) of Amla powder with lukewarm water every morning on an empty stomach. Add a spoonful of pure raw honey to soften the natural tangy astringency. Can also be applied as an herbal hair or facial mask.",
    ingredients: ["100% Pure Sun-Dried Amla (Phyllanthus emblica) Fruit Powder", "Raw, Unadulterated, Chemical-Free"],
    benefits: [
      "One of nature's richest whole-food sources of natural Vitamin C",
      "Strengthens hair roots, curbs excessive hair fall, and restores shine",
      "Significantly boosts biological iron absorption from everyday meals",
      "Helps regulate stomach acid and supports comfortable gut digestion",
      "Promotes collagen synthesis for firm, youthful skin elasticity"
    ],
    nutrition: {
      "Energy": "298 kcal",
      "Protein": "1.2 g",
      "Carbohydrates": "68.9 g",
      "Dietary Fiber": "22.5 g",
      "Fat": "0.4 g",
      "Vitamin C": "600 mg",
      "Calcium": "50 mg",
      "Iron": "1.2 mg"
    },
    images: [
      "/assets/amla-packaging.png"
    ],
    variants: [
      {
        id: "amla-100",
        weight: "100g",
        price: 99,
        originalPrice: 139,
        stock: 75,
        sku: "AGR-AML-100"
      },
      {
        id: "amla-250",
        weight: "250g",
        price: 199,
        originalPrice: 249,
        stock: 85,
        sku: "AGR-AML-250",
        isPopular: true
      },
      {
        id: "amla-500",
        weight: "500g",
        price: 349,
        originalPrice: 429,
        stock: 40,
        sku: "AGR-AML-500"
      },
      {
        id: "amla-1kg",
        weight: "1kg",
        price: 629,
        originalPrice: 749,
        stock: 20,
        sku: "AGR-AML-1000"
      }
    ]
  }
];
