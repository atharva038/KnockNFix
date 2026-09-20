/**
 * KnockNFix Demo Data Seeding Script
 * 
 * Populates:
 * 1. Rich Service Categories with high quality images
 * 2. Multi-tier Services per Category with realistic pricing and details
 * 3. Demo Customers in Nanded and Latur
 * 4. 10 Verified Service Providers in Nanded & Latur with sequential mobile numbers:
 *    - 9800000001 to 9800000005 in Nanded
 *    - 9800000006 to 9800000010 in Latur
 * 5. Realistic Bookings for each provider (Pending, Confirmed/Accepted, In Progress, Completed with feedback)
 * 6. Completed Payment and Payout records for accurate financial analytics
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("../models/category");
const Service = require("../models/Service");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");

const CATEGORIES_DATA = [
  {
    name: "Plumbing",
    description: "Expert plumbing services for leak repairs, bathroom fittings, pipe installations and drainage solutions.",
    img: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "Tap & Pipe Leak Repair",
        description: "Quick diagnosis and fix for dripping faucets, leaking pipes, valves, and joint sealings.",
        price: 199,
        duration: 45,
        ratings: 4.8,
        reviews: 42,
        img: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&auto=format&fit=crop&q=80",
        tags: ["plumbing", "tap", "leak", "pipe", "repair"],
      },
      {
        name: "Toilet Repair & Installation",
        description: "Western and Indian commode repair, flush tank valve fix, seat cover replacement, and new installations.",
        price: 399,
        duration: 60,
        ratings: 4.9,
        reviews: 35,
        img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80",
        tags: ["toilet", "flush", "commode", "bathroom", "sanitary"],
      },
      {
        name: "Water Tank Cleaning",
        description: "Deep mechanized scrubbing, UV disinfection, and sludge removal for overhead and underground tanks.",
        price: 799,
        duration: 90,
        ratings: 4.7,
        reviews: 28,
        img: "https://images.unsplash.com/photo-1542013936693-884638332954?w=800&auto=format&fit=crop&q=80",
        tags: ["water tank", "tank cleaning", "hygiene", "filtration"],
      },
      {
        name: "Basin & Sink Unclogging",
        description: "Professional rotary snake and high-pressure chemical unblocking for jammed kitchen sinks and washbasins.",
        price: 249,
        duration: 40,
        ratings: 4.8,
        reviews: 50,
        img: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=800&auto=format&fit=crop&q=80",
        tags: ["sink", "drainage", "clogged", "basin", "blockage"],
      },
      {
        name: "Complete Bathroom Fitting",
        description: "End-to-end installation of showers, diverters, bib cocks, towel rails, geyser inlets, and sanitary accessories.",
        price: 1499,
        duration: 180,
        ratings: 4.9,
        reviews: 19,
        img: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&auto=format&fit=crop&q=80",
        tags: ["bathroom fitting", "shower", "geyser", "sanitary installation"],
      },
    ],
  },
  {
    name: "Electricians",
    description: "Certified electricians for home wiring, fan installation, switchboard repairs, and lighting setups.",
    img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "Fan Installation & Repair",
        description: "Ceiling and exhaust fan installation, winding inspection, capacitor replacement, and speed regulator fix.",
        price: 249,
        duration: 45,
        ratings: 4.8,
        reviews: 56,
        img: "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&auto=format&fit=crop&q=80",
        tags: ["fan", "ceiling fan", "exhaust fan", "regulator"],
      },
      {
        name: "Switchboard & Socket Repair",
        description: "Fix burnt sockets, loose switch wiring, modular board fitting, and short-circuit prevention.",
        price: 199,
        duration: 30,
        ratings: 4.9,
        reviews: 64,
        img: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
        tags: ["switchboard", "socket", "switches", "wiring"],
      },
      {
        name: "Light Fitting & Chandelier",
        description: "Installation of LED panel lights, ceiling spotlights, profile lights, and designer chandeliers.",
        price: 149,
        duration: 30,
        ratings: 4.7,
        reviews: 38,
        img: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80",
        tags: ["lighting", "chandelier", "led", "ceiling lights"],
      },
      {
        name: "MCB & Fuse Box Replacement",
        description: "Main distribution board upgrade, single/triple-pole MCB replacement, and RCCB earth leakage protection.",
        price: 499,
        duration: 60,
        ratings: 4.9,
        reviews: 29,
        img: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800&auto=format&fit=crop&q=80",
        tags: ["mcb", "fuse", "distribution board", "rccb", "safety"],
      },
      {
        name: "Full Home Electrical Inspection",
        description: "Comprehensive safety audit of household earthing, voltage surges, load balancing, and insulation health.",
        price: 899,
        duration: 120,
        ratings: 4.9,
        reviews: 21,
        img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&auto=format&fit=crop&q=80",
        tags: ["safety inspection", "earthing", "electrical audit", "wiring"],
      },
    ],
  },
  {
    name: "AC & Appliance Repair",
    description: "Professional servicing, deep jet cleaning, gas charging and repair for ACs, fridges, and washing machines.",
    img: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "AC Jet Servicing & Cleaning",
        description: "Power jet foam wash for indoor filters, cooling coils, blower fans, and outdoor condenser cleaning.",
        price: 599,
        duration: 60,
        ratings: 4.9,
        reviews: 78,
        img: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&auto=format&fit=crop&q=80",
        tags: ["ac service", "jet cleaning", "air conditioner", "cooling"],
      },
      {
        name: "AC Gas Refill & Leak Fix",
        description: "Nitrogen pressure testing, brazing copper tube leaks, vacuuming, and pure R32/R410A gas top-up.",
        price: 1899,
        duration: 90,
        ratings: 4.8,
        reviews: 45,
        img: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80",
        tags: ["ac gas", "gas refill", "cooling issue", "leak fix"],
      },
      {
        name: "Refrigerator Repair & Cooling Fix",
        description: "Diagnosis for frost buildup, compressor relay failure, thermostat issues, and gas charging.",
        price: 449,
        duration: 45,
        ratings: 4.7,
        reviews: 33,
        img: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&auto=format&fit=crop&q=80",
        tags: ["fridge", "refrigerator", "cooling", "compressor"],
      },
      {
        name: "Washing Machine Repair",
        description: "Fix drum rotation errors, drainage motor failure, water inlet solenoid valves, and PCB motherboards.",
        price: 499,
        duration: 60,
        ratings: 4.8,
        reviews: 41,
        img: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&auto=format&fit=crop&q=80",
        tags: ["washing machine", "drainage", "drum repair", "motor"],
      },
    ],
  },
  {
    name: "Carpentry & Furniture",
    description: "Skilled carpenters for furniture assembly, modular kitchen fixes, locks, doors, and custom woodwork.",
    img: "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "Furniture Assembly & Repair",
        description: "Assembly of beds, wardrobes, study tables, TV units, and reinforcement of creaky wooden furniture.",
        price: 399,
        duration: 60,
        ratings: 4.8,
        reviews: 39,
        img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80",
        tags: ["carpentry", "furniture assembly", "bed", "table", "wardrobe"],
      },
      {
        name: "Door Lock & Handle Fitting",
        description: "Precision installation of main door mortise locks, cylinder locks, handles, tower bolts, and latches.",
        price: 249,
        duration: 45,
        ratings: 4.9,
        reviews: 52,
        img: "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&auto=format&fit=crop&q=80",
        tags: ["door lock", "latch", "handle", "mortise lock", "security"],
      },
      {
        name: "Modular Kitchen Hinge & Drawer Fix",
        description: "Hydraulic soft-close hinge alignment, drawer channel replacement, and cabinet shutter repairs.",
        price: 499,
        duration: 60,
        ratings: 4.8,
        reviews: 30,
        img: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80",
        tags: ["kitchen", "modular kitchen", "hinges", "drawer", "shutter"],
      },
      {
        name: "Custom Wooden Shelf & Partitions",
        description: "Custom carpentry for wall-mounted bookshelf units, shoe racks, and decorative wooden paneling.",
        price: 799,
        duration: 120,
        ratings: 4.9,
        reviews: 24,
        img: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&auto=format&fit=crop&q=80",
        tags: ["custom shelf", "woodwork", "partition", "storage"],
      },
    ],
  },
  {
    name: "Home Cleaning & Pest Control",
    description: "Deep house cleaning, bathroom & kitchen sanitation, and eco-friendly pest control treatments.",
    img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "Full Home Deep Cleaning",
        description: "Intense machine scrubbing of floors, balcony washing, glass facade wiping, and full room dusting.",
        price: 2499,
        duration: 240,
        ratings: 4.9,
        reviews: 82,
        img: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&auto=format&fit=crop&q=80",
        tags: ["deep cleaning", "full home", "floor scrubbing", "house cleaning"],
      },
      {
        name: "Kitchen Deep Cleaning",
        description: "Heavy degreasing of chimney filters, cooktops, tiles, exhaust fans, and kitchen cabinet interiors.",
        price: 899,
        duration: 120,
        ratings: 4.8,
        reviews: 47,
        img: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=800&auto=format&fit=crop&q=80",
        tags: ["kitchen cleaning", "degreasing", "chimney", "oil stains"],
      },
      {
        name: "Bathroom Deep Cleaning",
        description: "Removal of hard water scale, grout dirt removal, commode descaling, and tile stain sanitization.",
        price: 499,
        duration: 60,
        ratings: 4.8,
        reviews: 65,
        img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80",
        tags: ["bathroom cleaning", "tile descaling", "sanitization"],
      },
      {
        name: "Cockroach & General Pest Control",
        description: "Odorless herbal gel baiting and spray treatment for cockroaches, ants, spiders, and silverfish.",
        price: 799,
        duration: 90,
        ratings: 4.9,
        reviews: 58,
        img: "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&auto=format&fit=crop&q=80",
        tags: ["pest control", "cockroach", "herbal pest control", "disinfection"],
      },
    ],
  },
  {
    name: "Painting & Waterproofing",
    description: "Interior & exterior wall painting, waterproof crack filing, terrace coating, and dampness protection.",
    img: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop&q=80",
    services: [
      {
        name: "Wall Crack & Seepage Treatment",
        description: "Polymer-modified mortar filing, anti-efflorescence sealant, and waterproof putty application.",
        price: 1299,
        duration: 120,
        ratings: 4.8,
        reviews: 26,
        img: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop&q=80",
        tags: ["seepage", "waterproofing", "crack repair", "dampness"],
      },
      {
        name: "Room Wall Painting (Single Room)",
        description: "2 coats of premium washable emulsion paint, putty sanding, roller finish, and masked clean edges.",
        price: 2999,
        duration: 360,
        ratings: 4.9,
        reviews: 31,
        img: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop&q=80",
        tags: ["painting", "room painting", "emulsion", "interior"],
      },
    ],
  },
];

const DEMO_CUSTOMERS = [
  {
    name: "Rahul Verma",
    phone: "9700000001",
    email: "rahul.verma@example.com",
    city: "Nanded",
    street: "Flat 402, Sai Residency, Anand Nagar",
    pincode: "431601",
    coordinates: { latitude: 19.1415, longitude: 77.3180 },
    profileImage: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "Priya Deshpande",
    phone: "9700000002",
    email: "priya.deshpande@example.com",
    city: "Nanded",
    street: "Plot 18, Bhagya Nagar, Near Station",
    pincode: "431605",
    coordinates: { latitude: 19.1480, longitude: 77.3090 },
    profileImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "Amit Shinde",
    phone: "9700000003",
    email: "amit.shinde@example.com",
    city: "Latur",
    street: "12/A, Shivaji Chowk, Main Market",
    pincode: "413512",
    coordinates: { latitude: 18.4040, longitude: 76.5650 },
    profileImage: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "Sneha Kulkarni",
    phone: "9700000004",
    email: "sneha.kulkarni@example.com",
    city: "Latur",
    street: "B-201, Dayanand Nagar, Ring Road",
    pincode: "413531",
    coordinates: { latitude: 18.4120, longitude: 76.5580 },
    profileImage: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
  },
  {
    name: "Rohan Joshi",
    phone: "9700000005",
    email: "rohan.joshi@example.com",
    city: "Nanded",
    street: "C-14, CIDCO Colony, New Nanded",
    pincode: "431603",
    coordinates: { latitude: 19.1620, longitude: 77.3310 },
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  },
];

const DEMO_PROVIDERS = [
  // NANDED PROVIDERS (9800000001 - 9800000005)
  {
    name: "Ramesh Sharma",
    phone: "9800000001",
    email: "ramesh.sharma.nanded@example.com",
    categoryName: "Plumbing",
    experienceYears: 6,
    city: "Nanded",
    street: "Shop 4, Anand Nagar Road, Near ITI",
    pincode: "431601",
    coordinates: { latitude: 19.1383, longitude: 77.3210 },
    profileImage: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000001",
    pan: "ABCDE0001F",
  },
  {
    name: "Sachin Kulkarni",
    phone: "9800000002",
    email: "sachin.kulkarni.nanded@example.com",
    categoryName: "Electricians",
    experienceYears: 8,
    city: "Nanded",
    street: "Vazirabad Main Road, Opposite City Center",
    pincode: "431601",
    coordinates: { latitude: 19.1450, longitude: 77.3150 },
    profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000002",
    pan: "ABCDE0002F",
  },
  {
    name: "Sunil Shinde",
    phone: "9800000003",
    email: "sunil.shinde.nanded@example.com",
    categoryName: "AC & Appliance Repair",
    experienceYears: 5,
    city: "Nanded",
    street: "Plot 45, Bhagya Nagar, Station Area",
    pincode: "431605",
    coordinates: { latitude: 19.1510, longitude: 77.3080 },
    profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000003",
    pan: "ABCDE0003F",
  },
  {
    name: "Vikram Patil",
    phone: "9800000004",
    email: "vikram.patil.nanded@example.com",
    categoryName: "Carpentry & Furniture",
    experienceYears: 9,
    city: "Nanded",
    street: "Workshop Corner, Old Mondha, Nanded",
    pincode: "431602",
    coordinates: { latitude: 19.1400, longitude: 77.3290 },
    profileImage: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000004",
    pan: "ABCDE0004F",
  },
  {
    name: "Ganesh Jadhav",
    phone: "9800000005",
    email: "ganesh.jadhav.nanded@example.com",
    categoryName: "Home Cleaning & Pest Control",
    experienceYears: 4,
    city: "Nanded",
    street: "VIP Road, Near Sneha Nagar Garden",
    pincode: "431602",
    coordinates: { latitude: 19.1550, longitude: 77.3200 },
    profileImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000005",
    pan: "ABCDE0005F",
  },

  // LATUR PROVIDERS (9800000006 - 9800000010)
  {
    name: "Ajay Deshmukh",
    phone: "9800000006",
    email: "ajay.deshmukh.latur@example.com",
    categoryName: "Plumbing",
    experienceYears: 7,
    city: "Latur",
    street: "Near Ausa Road Signal, Latur",
    pincode: "413512",
    coordinates: { latitude: 18.4088, longitude: 76.5604 },
    profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000006",
    pan: "ABCDE0006F",
  },
  {
    name: "Prakash Gaikwad",
    phone: "9800000007",
    email: "prakash.gaikwad.latur@example.com",
    categoryName: "Electricians",
    experienceYears: 6,
    city: "Latur",
    street: "Dayanand College Road, Mitra Nagar, Latur",
    pincode: "413512",
    coordinates: { latitude: 18.4150, longitude: 76.5700 },
    profileImage: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000007",
    pan: "ABCDE0007F",
  },
  {
    name: "Rahul More",
    phone: "9800000008",
    email: "rahul.more.latur@example.com",
    categoryName: "AC & Appliance Repair",
    experienceYears: 5,
    city: "Latur",
    street: "Old Ausa Road, Near Chhatrapati Shivaji Statue, Latur",
    pincode: "413512",
    coordinates: { latitude: 18.4020, longitude: 76.5550 },
    profileImage: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000008",
    pan: "ABCDE0008F",
  },
  {
    name: "Nitin Kadam",
    phone: "9800000009",
    email: "nitin.kadam.latur@example.com",
    categoryName: "Carpentry & Furniture",
    experienceYears: 8,
    city: "Latur",
    street: "Basweshwar Chowk, Signal Camp, Latur",
    pincode: "413531",
    coordinates: { latitude: 18.4200, longitude: 76.5800 },
    profileImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000009",
    pan: "ABCDE0009F",
  },
  {
    name: "Sanjay Pawar",
    phone: "9800000010",
    email: "sanjay.pawar.latur@example.com",
    categoryName: "Painting & Waterproofing",
    experienceYears: 10,
    city: "Latur",
    street: "MIDC Industrial Area, Main Road, Latur",
    pincode: "413531",
    coordinates: { latitude: 18.3950, longitude: 76.5500 },
    profileImage: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&auto=format&fit=crop&q=80",
    aadhar: "980000000010",
    pan: "ABCDE0010F",
  },
];

function buildDefaultAvailability() {
  const schedule = {};
  ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((day) => {
    schedule[day] = {
      isAvailable: true,
      slots: [
        { startTime: "08:00", endTime: "13:00", isActive: true },
        { startTime: "14:00", endTime: "20:00", isActive: true },
      ],
    };
  });
  return schedule;
}

async function seedData() {
  try {
    console.log("🚀 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully.");

    // 1. Seed Categories & Services
    console.log("\n📦 Seeding Categories and Services...");
    const categoryMap = new Map();
    const serviceMap = new Map(); // categoryName -> array of service documents

    for (const catData of CATEGORIES_DATA) {
      let category = await Category.findOne({ name: catData.name });
      if (!category) {
        category = new Category({
          name: catData.name,
          description: catData.description,
          img: catData.img,
          isActive: true,
        });
        await category.save();
        console.log(`   + Created Category: ${catData.name}`);
      } else {
        category.description = catData.description;
        category.img = catData.img;
        category.isActive = true;
        await category.save();
        console.log(`   ~ Updated Category: ${catData.name}`);
      }
      categoryMap.set(catData.name, category);

      // Seed Services under this category
      const seededServices = [];
      for (const servData of catData.services) {
        let service = await Service.findOne({ name: servData.name });
        if (!service) {
          service = new Service({
            name: servData.name,
            description: servData.description,
            price: servData.price,
            duration: servData.duration,
            ratings: servData.ratings,
            reviews: servData.reviews,
            img: servData.img,
            category: category._id,
            tags: servData.tags,
            isActive: true,
            providers: [],
          });
          await service.save();
          console.log(`     * Created Service: ${servData.name} (₹${servData.price})`);
        } else {
          service.description = servData.description;
          service.price = servData.price;
          service.duration = servData.duration;
          service.ratings = servData.ratings;
          service.reviews = servData.reviews;
          service.img = servData.img;
          service.category = category._id;
          service.tags = servData.tags;
          service.isActive = true;
          await service.save();
          console.log(`     ~ Updated Service: ${servData.name}`);
        }
        seededServices.push(service);
      }
      serviceMap.set(catData.name, seededServices);
    }

    // 2. Seed Demo Customers
    console.log("\n👥 Seeding Demo Customers...");
    const customerDocs = [];
    for (const custData of DEMO_CUSTOMERS) {
      let customerUser = await User.findOne({ phone: custData.phone });
      if (!customerUser) {
        customerUser = new User({
          username: custData.phone,
          name: custData.name,
          phone: custData.phone,
          email: custData.email,
          role: "customer",
          status: "active",
          isPhoneVerified: true,
          isEmailVerified: true,
          profileImage: custData.profileImage,
          addresses: [
            {
              street: custData.street,
              city: custData.city,
              state: "Maharashtra",
              pincode: custData.pincode,
              coordinates: custData.coordinates,
              isDefault: true,
              label: "Home",
            },
          ],
          currentLocation: {
            latitude: custData.coordinates.latitude,
            longitude: custData.coordinates.longitude,
            lastUpdated: new Date(),
          },
        });
        await customerUser.save();
        console.log(`   + Created Customer: ${custData.name} (${custData.phone}) - ${custData.city}`);
      } else {
        customerUser.username = custData.phone;
        customerUser.name = custData.name;
        customerUser.role = "customer";
        customerUser.status = "active";
        customerUser.isPhoneVerified = true;
        customerUser.isEmailVerified = true;
        customerUser.profileImage = custData.profileImage;
        await customerUser.save();
        console.log(`   ~ Updated Customer: ${custData.name} (${custData.phone})`);
      }
      customerDocs.push(customerUser);
    }

    // 3. Seed Verified Providers
    console.log("\n🛠️  Seeding Verified Providers with Sequential Mobile Numbers...");
    const providerDocs = []; // array of { user, serviceProvider, services }

    for (const provData of DEMO_PROVIDERS) {
      // 3a. User Model
      let user = await User.findOne({ phone: provData.phone });
      if (!user) {
        user = new User({
          username: provData.phone,
          name: provData.name,
          phone: provData.phone,
          email: provData.email,
          role: "provider",
          status: "active",
          isPhoneVerified: true,
          isEmailVerified: true,
          profileImage: provData.profileImage,
          addresses: [
            {
              street: provData.street,
              city: provData.city,
              state: "Maharashtra",
              pincode: provData.pincode,
              coordinates: provData.coordinates,
              isDefault: true,
              label: "Business Address",
            },
          ],
          currentLocation: {
            latitude: provData.coordinates.latitude,
            longitude: provData.coordinates.longitude,
            lastUpdated: new Date(),
          },
        });
        await user.save();
        console.log(`   + Created Provider User: ${provData.name} (${provData.phone})`);
      } else {
        user.username = provData.phone;
        user.name = provData.name;
        user.role = "provider";
        user.status = "active";
        user.isPhoneVerified = true;
        user.isEmailVerified = true;
        user.profileImage = provData.profileImage;
        await user.save();
        console.log(`   ~ Updated Provider User: ${provData.name} (${provData.phone})`);
      }

      // 3b. Find Category and Services for this Provider
      const category = categoryMap.get(provData.categoryName) || categoryMap.get("Plumbing");
      const categoryServices = serviceMap.get(provData.categoryName) || [];

      const servicesOffered = [
        {
          category: category._id,
          services: categoryServices.map((srv) => ({
            service: srv._id,
            customCost: srv.price,
            experience: `${provData.experienceYears} years`,
          })),
        },
      ];

      // 3c. ServiceProvider Model
      let serviceProvider = await ServiceProvider.findOne({ user: user._id });
      if (!serviceProvider) {
        serviceProvider = new ServiceProvider({
          user: user._id,
          aadharCard: provData.aadhar,
          panCard: provData.pan,
          aadharImage: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=500&q=80",
          panImage: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&q=80",
          verificationStatus: "approved",
          adminVerification: {
            documentsApproved: true,
            verifiedAt: new Date(),
            verificationNotes: "Approved verified demo service provider",
          },
          canRegisterServices: true,
          dashboardAccess: true,
          canReceiveBookings: true,
          canAccessPayouts: true,
          documentVerification: {
            aadharVerified: true,
            panVerified: true,
            imagesVerified: true,
            allDocumentsVerified: true,
            verificationDate: new Date(),
            verificationNotes: "All documents verified and active",
          },
          isVerified: true,
          businessAddress: {
            street: provData.street,
            city: provData.city,
            state: "Maharashtra",
            pincode: provData.pincode,
            coordinates: provData.coordinates,
          },
          serviceArea: {
            city: provData.city,
            state: "Maharashtra",
            radius: 25,
            pincode: provData.pincode,
          },
          serviceAreas: [
            {
              address: `${provData.city} City & Surrounding Suburbs`,
              lat: provData.coordinates.latitude,
              lng: provData.coordinates.longitude,
              radius: 25,
            },
          ],
          servicesOffered,
          experience: provData.experienceYears,
          earnings: 0,
          totalBookings: 0,
          completedBookings: 0,
          averageRating: 4.8,
          totalReviews: 15,
          availability: buildDefaultAvailability(),
          travelFeeEnabled: false,
          travelFeeAmount: 0,
          isActive: true,
          accountStatus: "active",
          bankDetails: {
            accountNumber: `91002003004000${provData.phone.slice(-2)}`,
            ifscCode: "HDFC0001844",
            accountHolderName: provData.name,
            bankName: "HDFC Bank",
            verified: true,
          },
        });
        await serviceProvider.save();
        console.log(`   + Created ServiceProvider Profile: ${provData.name} in ${provData.city}`);
      } else {
        serviceProvider.aadharCard = provData.aadhar;
        serviceProvider.panCard = provData.pan;
        serviceProvider.verificationStatus = "approved";
        serviceProvider.dashboardAccess = true;
        serviceProvider.canRegisterServices = true;
        serviceProvider.canReceiveBookings = true;
        serviceProvider.canAccessPayouts = true;
        serviceProvider.isVerified = true;
        serviceProvider.servicesOffered = servicesOffered;
        serviceProvider.businessAddress = {
          street: provData.street,
          city: provData.city,
          state: "Maharashtra",
          pincode: provData.pincode,
          coordinates: provData.coordinates,
        };
        serviceProvider.serviceArea = {
          city: provData.city,
          state: "Maharashtra",
          radius: 25,
          pincode: provData.pincode,
        };
        serviceProvider.availability = buildDefaultAvailability();
        serviceProvider.bankDetails = {
          accountNumber: `91002003004000${provData.phone.slice(-2)}`,
          ifscCode: "HDFC0001844",
          accountHolderName: provData.name,
          bankName: "HDFC Bank",
          verified: true,
        };
        await serviceProvider.save();
        console.log(`   ~ Updated ServiceProvider Profile: ${provData.name}`);
      }

      // Link provider to Service documents
      for (const srv of categoryServices) {
        if (!srv.providers.some((pId) => pId.toString() === serviceProvider._id.toString())) {
          srv.providers.push(serviceProvider._id);
          await srv.save();
        }
      }

      providerDocs.push({
        user,
        serviceProvider,
        services: categoryServices,
        city: provData.city,
      });
    }

    // 4. Seed Orders / Bookings for each Provider
    console.log("\n📋 Seeding Orders / Bookings for each Provider...");
    
    // Clear previous demo bookings for clean state
    const providerUserIds = providerDocs.map((p) => p.user._id);
    const providerSpIds = providerDocs.map((p) => p.serviceProvider._id);
    await Booking.deleteMany({ provider: { $in: providerSpIds } });
    await Payment.deleteMany({ 'splitDetails.providerId': { $in: providerSpIds } });

    let totalOrdersSeeded = 0;

    for (const p of providerDocs) {
      const sp = p.serviceProvider;
      const user = p.user;
      const services = p.services;
      const cityCustomers = customerDocs.filter((c) => c.addresses[0]?.city === p.city);
      const customersToUse = cityCustomers.length > 0 ? cityCustomers : customerDocs;

      if (services.length === 0) continue;

      const serviceA = services[0];
      const serviceB = services[1] || services[0];
      const serviceC = services[2] || services[0];

      const customer1 = customersToUse[0 % customersToUse.length];
      const customer2 = customersToUse[1 % customersToUse.length];
      const customer3 = customersToUse[2 % customersToUse.length];
      const customer4 = customersToUse[3 % customersToUse.length] || customer1;

      // 4a. Order 1: PENDING (New incoming request)
      const bookingPending = new Booking({
        customer: customer1._id,
        providerUserId: user._id,
        service: serviceA._id,
        provider: sp._id,
        address: `${customer1.addresses[0]?.street || 'Main Street'}, ${p.city}, Maharashtra`,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "pending",
        location: {
          type: "Point",
          coordinates: [customer1.addresses[0]?.coordinates?.longitude || 77.32, customer1.addresses[0]?.coordinates?.latitude || 19.14],
        },
        notes: "Please arrive after 10 AM. Tap is dripping continuously in master bathroom.",
        totalCost: serviceA.price,
        cost: serviceA.price,
        providerConfirmation: {
          status: "pending",
        },
        advancePayment: {
          amount: Math.round(serviceA.price * 0.2),
          paid: true,
          date: new Date(),
          orderId: `order_adv_${Date.now()}_1`,
          paymentId: `pay_adv_${Date.now()}_1`,
        },
        paymentStatus: "partially_paid",
        commission: Math.round(serviceA.price * 0.1),
        automationStatus: {
          depositProcessed: true,
          splitConfigured: false,
          providerPayoutScheduled: false,
          automationCompleted: false,
        },
      });
      await bookingPending.save();

      // 4b. Order 2: CONFIRMED / ACCEPTED (Upcoming scheduled job)
      const bookingConfirmed = new Booking({
        customer: customer2._id,
        providerUserId: user._id,
        service: serviceB._id,
        provider: sp._id,
        address: `${customer2.addresses[0]?.street || 'Station Road'}, ${p.city}, Maharashtra`,
        date: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
        bookingDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: "confirmed",
        location: {
          type: "Point",
          coordinates: [customer2.addresses[0]?.coordinates?.longitude || 77.32, customer2.addresses[0]?.coordinates?.latitude || 19.14],
        },
        notes: "Confirmed slot for full servicing. Customer requested morning appointment.",
        totalCost: serviceB.price,
        cost: serviceB.price,
        providerConfirmation: {
          status: "accepted",
          confirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
        advancePayment: {
          amount: Math.round(serviceB.price * 0.2),
          paid: true,
          date: new Date(Date.now() - 2 * 60 * 60 * 1000),
          orderId: `order_adv_${Date.now()}_2`,
          paymentId: `pay_adv_${Date.now()}_2`,
        },
        paymentStatus: "partially_paid",
        commission: Math.round(serviceB.price * 0.1),
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: false,
          automationCompleted: false,
        },
      });
      await bookingConfirmed.save();

      // 4c. Order 3: IN PROGRESS (Currently under execution)
      const bookingInProgress = new Booking({
        customer: customer3._id,
        providerUserId: user._id,
        service: serviceC._id,
        provider: sp._id,
        address: `${customer3.addresses[0]?.street || 'Market Yard'}, ${p.city}, Maharashtra`,
        date: new Date(),
        bookingDate: new Date(),
        status: "in_progress",
        location: {
          type: "Point",
          coordinates: [customer3.addresses[0]?.coordinates?.longitude || 77.32, customer3.addresses[0]?.coordinates?.latitude || 19.14],
        },
        notes: "Work started. Technician has arrived on location with standard tools.",
        totalCost: serviceC.price,
        cost: serviceC.price,
        providerConfirmation: {
          status: "accepted",
          confirmedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        advancePayment: {
          amount: Math.round(serviceC.price * 0.2),
          paid: true,
          date: new Date(Date.now() - 5 * 60 * 60 * 1000),
          orderId: `order_adv_${Date.now()}_3`,
          paymentId: `pay_adv_${Date.now()}_3`,
        },
        paymentStatus: "partially_paid",
        commission: Math.round(serviceC.price * 0.1),
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: false,
          automationCompleted: false,
        },
      });
      await bookingInProgress.save();

      // 4d. Order 4: COMPLETED with 5-Star Rating & Payout
      const completedCost1 = serviceA.price;
      const commission1 = Math.round(completedCost1 * 0.1);
      const netPayout1 = completedCost1 - commission1;

      const bookingCompleted1 = new Booking({
        customer: customer4._id,
        providerUserId: user._id,
        service: serviceA._id,
        provider: sp._id,
        address: `${customer4.addresses[0]?.street || 'Ring Road'}, ${p.city}, Maharashtra`,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        bookingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: "completed",
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
        location: {
          type: "Point",
          coordinates: [customer4.addresses[0]?.coordinates?.longitude || 77.32, customer4.addresses[0]?.coordinates?.latitude || 19.14],
        },
        notes: "Completed smoothly. Everything tested and working great.",
        totalCost: completedCost1,
        cost: completedCost1,
        providerConfirmation: {
          status: "accepted",
          confirmedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
        },
        advancePayment: {
          amount: Math.round(completedCost1 * 0.2),
          paid: true,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000),
          orderId: `order_adv_${Date.now()}_4`,
          paymentId: `pay_adv_${Date.now()}_4`,
        },
        finalPayment: {
          amount: completedCost1,
          paid: true,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
          orderId: `order_fin_${Date.now()}_4`,
          paymentId: `pay_fin_${Date.now()}_4`,
        },
        paymentStatus: "completed",
        commission: commission1,
        feedback: {
          rating: 5,
          comment: "Excellent service! Arrived right on time and fixed the issue quickly and cleanly.",
          recommend: true,
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          submittedBy: customer4._id,
        },
        providerPayout: {
          id: `payout_${Date.now()}_4`,
          status: "processed",
          amount: netPayout1,
          paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          transactionId: `TXN_${Date.now()}_4`,
        },
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: true,
          automationCompleted: true,
        },
      });
      await bookingCompleted1.save();

      // Create completed Payment record
      const payment1 = new Payment({
        booking: bookingCompleted1._id,
        razorpayOrderId: `order_rzp_${Date.now()}_4`,
        razorpayPaymentId: `pay_rzp_${Date.now()}_4`,
        amount: completedCost1,
        paymentType: "final",
        status: "completed",
        commission: commission1,
        providerAmount: netPayout1,
        splitDetails: {
          totalAmount: completedCost1,
          platformCommission: commission1,
          providerAmount: netPayout1,
          providerId: sp._id,
          autoTransferEnabled: true,
          transferStatus: "completed",
          transferDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: true,
          automationCompleted: true,
        },
      });
      await payment1.save();

      // 4e. Order 5: COMPLETED with 4.8 Rating
      const completedCost2 = serviceB.price;
      const commission2 = Math.round(completedCost2 * 0.1);
      const netPayout2 = completedCost2 - commission2;

      const bookingCompleted2 = new Booking({
        customer: customer1._id,
        providerUserId: user._id,
        service: serviceB._id,
        provider: sp._id,
        address: `${customer1.addresses[0]?.street || 'College Road'}, ${p.city}, Maharashtra`,
        date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        bookingDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        status: "completed",
        completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        location: {
          type: "Point",
          coordinates: [customer1.addresses[0]?.coordinates?.longitude || 77.32, customer1.addresses[0]?.coordinates?.latitude || 19.14],
        },
        notes: "Full job completed with high attention to detail.",
        totalCost: completedCost2,
        cost: completedCost2,
        providerConfirmation: {
          status: "accepted",
          confirmedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
        },
        advancePayment: {
          amount: Math.round(completedCost2 * 0.2),
          paid: true,
          date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 - 30 * 60 * 1000),
          orderId: `order_adv_${Date.now()}_5`,
          paymentId: `pay_adv_${Date.now()}_5`,
        },
        finalPayment: {
          amount: completedCost2,
          paid: true,
          date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
          orderId: `order_fin_${Date.now()}_5`,
          paymentId: `pay_fin_${Date.now()}_5`,
        },
        paymentStatus: "completed",
        commission: commission2,
        feedback: {
          rating: 5,
          comment: "Very polite, skilled, and professional work. Highly recommended in the city!",
          recommend: true,
          submittedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 100 * 60 * 1000),
          submittedBy: customer1._id,
        },
        providerPayout: {
          id: `payout_${Date.now()}_5`,
          status: "processed",
          amount: netPayout2,
          paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          transactionId: `TXN_${Date.now()}_5`,
        },
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: true,
          automationCompleted: true,
        },
      });
      await bookingCompleted2.save();

      const payment2 = new Payment({
        booking: bookingCompleted2._id,
        razorpayOrderId: `order_rzp_${Date.now()}_5`,
        razorpayPaymentId: `pay_rzp_${Date.now()}_5`,
        amount: completedCost2,
        paymentType: "final",
        status: "completed",
        commission: commission2,
        providerAmount: netPayout2,
        splitDetails: {
          totalAmount: completedCost2,
          platformCommission: commission2,
          providerAmount: netPayout2,
          providerId: sp._id,
          autoTransferEnabled: true,
          transferStatus: "completed",
          transferDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        automationStatus: {
          depositProcessed: true,
          splitConfigured: true,
          providerPayoutScheduled: true,
          automationCompleted: true,
        },
      });
      await payment2.save();

      // Update provider aggregated stats
      const totalEarned = netPayout1 + netPayout2;
      sp.earnings = totalEarned;
      sp.totalBookings = 5;
      sp.completedBookings = 2;
      sp.averageRating = 5.0;
      sp.totalReviews = 2;
      await sp.save();

      totalOrdersSeeded += 5;
      console.log(`   + Seeded 5 Orders for Provider: ${user.name} (${user.phone}) in ${p.city}`);
    }

    console.log("\n=======================================================");
    console.log(`🎉 Demo Data Seeding Completed Successfully!`);
    console.log(`   - Categories: ${CATEGORIES_DATA.length}`);
    console.log(`   - Providers: ${DEMO_PROVIDERS.length} (Sequential Mobile: 9800000001 - 9800000010)`);
    console.log(`   - Total Orders Seeded: ${totalOrdersSeeded}`);
    console.log("=======================================================\n");

    console.log("📱 PROVIDER LOGIN CREDENTIALS LIST:");
    DEMO_PROVIDERS.forEach((p) => {
      console.log(`   👉 Mobile: ${p.phone} | Name: ${p.name.padEnd(18)} | City: ${p.city.padEnd(8)} | Category: ${p.categoryName}`);
    });
    console.log("\n👉 In Dev Mode, simply enter any of the above 10-digit mobile numbers at /login to access their Provider Dashboard directly!\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    process.exit(1);
  }
}

seedData();
