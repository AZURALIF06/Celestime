import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Colonne `bytea` PostgreSQL : les octets des images de la médiathèque sont
 *  stockés directement en base (aucun stockage objet externe requis). */
export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ---------------------------------------------------------------------------
// E-commerce existant (configurateur + panier)
// ---------------------------------------------------------------------------

export const cartItems = pgTable("cart_items", {
  id: text("id").primaryKey(),
  cartId: text("cart_id").notNull(),
  config: jsonb("config").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customer: jsonb("customer").notNull(),
  items: jsonb("items").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  couponCode: text("coupon_code"),
  shipping: integer("shipping").notNull(),
  htCents: integer("ht_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("en_attente"),
  paymentStatus: text("payment_status").notNull().default("demo"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Administration & CMS
// ---------------------------------------------------------------------------

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  draft: jsonb("draft").notNull(),
  published: jsonb("published"),
  seo: jsonb("seo").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageVersions = pgTable("page_versions", {
  id: serial("id").primaryKey(),
  pageId: text("page_id").notNull(),
  label: text("label").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageTemplates = pgTable("page_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const collectionItems = pgTable("collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull(),
  productId: text("product_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Catalogue produits (admin + public)
// ---------------------------------------------------------------------------

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull().default(""),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  categoryId: integer("category_id"),
  reference: text("reference").notNull().default(""),
  weight: text("weight").notNull().default(""),
  dims: text("dims").notNull().default(""),
  taxRate: integer("tax_rate").notNull().default(2000), // pour mille
  oldPrice: integer("old_price"), // centimes, affiché barré
  onPromo: boolean("on_promo").notNull().default(false),
  images: jsonb("images").notNull().default([]),
  status: text("status").notNull().default("active"), // active | draft | archived
  kind: text("kind").notNull().default("static"), // starmap (configurateur) | static
  engine: jsonb("engine"), // définition configurateur (formats, formes, fonds, prix)
  box: jsonb("box").notNull().default([]),
  seo: jsonb("seo").notNull().default({}),
  rating: integer("rating").notNull().default(5),
  reviewsCount: integer("reviews_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  oldPriceCents: integer("old_price_cents"),
  stock: integer("stock").notNull().default(100),
  reserved: integer("reserved").notNull().default(0),
  sold: integer("sold").notNull().default(0),
  oversell: boolean("oversell").notNull().default(false),
  reference: text("reference").notNull().default(""),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Contenu
// ---------------------------------------------------------------------------

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // URL de lecture stable : /api/media/<id> pour les images en base,
  // ou /images/… et /media/… pour les fichiers historiques du dépôt.
  path: text("path").notNull().unique(),
  // Historique : ancienne URL Vercel Blob des lignes créées avant le passage en base.
  // Conservée en lecture seule pour ne casser aucune image déjà référencée.
  url: text("url"),
  size: integer("size").notNull().default(0),
  kind: text("kind").notNull().default("image"),
  mimeType: text("mime_type"),
  width: integer("width"),
  height: integer("height"),
  storage: text("storage").notNull().default("db"), // db | local | external | blob (historique)
  // Octets de l'image. Nullable : absents pour les fichiers servis depuis /public
  // et pour les lignes historiques.
  data: bytea("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  cover: text("cover"),
  status: text("status").notNull().default("draft"), // draft | published | scheduled
  publishedAt: timestamp("published_at", { withTimezone: true }),
  author: text("author").notNull().default("Célestime"),
  tags: jsonb("tags").notNull().default([]),
  seo: jsonb("seo").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("pct"), // pct | fixed
  value: integer("value").notNull(), // % (10 = 10 %) ou centimes
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  minAmount: integer("min_amount").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(0), // 0 = illimité
  usedCount: integer("used_count").notNull().default(0),
  productSlugs: jsonb("product_slugs").notNull().default([]),
  categorySlugs: jsonb("category_slugs").notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shippingZones = pgTable("shipping_zones", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // fr | eu | intl
  label: text("label").notNull(),
  costCents: integer("cost_cents").notNull().default(0),
  freeFromCents: integer("free_from_cents").notNull().default(0), // 0 = toujours payante
  delay: text("delay").notNull().default("3 à 5 jours ouvrés"),
});

export const taxRates = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  ratePerThousand: integer("rate_per_thousand").notNull().default(2000),
  zone: text("zone").notNull().default("fr"),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const newsletterSubs = pgTable("newsletter_subs", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stripeTransactions = pgTable("stripe_transactions", {
  id: text("id").primaryKey(),
  orderId: text("order_id"),
  sessionOrIntentId: text("session_or_intent_id").notNull().default(""),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("succeeded"), // succeeded | failed | refunded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

/**
 * Phase 3C — soumissions des formulaires CMS.
 * Les valeurs sont stockées telles que normalisées par `validateCmsFormSubmission`
 * (texte brut, aucun HTML). Aucune adresse de destinataire ni secret n'est
 * stocké : la configuration de traitement reste côté serveur.
 */
export const cmsFormSubmissions = pgTable("cms_form_submissions", {
  id: serial("id").primaryKey(),
  pageSlug: text("page_slug").notNull(),
  elementId: text("element_id").notNull(),
  formName: text("form_name").notNull().default(""),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  subject: text("subject").notNull().default(""),
  message: text("message").notNull().default(""),
  // Adresse IP hachée au format hexadécimal : sert à la limitation de débit et
  // n'est jamais réinjectée dans une page.
  ipHash: text("ip_hash").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  status: text("status").notNull().default("received"), // received | notified
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull().default("system"),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
