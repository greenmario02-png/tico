import { and, eq, sql } from "drizzle-orm";
import { config } from "../lib/config";
import { db, pool } from "./client";
import {
  categories,
  ingredientPriceHistory,
  ingredients,
  products,
  recipeIngredients,
  recipes,
  suppliers,
  users,
} from "./schema/index";
import { hashPassword } from "../lib/auth";

// Seed de PRODUCCIÓN (Render + Neon). Mismos datos de referencia que seed.ts
// (categorías, proveedores, ingredientes, 22 recetas, productos, imágenes),
// sin datos de prueba. Las contraseñas de los 3 usuarios DEBEN venir de
// SEED_ADMIN_PASSWORD, SEED_OPERARIO_PASSWORD y SEED_DUENO_PASSWORD (mín. 8
// caracteres); si falta alguna el script falla. Idempotente: se puede correr
// varias veces sin duplicar nada. seed.ts (desarrollo) no se toca.
// Si cambias datos en seed.ts, replica el cambio aquí.

function requirePassword(envVar: string): string {
  const v = process.env[envVar];
  if (!v || v.length < 8) {
    throw new Error(`Falta la variable ${envVar} (mínimo 8 caracteres). seed:prod no genera contraseñas.`);
  }
  return v;
}

async function seedUser(name: string, email: string, role: "admin" | "operario" | "dueño", password: string) {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, role })
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(user ? `Usuario creado: ${email} (rol: ${role})` : `Usuario ya existía, se omite: ${email}`);
}

// ---------------------------------------------------------------------------
// Categorías (01-PROJECT_SPEC.md §2.1/§2.6)
// ---------------------------------------------------------------------------

const ingredientCategoryNames = [
  "Harinas",
  "Lácteos",
  "Azúcares y Endulzantes",
  "Grasas y Aceites",
  "Levaduras y Leudantes",
  "Chocolates y Cacao",
  "Frutas y Frutos Secos",
  "Especias y Saborizantes",
  "Empaques",
  "Otros",
] as const;

const recipeCategoryNames = [
  "Panes",
  "Panes Especiales",
  "Pasteles y Tortas",
  "Galletas",
  "Postres",
  "Repostería Fina",
  "Masas Base",
] as const;

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

const seedSuppliers = [
  { name: "Molino La Paz", contactPerson: "Juan Pérez", phone: "70012345" },
  { name: "Distribuidora Santa Cruz", contactPerson: "María Gutiérrez", phone: "70123456" },
  { name: "Lácteos Cochabamba", contactPerson: "Roberto Fernández", phone: "70234567" },
  { name: "Insumos Dulces Bolivia", contactPerson: "Lucía Vargas", phone: "70345678" },
];

// ---------------------------------------------------------------------------
// Ingredientes: cubre los 3 baseUnit (g/ml/pieza) en todas las categorías.
// Precios de referencia: 01-PROJECT_SPEC.md §5 / SDD-09-TESTS.md §0.2 para
// harina, azúcar, mantequilla, huevos, leche y levadura; el resto son precios
// de mercado boliviano razonables para poblar la demo.
// ---------------------------------------------------------------------------

interface SeedIngredient {
  name: string;
  category: (typeof ingredientCategoryNames)[number];
  baseUnit: "g" | "ml" | "pieza";
  pricePerBaseUnit: string;
  currentStock: string;
  minStock: string;
  supplierIndex: number;
  /**
   * Foto de referencia (campo `imageUrl`, agregado a pedido explícito del
   * usuario — no forma parte de 01-PROJECT_SPEC.md ni de SDD-06 original).
   * Solo ~20 de los ~62 ingredientes sembrados traen foto a propósito, para
   * ejercitar también el estado "sin imagen" en la UI. Estas siguen siendo
   * hotlinks a Wikimedia Commons (`Special:FilePath`, licencias libres): el
   * usuario pidió expresamente descargar y verificar imágenes solo para
   * RECETAS (ahí importa mucho más, ver seedRecipesData/RECIPE_IMAGE_DIR);
   * para ingredientes no se justificó el esfuerzo de descargar +
   * re-verificar visualmente las ~20 ya existentes.
   */
  imageUrl?: string;
}

const WIKIMEDIA_FILE = "https://commons.wikimedia.org/wiki/Special:FilePath";

/**
 * Fotos de RECETAS: a diferencia de ingredientes, estas SÍ se descargaron
 * localmente a `public/images/recipes/` y se verificaron visualmente una
 * por una (Read/visor de imágenes) antes de referenciarlas aquí — un bug de
 * QA manual encontró que un hotlink de Wikimedia con content-type
 * `image/jpeg` válido en realidad mostraba una foto de una etiqueta de
 * empaque, no el pan que decía ser. `curl -I` (solo status/content-type) NO
 * es suficiente verificación. Se sirven vía @fastify/static desde
 * `app.ts` bajo `/images/recipes/<archivo>`.
 */
const RECIPE_IMAGE_BASE = `${config.publicBaseUrl}/images/recipes`;
function recipeImage(filename: string): string {
  return `${RECIPE_IMAGE_BASE}/${filename}`;
}

/**
 * Fotos de INGREDIENTES nuevas (Wikimedia Commons, licencias libres): se
 * descargaron a `public/images/ingredients/` y se verificó visualmente cada
 * una (Read) antes de referenciarla. Servidas por @fastify/static bajo
 * `/images/ingredients/<archivo>`.
 */
const INGREDIENT_IMAGE_BASE = `${config.publicBaseUrl}/images/ingredients`;
function ingredientImage(filename: string): string {
  return `${INGREDIENT_IMAGE_BASE}/${filename}`;
}

