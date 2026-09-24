import { config } from "../src/lib/config";
import { pool } from "../src/db/client";

// Script puntual y acotado: asigna image_url SOLO a ingredientes cuyo
// image_url es NULL, por nombre exacto. (El seed usa onConflictDoNothing,
// por lo que un re-seed no actualiza filas existentes.)
const FILES: Record<string, string> = {
  "Harina integral": "harina-integral.jpg",
  "Maicena (almidón de maíz)": "maicena.jpg",
  "Harina de maíz": "harina-de-maiz.jpg",
  "Harina de arroz": "harina-de-arroz.jpg",
  "Sémola de trigo": "semola-de-trigo.jpg",
  "Almidón de yuca": "almidon-de-yuca.jpg",
  "Avena en hojuelas": "avena-en-hojuelas.jpg",
  "Yogurt natural": "yogurt-natural.jpg",
  "Crema chantilly": "crema-chantilly.jpg",
  "Queso mascarpone": "queso-mascarpone.jpg",
  "Mantequilla sin sal": "mantequilla-sin-sal.jpg",
  "Queso fresco": "queso-fresco.jpg",
  "Azúcar impalpable": "azucar-impalpable.jpg",
  "Azúcar morena": "azucar-morena.jpg",
  "Panela (chancaca)": "panela.jpg",
  "Aceite vegetal": "aceite-vegetal.jpg",
  "Manteca vegetal": "manteca-vegetal.jpg",
  "Margarina": "margarina.jpg",
  "Aceite de oliva": "aceite-de-oliva.jpg",
  "Polvo de hornear": "polvo-de-hornear.jpg",
  "Bicarbonato de sodio": "bicarbonato-de-sodio.jpg",
  "Gelatina sin sabor": "gelatina-sin-sabor.png",
  "Cremor tártaro": "cremor-tartaro.jpg",
  "Chocolate blanco": "chocolate-blanco.jpg",
  "Cobertura de chocolate": "cobertura-de-chocolate.jpg",
  "Frutas confitadas": "frutas-confitadas.jpg",
  "Pulpa de maracuyá": "pulpa-de-maracuya.jpg",
  "Avellanas": "avellanas.jpg",
  "Cerezas confitadas": "cerezas-confitadas.jpg",
  "Arándanos deshidratados": "arandanos-deshidratados.jpg",
  "Plátano": "platano.jpg",
  "Manzana": "manzana.jpg",
  "Jugo de limón": "jugo-de-limon.jpg",
  "Esencia de almendra": "esencia-de-almendra.jpg",
  "Colorante alimentario": "colorante-alimentario.jpg",
  "Nuez moscada": "nuez-moscada.jpg",
  "Clavo de olor": "clavo-de-olor.jpg",
  "Jengibre en polvo": "jengibre-en-polvo.jpg",
  "Papel para hornear": "papel-para-hornear.jpg",
  "Moldes desechables": "moldes-desechables.jpg",
  "Bolsas de empaque": "bolsas-de-empaque.jpg",
  "Galletas tipo María": "galletas-tipo-maria.jpg"
};

async function main() {
  let updated = 0;
  for (const [name, file] of Object.entries(FILES)) {
    const url = `${config.publicBaseUrl}/images/ingredients/${file}`;
    const r = await pool.query("UPDATE ingredients SET image_url = $1 WHERE name = $2 AND image_url IS NULL", [url, name]);
    if (r.rowCount === 0) console.log("sin cambio:", name);
    updated += r.rowCount ?? 0;
  }
  console.log("filas actualizadas:", updated);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