const seedIngredientsData: SeedIngredient[] = [
  // Harinas
  { name: "Harina de trigo", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.0135", currentStock: "50000.000", minStock: "10000.000", supplierIndex: 0, imageUrl: `${WIKIMEDIA_FILE}/All-Purpose_Flour_(4107895947).jpg?width=400` },
  { name: "Harina integral", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.016", currentStock: "15000.000", minStock: "3000.000", supplierIndex: 0, imageUrl: ingredientImage("harina-integral.jpg") },
  { name: "Maicena (almidón de maíz)", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.02", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 0, imageUrl: ingredientImage("maicena.jpg") },
  { name: "Harina de maíz", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.018", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 0, imageUrl: ingredientImage("harina-de-maiz.jpg") },
  { name: "Harina de arroz", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.022", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 0, imageUrl: ingredientImage("harina-de-arroz.jpg") },
  { name: "Sémola de trigo", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.02", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 0, imageUrl: ingredientImage("semola-de-trigo.jpg") },
  { name: "Almidón de yuca", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.025", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 0, imageUrl: ingredientImage("almidon-de-yuca.jpg") },
  { name: "Avena en hojuelas", category: "Harinas", baseUnit: "g", pricePerBaseUnit: "0.017", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 0, imageUrl: ingredientImage("avena-en-hojuelas.jpg") },
  // Lácteos
  { name: "Leche", category: "Lácteos", baseUnit: "ml", pricePerBaseUnit: "0.0035", currentStock: "20000.000", minStock: "5000.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Glass_of_milk_on_table.jpg?width=400` },
  { name: "Mantequilla", category: "Lácteos", baseUnit: "g", pricePerBaseUnit: "0.032", currentStock: "10000.000", minStock: "2000.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Block_of_butter_in_butter_dish.jpg?width=400` },
  { name: "Queso crema", category: "Lácteos", baseUnit: "g", pricePerBaseUnit: "0.045", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Philadelphia_cream_cheese_(no_flash).jpg?width=400` },
  { name: "Crema de leche", category: "Lácteos", baseUnit: "ml", pricePerBaseUnit: "0.038", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Milk_heavy_cream.jpg?width=400` },
  { name: "Leche condensada", category: "Lácteos", baseUnit: "ml", pricePerBaseUnit: "0.03", currentStock: "5000.000", minStock: "1000.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Homemade_condensed_milk.jpg?width=400` },
  { name: "Yogurt natural", category: "Lácteos", baseUnit: "ml", pricePerBaseUnit: "0.02", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 2, imageUrl: ingredientImage("yogurt-natural.jpg") },
  { name: "Crema chantilly", category: "Lácteos", baseUnit: "ml", pricePerBaseUnit: "0.04", currentStock: "5000.000", minStock: "1000.000", supplierIndex: 2, imageUrl: ingredientImage("crema-chantilly.jpg") },
  { name: "Queso mascarpone", category: "Lácteos", baseUnit: "g", pricePerBaseUnit: "0.06", currentStock: "4000.000", minStock: "800.000", supplierIndex: 2, imageUrl: ingredientImage("queso-mascarpone.jpg") },
  { name: "Mantequilla sin sal", category: "Lácteos", baseUnit: "g", pricePerBaseUnit: "0.034", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 2, imageUrl: ingredientImage("mantequilla-sin-sal.jpg") },
  { name: "Queso fresco", category: "Lácteos", baseUnit: "g", pricePerBaseUnit: "0.04", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 2, imageUrl: ingredientImage("queso-fresco.jpg") },
  // Azúcares y Endulzantes
  { name: "Azúcar blanca", category: "Azúcares y Endulzantes", baseUnit: "g", pricePerBaseUnit: "0.008", currentStock: "30000.000", minStock: "5000.000", supplierIndex: 1, imageUrl: `${WIKIMEDIA_FILE}/A_Bowl_of_Sugar_2.jpg?width=400` },
  { name: "Azúcar impalpable", category: "Azúcares y Endulzantes", baseUnit: "g", pricePerBaseUnit: "0.012", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 1, imageUrl: ingredientImage("azucar-impalpable.jpg") },
  { name: "Miel de abeja", category: "Azúcares y Endulzantes", baseUnit: "ml", pricePerBaseUnit: "0.025", currentStock: "4000.000", minStock: "800.000", supplierIndex: 1, imageUrl: `${WIKIMEDIA_FILE}/Honey_jar_(411317929).jpg?width=400` },
  { name: "Azúcar morena", category: "Azúcares y Endulzantes", baseUnit: "g", pricePerBaseUnit: "0.011", currentStock: "10000.000", minStock: "2000.000", supplierIndex: 1, imageUrl: ingredientImage("azucar-morena.jpg") },
  { name: "Panela (chancaca)", category: "Azúcares y Endulzantes", baseUnit: "g", pricePerBaseUnit: "0.015", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 1, imageUrl: ingredientImage("panela.jpg") },
  // Grasas y Aceites
  { name: "Aceite vegetal", category: "Grasas y Aceites", baseUnit: "ml", pricePerBaseUnit: "0.014", currentStock: "15000.000", minStock: "3000.000", supplierIndex: 1, imageUrl: ingredientImage("aceite-vegetal.jpg") },
  { name: "Manteca vegetal", category: "Grasas y Aceites", baseUnit: "g", pricePerBaseUnit: "0.018", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 1, imageUrl: ingredientImage("manteca-vegetal.jpg") },
  { name: "Margarina", category: "Grasas y Aceites", baseUnit: "g", pricePerBaseUnit: "0.02", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 1, imageUrl: ingredientImage("margarina.jpg") },
  { name: "Aceite de oliva", category: "Grasas y Aceites", baseUnit: "ml", pricePerBaseUnit: "0.035", currentStock: "5000.000", minStock: "1000.000", supplierIndex: 1, imageUrl: ingredientImage("aceite-de-oliva.jpg") },
  // Levaduras y Leudantes
  { name: "Levadura", category: "Levaduras y Leudantes", baseUnit: "g", pricePerBaseUnit: "0.04", currentStock: "2000.000", minStock: "500.000", supplierIndex: 0, imageUrl: `${WIKIMEDIA_FILE}/Dry_yeast.jpg?width=400` },
  { name: "Polvo de hornear", category: "Levaduras y Leudantes", baseUnit: "g", pricePerBaseUnit: "0.03", currentStock: "3000.000", minStock: "500.000", supplierIndex: 0, imageUrl: ingredientImage("polvo-de-hornear.jpg") },
  { name: "Bicarbonato de sodio", category: "Levaduras y Leudantes", baseUnit: "g", pricePerBaseUnit: "0.025", currentStock: "2000.000", minStock: "400.000", supplierIndex: 0, imageUrl: ingredientImage("bicarbonato-de-sodio.jpg") },
  { name: "Gelatina sin sabor", category: "Levaduras y Leudantes", baseUnit: "g", pricePerBaseUnit: "0.09", currentStock: "2000.000", minStock: "400.000", supplierIndex: 0, imageUrl: ingredientImage("gelatina-sin-sabor.png") },
  { name: "Cremor tártaro", category: "Levaduras y Leudantes", baseUnit: "g", pricePerBaseUnit: "0.15", currentStock: "1000.000", minStock: "200.000", supplierIndex: 0, imageUrl: ingredientImage("cremor-tartaro.jpg") },
  // Chocolates y Cacao
  { name: "Chocolate para fundir", category: "Chocolates y Cacao", baseUnit: "g", pricePerBaseUnit: "0.055", currentStock: "10000.000", minStock: "2000.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Cooking_chocolate,_whole_bar.jpg?width=400` },
  { name: "Cacao en polvo", category: "Chocolates y Cacao", baseUnit: "g", pricePerBaseUnit: "0.05", currentStock: "6000.000", minStock: "1000.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Cocoa_powder.jpg?width=400` },
  { name: "Chispas de chocolate", category: "Chocolates y Cacao", baseUnit: "g", pricePerBaseUnit: "0.06", currentStock: "5000.000", minStock: "1000.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Chocolate_chips.jpg?width=400` },
  { name: "Chocolate blanco", category: "Chocolates y Cacao", baseUnit: "g", pricePerBaseUnit: "0.065", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 3, imageUrl: ingredientImage("chocolate-blanco.jpg") },
  { name: "Cobertura de chocolate", category: "Chocolates y Cacao", baseUnit: "g", pricePerBaseUnit: "0.058", currentStock: "8000.000", minStock: "1500.000", supplierIndex: 3, imageUrl: ingredientImage("cobertura-de-chocolate.jpg") },
  // Frutas y Frutos Secos
  { name: "Frutas confitadas", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.045", currentStock: "4000.000", minStock: "800.000", supplierIndex: 3, imageUrl: ingredientImage("frutas-confitadas.jpg") },
  { name: "Nueces", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.09", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Walnuts_(from_France).jpg?width=400` },
  { name: "Pasas", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.04", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Raisins_01.jpg?width=400` },
  { name: "Pulpa de maracuyá", category: "Frutas y Frutos Secos", baseUnit: "ml", pricePerBaseUnit: "0.03", currentStock: "4000.000", minStock: "800.000", supplierIndex: 3, imageUrl: ingredientImage("pulpa-de-maracuya.jpg") },
  { name: "Coco rallado", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.05", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Shredded_Coconut_(4930532874).jpg?width=400` },
  { name: "Almendras", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.11", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: `${WIKIMEDIA_FILE}/Almonds_in_basket.jpg?width=400` },
  { name: "Avellanas", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.13", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: ingredientImage("avellanas.jpg") },
  { name: "Cerezas confitadas", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.07", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: ingredientImage("cerezas-confitadas.jpg") },
  { name: "Arándanos deshidratados", category: "Frutas y Frutos Secos", baseUnit: "g", pricePerBaseUnit: "0.095", currentStock: "3000.000", minStock: "500.000", supplierIndex: 3, imageUrl: ingredientImage("arandanos-deshidratados.jpg") },
  { name: "Plátano", category: "Frutas y Frutos Secos", baseUnit: "pieza", pricePerBaseUnit: "0.8", currentStock: "200.000", minStock: "40.000", supplierIndex: 3, imageUrl: ingredientImage("platano.jpg") },
  { name: "Manzana", category: "Frutas y Frutos Secos", baseUnit: "pieza", pricePerBaseUnit: "1.0", currentStock: "200.000", minStock: "40.000", supplierIndex: 3, imageUrl: ingredientImage("manzana.jpg") },
  { name: "Jugo de limón", category: "Frutas y Frutos Secos", baseUnit: "ml", pricePerBaseUnit: "0.02", currentStock: "4000.000", minStock: "800.000", supplierIndex: 3, imageUrl: ingredientImage("jugo-de-limon.jpg") },
  // Especias y Saborizantes
  { name: "Sal", category: "Especias y Saborizantes", baseUnit: "g", pricePerBaseUnit: "0.006", currentStock: "5000.000", minStock: "1000.000", supplierIndex: 1, imageUrl: `${WIKIMEDIA_FILE}/Salt_bowl_and_spoon.jpg?width=400` },
  { name: "Canela molida", category: "Especias y Saborizantes", baseUnit: "g", pricePerBaseUnit: "0.08", currentStock: "1000.000", minStock: "200.000", supplierIndex: 1, imageUrl: `${WIKIMEDIA_FILE}/Ground_cinnamon.jpg?width=400` },
  { name: "Vainilla líquida", category: "Especias y Saborizantes", baseUnit: "ml", pricePerBaseUnit: "0.12", currentStock: "2000.000", minStock: "400.000", supplierIndex: 1, imageUrl: `${WIKIMEDIA_FILE}/Homemade_Vanilla_Extract_(4107750384).jpg?width=400` },
  { name: "Esencia de almendra", category: "Especias y Saborizantes", baseUnit: "ml", pricePerBaseUnit: "0.15", currentStock: "1000.000", minStock: "200.000", supplierIndex: 1, imageUrl: ingredientImage("esencia-de-almendra.jpg") },
  { name: "Colorante alimentario", category: "Especias y Saborizantes", baseUnit: "ml", pricePerBaseUnit: "0.2", currentStock: "500.000", minStock: "100.000", supplierIndex: 1, imageUrl: ingredientImage("colorante-alimentario.jpg") },
  { name: "Nuez moscada", category: "Especias y Saborizantes", baseUnit: "g", pricePerBaseUnit: "0.18", currentStock: "500.000", minStock: "100.000", supplierIndex: 1, imageUrl: ingredientImage("nuez-moscada.jpg") },
  { name: "Clavo de olor", category: "Especias y Saborizantes", baseUnit: "g", pricePerBaseUnit: "0.16", currentStock: "500.000", minStock: "100.000", supplierIndex: 1, imageUrl: ingredientImage("clavo-de-olor.jpg") },
  { name: "Jengibre en polvo", category: "Especias y Saborizantes", baseUnit: "g", pricePerBaseUnit: "0.09", currentStock: "1000.000", minStock: "200.000", supplierIndex: 1, imageUrl: ingredientImage("jengibre-en-polvo.jpg") },
  // Empaques
  { name: "Papel para hornear", category: "Empaques", baseUnit: "pieza", pricePerBaseUnit: "0.50", currentStock: "300.000", minStock: "50.000", supplierIndex: 3, imageUrl: ingredientImage("papel-para-hornear.jpg") },
  { name: "Moldes desechables", category: "Empaques", baseUnit: "pieza", pricePerBaseUnit: "1.20", currentStock: "200.000", minStock: "40.000", supplierIndex: 3, imageUrl: ingredientImage("moldes-desechables.jpg") },
  { name: "Bolsas de empaque", category: "Empaques", baseUnit: "pieza", pricePerBaseUnit: "0.30", currentStock: "500.000", minStock: "100.000", supplierIndex: 3, imageUrl: ingredientImage("bolsas-de-empaque.jpg") },
  // Otros
  { name: "Huevos", category: "Otros", baseUnit: "pieza", pricePerBaseUnit: "0.60", currentStock: "200.000", minStock: "50.000", supplierIndex: 2, imageUrl: `${WIKIMEDIA_FILE}/Eggs_in_basket_2020_G1.jpg?width=400` },
  { name: "Galletas tipo María", category: "Otros", baseUnit: "pieza", pricePerBaseUnit: "0.15", currentStock: "500.000", minStock: "100.000", supplierIndex: 2, imageUrl: ingredientImage("galletas-tipo-maria.jpg") },
];

// ---------------------------------------------------------------------------
// Recetas. "Masa Base para Pan" se crea primero porque "Roscón Navideño" la
// usa como sub-receta anidada (recipe_ingredients.subRecipeId).
// "Pan de Molde" usa exactamente la receta canónica de SDD-09-TESTS.md §0.2
// (rendimiento=24, merma=5%) para que el costo calculado (≈1.54 Bs/unidad)
// sea consistente con el resto de la suite de pruebas.
// ---------------------------------------------------------------------------

type SeedLine =
  | { ingredient: string; quantity: string; unit: string }
  | { subRecipe: string; quantity: string; unit: string };

interface SeedRecipe {
  name: string;
  category: (typeof recipeCategoryNames)[number];
  description: string;
  yieldQuantity: string;
  yieldUnit: string;
  wastePercent: string;
  prepTimeMinutes: number | null;
  bakeTimeMinutes: number | null;
  lines: SeedLine[];
  /** Si se define, se crea un `product` para esta receta con este salePrice (Bs). */
  productSalePrice?: string;
  /** Foto de referencia (campo `imageUrl`, ver nota en SeedIngredient). */
  imageUrl?: string;
}

const seedRecipesData: SeedRecipe[] = [
  {
    name: "Masa Base para Pan",
    category: "Masas Base",
    description: "Masa base simple pensada para reutilizarse anidada en panes especiales.",
    yieldQuantity: "10",
    yieldUnit: "pieza",
    wastePercent: "0",
    prepTimeMinutes: 20,
    bakeTimeMinutes: null,
    imageUrl: recipeImage("masa-base-pan.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "500", unit: "g" },
      { ingredient: "Levadura", quantity: "5", unit: "g" },
    ],
  },
  {
    name: "Pan de Molde",
    category: "Panes",
    description: "Receta canónica de pan de molde (01-PROJECT_SPEC.md §5, SDD-09 §0.2).",
    yieldQuantity: "24",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 30,
    bakeTimeMinutes: 40,
    // Fix de bug de QA: el hotlink anterior (Sandwich_bread_(cropped).JPG)
    // devolvía HTTP 200 image/jpeg pero en realidad era una foto de una
    // etiqueta de empaque con texto en chino/inglés — nunca se verificó
    // visualmente, solo con `curl -I`. Ahora se descarga y sirve local, y
    // se verificó visualmente (Read) que sí es una foto de pan de molde.
    imageUrl: recipeImage("pan-de-molde.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "1", unit: "kg" },
      { ingredient: "Azúcar blanca", quantity: "0.5", unit: "kg" },
      { ingredient: "Mantequilla", quantity: "0.3", unit: "kg" },
      { ingredient: "Huevos", quantity: "10", unit: "pieza" },
      { ingredient: "Leche", quantity: "0.5", unit: "l" },
      { ingredient: "Levadura", quantity: "5", unit: "g" },
    ],
    productSalePrice: "2.50",
  },
  {
    name: "Roscón Navideño",
    category: "Panes Especiales",
    description: "Pan navideño con especias y frutas confitadas; anida Masa Base para Pan (01-PROJECT_SPEC.md §5).",
    yieldQuantity: "12",
    yieldUnit: "pieza",
    wastePercent: "8",
    prepTimeMinutes: 45,
    bakeTimeMinutes: 35,
    imageUrl: recipeImage("roscon-navideno.jpg"),
    lines: [
      { subRecipe: "Masa Base para Pan", quantity: "3", unit: "pieza" },
      { ingredient: "Azúcar blanca", quantity: "300", unit: "g" },
      { ingredient: "Huevos", quantity: "4", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "150", unit: "g" },
      { ingredient: "Canela molida", quantity: "10", unit: "g" },
      { ingredient: "Frutas confitadas", quantity: "100", unit: "g" },
      { ingredient: "Leche", quantity: "200", unit: "ml" },
    ],
    productSalePrice: "2.70",
  },
  {
    name: "Galletas de Mantequilla",
    category: "Galletas",
    description: "Galletas clásicas de mantequilla (01-PROJECT_SPEC.md §5).",
    yieldQuantity: "100",
    yieldUnit: "pieza",
    wastePercent: "3",
    prepTimeMinutes: 25,
    bakeTimeMinutes: 15,
    imageUrl: recipeImage("galletas-mantequilla.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "0.5", unit: "kg" },
      { ingredient: "Mantequilla", quantity: "0.3", unit: "kg" },
      { ingredient: "Azúcar blanca", quantity: "0.2", unit: "kg" },
      { ingredient: "Huevos", quantity: "3", unit: "pieza" },
    ],
    productSalePrice: "0.40",
  },
  {
    name: "Cheesecake de Maracuyá",
    category: "Postres",
    description: "Postre frío con base de galleta y cobertura de pulpa de maracuyá.",
    yieldQuantity: "12",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 40,
    bakeTimeMinutes: 50,
    imageUrl: recipeImage("cheesecake-maracuya.jpg"),
    lines: [
      { ingredient: "Galletas tipo María", quantity: "20", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "80", unit: "g" },
      { ingredient: "Queso crema", quantity: "500", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "150", unit: "g" },
      { ingredient: "Huevos", quantity: "3", unit: "pieza" },
      { ingredient: "Crema de leche", quantity: "200", unit: "ml" },
      { ingredient: "Pulpa de maracuyá", quantity: "150", unit: "ml" },
    ],
    productSalePrice: "6.50",
  },
  {
    name: "Torta de Chocolate",
    category: "Pasteles y Tortas",
    description: "Torta húmeda de chocolate para porciones individuales.",
    yieldQuantity: "16",
    yieldUnit: "pieza",
    wastePercent: "6",
    prepTimeMinutes: 30,
    bakeTimeMinutes: 45,
    imageUrl: recipeImage("torta-chocolate.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "400", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "350", unit: "g" },
      { ingredient: "Huevos", quantity: "4", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "200", unit: "g" },
      { ingredient: "Chocolate para fundir", quantity: "200", unit: "g" },
      { ingredient: "Cacao en polvo", quantity: "50", unit: "g" },
      { ingredient: "Polvo de hornear", quantity: "10", unit: "g" },
      { ingredient: "Leche", quantity: "200", unit: "ml" },
    ],
    productSalePrice: "3.50",
  },
  {
    name: "Alfajores de Maicena",
    category: "Repostería Fina",
    description: "Alfajores suaves de maicena rellenos, con base de leche condensada como relleno.",
    yieldQuantity: "30",
    yieldUnit: "pieza",
    wastePercent: "4",
    prepTimeMinutes: 35,
    bakeTimeMinutes: 12,
    imageUrl: recipeImage("alfajores-maicena.jpg"),
    lines: [
      { ingredient: "Maicena (almidón de maíz)", quantity: "300", unit: "g" },
      { ingredient: "Harina de trigo", quantity: "100", unit: "g" },
      { ingredient: "Mantequilla", quantity: "150", unit: "g" },
      { ingredient: "Azúcar impalpable", quantity: "100", unit: "g" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Leche condensada", quantity: "200", unit: "ml" },
    ],
    productSalePrice: "1.20",
  },

  // -------------------------------------------------------------------
  // Ampliación de catálogo (a pedido explícito del usuario: "alimentar
  // los seeds con más información, sobre todo en recetas"). Cubre las 7
  // categorías de receta con variedad, incluyendo panes bolivianos
  // emblemáticos (Marraqueta, Cuñapé). "Masa Hojaldrada" se agrega antes
  // de "Croissants" porque esta la anida como sub-receta.
  // -------------------------------------------------------------------

  // --- Panes ---
  {
    name: "Marraqueta",
    category: "Panes",
    description: "Pan boliviano clásico de corteza crujiente y miga hueca, infaltable en el desayuno paceño.",
    yieldQuantity: "40",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 40,
    bakeTimeMinutes: 25,
    imageUrl: recipeImage("marraqueta.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "1", unit: "kg" },
      { ingredient: "Levadura", quantity: "15", unit: "g" },
      { ingredient: "Sal", quantity: "20", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "20", unit: "g" },
    ],
    productSalePrice: "0.60",
  },
  {
    name: "Pan Integral",
    category: "Panes",
    description: "Pan de molde integral con harina de trigo integral, más denso y fibroso que el pan de molde blanco.",
    yieldQuantity: "15",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 30,
    bakeTimeMinutes: 40,
    imageUrl: recipeImage("pan-integral.jpg"),
    lines: [
      { ingredient: "Harina integral", quantity: "600", unit: "g" },
      { ingredient: "Harina de trigo", quantity: "200", unit: "g" },
      { ingredient: "Levadura", quantity: "10", unit: "g" },
      { ingredient: "Sal", quantity: "12", unit: "g" },
      { ingredient: "Aceite vegetal", quantity: "30", unit: "ml" },
      { ingredient: "Azúcar morena", quantity: "20", unit: "g" },
    ],
    productSalePrice: "3.00",
  },
  {
    name: "Pan de Hamburguesa",
    category: "Panes",
    description: "Pan suave y esponjoso tipo brioche, ideal para hamburguesas.",
    yieldQuantity: "20",
    yieldUnit: "pieza",
    wastePercent: "4",
    prepTimeMinutes: 35,
    bakeTimeMinutes: 18,
    imageUrl: recipeImage("pan-de-hamburguesa.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "800", unit: "g" },
      { ingredient: "Leche", quantity: "250", unit: "ml" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "80", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "50", unit: "g" },
      { ingredient: "Levadura", quantity: "12", unit: "g" },
      { ingredient: "Sal", quantity: "10", unit: "g" },
    ],
    productSalePrice: "2.80",
  },

  // --- Panes Especiales ---
  {
    name: "Empanadas de Queso",
    category: "Panes Especiales",
    description: "Empanaditas horneadas rellenas de queso fresco, típicas de panadería de barrio.",
    yieldQuantity: "24",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 40,
    bakeTimeMinutes: 20,
    imageUrl: recipeImage("empanadas-de-queso.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "500", unit: "g" },
      { ingredient: "Mantequilla", quantity: "120", unit: "g" },
      { ingredient: "Queso fresco", quantity: "400", unit: "g" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Sal", quantity: "6", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "20", unit: "g" },
    ],
    productSalePrice: "2.20",
  },
  {
    name: "Cuñapé",
    category: "Panes Especiales",
    description: "Pancito boliviano de almidón de yuca y queso, sin gluten, típico de Santa Cruz.",
    yieldQuantity: "30",
    yieldUnit: "pieza",
    wastePercent: "3",
    prepTimeMinutes: 25,
    bakeTimeMinutes: 20,
    imageUrl: recipeImage("cunape.jpg"),
    lines: [
      { ingredient: "Almidón de yuca", quantity: "500", unit: "g" },
      { ingredient: "Queso fresco", quantity: "300", unit: "g" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Leche", quantity: "80", unit: "ml" },
      { ingredient: "Aceite vegetal", quantity: "40", unit: "ml" },
      { ingredient: "Sal", quantity: "5", unit: "g" },
    ],
    productSalePrice: "1.50",
  },
  {
    name: "Masa Hojaldrada",
    category: "Masas Base",
    description: "Masa hojaldrada laminada con mantequilla, base reutilizable para croissants y otras piezas especiales.",
    yieldQuantity: "10",
    yieldUnit: "pieza",
    wastePercent: "2",
    prepTimeMinutes: 60,
    bakeTimeMinutes: null,
    imageUrl: recipeImage("masa-hojaldrada.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "500", unit: "g" },
      { ingredient: "Mantequilla sin sal", quantity: "400", unit: "g" },
      { ingredient: "Sal", quantity: "8", unit: "g" },
    ],
  },
  {
    name: "Croissants",
    category: "Panes Especiales",
    description: "Croissants de mantequilla hechos a partir de masa hojaldrada laminada, con pincelado de huevo.",
    yieldQuantity: "16",
    yieldUnit: "pieza",
    wastePercent: "6",
    prepTimeMinutes: 30,
    bakeTimeMinutes: 20,
    imageUrl: recipeImage("croissants.jpg"),
    lines: [
      { subRecipe: "Masa Hojaldrada", quantity: "2", unit: "pieza" },
      { ingredient: "Huevos", quantity: "1", unit: "pieza" },
      { ingredient: "Azúcar blanca", quantity: "30", unit: "g" },
    ],
    productSalePrice: "3.20",
  },
  {
    name: "Pan de Yema",
    category: "Panes Especiales",
    description: "Pan enriquecido con yema de huevo, suave y ligeramente dulce, típico de fechas especiales.",
    yieldQuantity: "12",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 40,
    bakeTimeMinutes: 25,
    imageUrl: recipeImage("pan-de-yema.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "500", unit: "g" },
      { ingredient: "Huevos", quantity: "5", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "100", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "80", unit: "g" },
      { ingredient: "Levadura", quantity: "10", unit: "g" },
      { ingredient: "Leche", quantity: "100", unit: "ml" },
      { ingredient: "Sal", quantity: "6", unit: "g" },
    ],
    productSalePrice: "3.00",
  },

  // --- Pasteles y Tortas ---
  {
    name: "Muffins de Chocolate",
    category: "Pasteles y Tortas",
    description: "Muffins individuales de chocolate, esponjosos y con chispas de chocolate.",
    yieldQuantity: "12",
    yieldUnit: "pieza",
    wastePercent: "4",
    prepTimeMinutes: 20,
    bakeTimeMinutes: 22,
    imageUrl: recipeImage("muffins-chocolate.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "300", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "200", unit: "g" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "120", unit: "g" },
      { ingredient: "Chispas de chocolate", quantity: "150", unit: "g" },
      { ingredient: "Cacao en polvo", quantity: "30", unit: "g" },
      { ingredient: "Polvo de hornear", quantity: "8", unit: "g" },
      { ingredient: "Leche", quantity: "150", unit: "ml" },
    ],
    productSalePrice: "3.80",
  },
  {
    name: "Cupcakes de Vainilla",
    category: "Pasteles y Tortas",
    description: "Cupcakes de vainilla con frosting de queso crema.",
    yieldQuantity: "18",
    yieldUnit: "pieza",
    wastePercent: "4",
    prepTimeMinutes: 25,
    bakeTimeMinutes: 20,
    imageUrl: recipeImage("cupcakes-vainilla.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "350", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "250", unit: "g" },
      { ingredient: "Huevos", quantity: "3", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "150", unit: "g" },
      { ingredient: "Vainilla líquida", quantity: "15", unit: "ml" },
      { ingredient: "Polvo de hornear", quantity: "10", unit: "g" },
      { ingredient: "Leche", quantity: "180", unit: "ml" },
      { ingredient: "Queso crema", quantity: "150", unit: "g" },
    ],
    productSalePrice: "3.50",
  },
  {
    name: "Tres Leches",
    category: "Pasteles y Tortas",
    description: "Torta esponjosa empapada en tres tipos de leche, cubierta con crema chantilly.",
    yieldQuantity: "16",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 35,
    bakeTimeMinutes: 35,
    imageUrl: recipeImage("tres-leches.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "300", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "200", unit: "g" },
      { ingredient: "Huevos", quantity: "5", unit: "pieza" },
      { ingredient: "Leche", quantity: "250", unit: "ml" },
      { ingredient: "Leche condensada", quantity: "300", unit: "ml" },
      { ingredient: "Crema de leche", quantity: "250", unit: "ml" },
      { ingredient: "Polvo de hornear", quantity: "10", unit: "g" },
      { ingredient: "Crema chantilly", quantity: "200", unit: "ml" },
    ],
    productSalePrice: "4.50",
  },

  // --- Galletas ---
  {
    name: "Galletas de Avena",
    category: "Galletas",
    description: "Galletas rústicas de avena con pasas, crujientes por fuera y suaves por dentro.",
    yieldQuantity: "40",
    yieldUnit: "pieza",
    wastePercent: "3",
    prepTimeMinutes: 25,
    bakeTimeMinutes: 15,
    imageUrl: recipeImage("galletas-avena.jpg"),
    lines: [
      { ingredient: "Avena en hojuelas", quantity: "300", unit: "g" },
      { ingredient: "Harina de trigo", quantity: "150", unit: "g" },
      { ingredient: "Mantequilla", quantity: "150", unit: "g" },
      { ingredient: "Azúcar morena", quantity: "150", unit: "g" },
      { ingredient: "Huevos", quantity: "2", unit: "pieza" },
      { ingredient: "Pasas", quantity: "100", unit: "g" },
      { ingredient: "Polvo de hornear", quantity: "6", unit: "g" },
    ],
    productSalePrice: "0.60",
  },

  // --- Postres ---
  {
    name: "Pie de Limón",
    category: "Postres",
    description: "Pie con base de galleta, relleno cremoso de limón y cobertura de crema chantilly.",
    yieldQuantity: "10",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 30,
    bakeTimeMinutes: 15,
    imageUrl: recipeImage("pie-de-limon.jpg"),
    lines: [
      { ingredient: "Galletas tipo María", quantity: "25", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "100", unit: "g" },
      { ingredient: "Leche condensada", quantity: "400", unit: "ml" },
      { ingredient: "Jugo de limón", quantity: "150", unit: "ml" },
      { ingredient: "Huevos", quantity: "3", unit: "pieza" },
      { ingredient: "Crema chantilly", quantity: "200", unit: "ml" },
    ],
    productSalePrice: "5.00",
  },
  {
    name: "Brownies",
    category: "Postres",
    description: "Brownies húmedos de chocolate con nueces.",
    yieldQuantity: "20",
    yieldUnit: "pieza",
    wastePercent: "3",
    prepTimeMinutes: 20,
    bakeTimeMinutes: 30,
    imageUrl: recipeImage("brownies.jpg"),
    lines: [
      { ingredient: "Harina de trigo", quantity: "250", unit: "g" },
      { ingredient: "Azúcar blanca", quantity: "300", unit: "g" },
      { ingredient: "Huevos", quantity: "4", unit: "pieza" },
      { ingredient: "Mantequilla", quantity: "200", unit: "g" },
      { ingredient: "Chocolate para fundir", quantity: "250", unit: "g" },
      { ingredient: "Cacao en polvo", quantity: "40", unit: "g" },
      { ingredient: "Nueces", quantity: "100", unit: "g" },
    ],
    productSalePrice: "3.00",
  },

  // --- Repostería Fina ---
  {
    name: "Merengues",
    category: "Repostería Fina",
    description: "Merengues crujientes horneados a baja temperatura, livianos y dulces.",
    yieldQuantity: "40",
    yieldUnit: "pieza",
    wastePercent: "5",
    prepTimeMinutes: 20,
    bakeTimeMinutes: 90,
    imageUrl: recipeImage("merengues.jpg"),
    lines: [
      { ingredient: "Azúcar blanca", quantity: "400", unit: "g" },
      { ingredient: "Huevos", quantity: "6", unit: "pieza" },
      { ingredient: "Cremor tártaro", quantity: "5", unit: "g" },
    ],
    productSalePrice: "0.50",
  },
];

async function main() {
  console.log("Sembrando datos de producción...");
  const adminPw = requirePassword("SEED_ADMIN_PASSWORD");
  const operarioPw = requirePassword("SEED_OPERARIO_PASSWORD");
  const duenoPw = requirePassword("SEED_DUENO_PASSWORD");
  if (config.nodeEnv === "production" && /localhost|127\.0\.0\.1/.test(config.publicBaseUrl)) {
    throw new Error("PUBLIC_BASE_URL apunta a localhost; define la URL pública del backend antes de sembrar (las imageUrl la usan).");
  }

  await seedUser("Ana Quispe", "admin@panaderia.bo", "admin", adminPw);
  await seedUser("Carlos Mamani", "operario@panaderia.bo", "operario", operarioPw);
  await seedUser("Beatriz Rojas", "dueño@panaderia.bo", "dueño", duenoPw);

  const ingredientCategoryIds = new Map<string, string>();
  for (const name of ingredientCategoryNames) {
    await db.insert(categories).values({ name, kind: "ingrediente" }).onConflictDoNothing();
    const [cat] = await db.select().from(categories).where(and(eq(categories.name, name), eq(categories.kind, "ingrediente")));
    ingredientCategoryIds.set(name, cat.id);
  }
  const recipeCategoryIds = new Map<string, string>();
  for (const name of recipeCategoryNames) {
    await db.insert(categories).values({ name, kind: "receta" }).onConflictDoNothing();
    const [cat] = await db.select().from(categories).where(and(eq(categories.name, name), eq(categories.kind, "receta")));
    recipeCategoryIds.set(name, cat.id);
  }

  const supplierIds: string[] = [];
  for (const supplier of seedSuppliers) {
    const [existing] = await db.select().from(suppliers).where(eq(suppliers.name, supplier.name));
    if (existing) {
      supplierIds.push(existing.id);
      console.log(`Proveedor ya existía, se omite: ${supplier.name}`);
      continue;
    }
    const [row] = await db.insert(suppliers).values(supplier).returning();
    supplierIds.push(row.id);
    console.log(`Proveedor creado: ${supplier.name}`);
  }

  const ingredientIds = new Map<string, string>();
  for (const s of seedIngredientsData) {
    const [existing] = await db.select().from(ingredients).where(eq(ingredients.name, s.name));
    if (existing) {
      ingredientIds.set(s.name, existing.id);
      console.log(`Ingrediente ya existía, se omite: ${s.name}`);
      continue;
    }
    const [ingredient] = await db
      .insert(ingredients)
      .values({
        name: s.name,
        baseUnit: s.baseUnit,
        currentStock: s.currentStock,
        minStock: s.minStock,
        categoryId: ingredientCategoryIds.get(s.category) ?? null,
        supplierId: supplierIds[s.supplierIndex] ?? null,
        imageUrl: s.imageUrl ?? null,
      })
      .returning();
    await db.insert(ingredientPriceHistory).values({
      ingredientId: ingredient.id,
      pricePerBaseUnit: s.pricePerBaseUnit,
      effectiveAt: new Date(),
    });
    ingredientIds.set(s.name, ingredient.id);
    console.log(`Ingrediente creado: ${s.name}`);
  }

  const recipeIds = new Map<string, string>();
  for (const r of seedRecipesData) {
    const [existing] = await db.select().from(recipes).where(eq(recipes.name, r.name));
    if (existing) {
      recipeIds.set(r.name, existing.id);
      console.log(`Receta ya existía, se omite: ${r.name}`);
      continue;
    }
    const [recipe] = await db
      .insert(recipes)
      .values({
        name: r.name,
        categoryId: recipeCategoryIds.get(r.category) ?? null,
        description: r.description,
        yieldQuantity: r.yieldQuantity,
        yieldUnit: r.yieldUnit,
        wastePercent: r.wastePercent,
        prepTimeMinutes: r.prepTimeMinutes,
        bakeTimeMinutes: r.bakeTimeMinutes,
        imageUrl: r.imageUrl ?? null,
      })
      .returning();
    recipeIds.set(r.name, recipe.id);

    for (const line of r.lines) {
      const unit = line.unit as (typeof recipeIngredients.$inferInsert)["unit"];
      if ("ingredient" in line) {
        const ingredientId = ingredientIds.get(line.ingredient);
        if (!ingredientId) throw new Error(`Ingrediente no sembrado: ${line.ingredient} (receta ${r.name})`);
        await db.insert(recipeIngredients).values({ recipeId: recipe.id, ingredientId, quantity: line.quantity, unit });
      } else {
        const subRecipeId = recipeIds.get(line.subRecipe);
        if (!subRecipeId) throw new Error(`Sub-receta no sembrada: ${line.subRecipe} (receta ${r.name})`);
        await db.insert(recipeIngredients).values({ recipeId: recipe.id, subRecipeId, quantity: line.quantity, unit });
      }
    }
    console.log(`Receta creada: ${r.name} (${r.lines.length} líneas)`);
  }

  for (const r of seedRecipesData) {
    if (!r.productSalePrice) continue;
    const recipeId = recipeIds.get(r.name);
    if (!recipeId) continue;
    const [existing] = await db.select().from(products).where(eq(products.recipeId, recipeId));
    if (existing) {
      console.log(`Producto ya existía, se omite: ${r.name}`);
      continue;
    }
    await db.insert(products).values({ recipeId, name: r.name, salePrice: r.productSalePrice });
    console.log(`Producto creado: ${r.name} — precio venta Bs ${r.productSalePrice}`);
  }

  // Repara imageUrl locales sembradas con otra PUBLIC_BASE_URL (p. ej. tras corregir la variable).
  const base = config.publicBaseUrl;
  for (const table of ["recipes", "ingredients"]) {
    const res = await db.execute(
      sql.raw(
        `UPDATE ${table} SET image_url = '${base.replace(/'/g, "''")}' || substring(image_url from '/images/.*') ` +
          `WHERE image_url LIKE '%/images/%' AND image_url NOT LIKE '${base.replace(/'/g, "''")}/images/%'`,
      ),
    );
    console.log(`imageUrl reparadas en ${table}: ${res.rowCount ?? 0}`);
  }

  console.log("Seed de producción completo.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Error en seed:prod:", err instanceof Error ? err.message : err);
  await pool.end().catch(() => {});
  process.exit(1);
});
