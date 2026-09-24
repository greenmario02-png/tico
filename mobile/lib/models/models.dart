// Tipos que reflejan la forma REAL de las respuestas del backend
// (ver app/backend/src/routes/*.ts — fuente de verdad; ver también
// app/web/src/lib/types.ts, la traducción ya hecha para el frontend web).
//
// Los valores numéricos (precios, cantidades, stock) llegan del backend
// como strings (columnas `numeric` de Postgres serializadas tal cual), así
// que se guardan como String acá también y se parsean a double solo donde
// hace falta calcular/mostrar formateado — igual que hace el web app.

typedef Json = Map<String, dynamic>;

class Pagination {
  final int page;
  final int pageSize;
  final int totalItems;
  final int totalPages;

  Pagination({required this.page, required this.pageSize, required this.totalItems, required this.totalPages});

  factory Pagination.fromJson(Json json) => Pagination(
        page: json['page'] as int,
        pageSize: json['pageSize'] as int,
        totalItems: json['totalItems'] as int,
        totalPages: json['totalPages'] as int,
      );
}

class Paginated<T> {
  final List<T> data;
  final Pagination pagination;
  Paginated({required this.data, required this.pagination});

  factory Paginated.fromJson(Json json, T Function(Json) fromJson) => Paginated(
        data: (json['data'] as List).map((e) => fromJson(e as Json)).toList(),
        pagination: Pagination.fromJson(json['pagination'] as Json),
      );
}

class AppUser {
  final String id;
  final String name;
  final String email;
  final String role; // admin | operario | dueño
  AppUser({required this.id, required this.name, required this.email, required this.role});

  factory AppUser.fromJson(Json json) => AppUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
      );
}

class LoginResult {
  final String accessToken;
  final AppUser user;
  LoginResult({required this.accessToken, required this.user});

  factory LoginResult.fromJson(Json json) => LoginResult(
        accessToken: json['accessToken'] as String,
        user: AppUser.fromJson(json['user'] as Json),
      );
}

class Ingredient {
  final String id;
  final String name;
  final String? categoryId;
  final String? categoryName;
  final String baseUnit; // g | ml | pieza
  final String currentStock;
  final String minStock;
  final String? supplierId;
  final String? supplierName;
  final String? currentPricePerBaseUnit;
  final bool isActive;

  Ingredient({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.categoryName,
    required this.baseUnit,
    required this.currentStock,
    required this.minStock,
    required this.supplierId,
    required this.supplierName,
    required this.currentPricePerBaseUnit,
    required this.isActive,
  });

  double get stockNum => double.tryParse(currentStock) ?? 0;
  double get minStockNum => double.tryParse(minStock) ?? 0;
  bool get isBelowMin => stockNum < minStockNum;

  factory Ingredient.fromJson(Json json) => Ingredient(
        id: json['id'] as String,
        name: json['name'] as String,
        categoryId: json['categoryId'] as String?,
        categoryName: json['categoryName'] as String?,
        baseUnit: json['baseUnit'] as String,
        currentStock: json['currentStock'].toString(),
        minStock: json['minStock'].toString(),
        supplierId: json['supplierId'] as String?,
        supplierName: json['supplierName'] as String?,
        currentPricePerBaseUnit: json['currentPricePerBaseUnit']?.toString(),
        isActive: json['isActive'] as bool? ?? true,
      );
}

class Category {
  final String id;
  final String name;
  final String kind; // ingrediente | receta

  Category({required this.id, required this.name, required this.kind});

  factory Category.fromJson(Json json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
        kind: json['kind'] as String,
      );
}

class Supplier {
  final String id;
  final String name;
  final String? contactPerson;
  final String? phone;

  Supplier({required this.id, required this.name, required this.contactPerson, required this.phone});

  factory Supplier.fromJson(Json json) => Supplier(
        id: json['id'] as String,
        name: json['name'] as String,
        contactPerson: json['contactPerson'] as String?,
        phone: json['phone'] as String?,
      );
}

class PriceHistoryEntry {
  final String id;
  final String pricePerBaseUnit;
  final String effectiveAt;
  PriceHistoryEntry({required this.id, required this.pricePerBaseUnit, required this.effectiveAt});

  factory PriceHistoryEntry.fromJson(Json json) => PriceHistoryEntry(
        id: json['id'] as String,
        pricePerBaseUnit: json['pricePerBaseUnit'].toString(),
        effectiveAt: json['effectiveAt'].toString(),
      );
}

class RecipeIngredientLine {
  final String id;
  final String type; // ingredient | sub_recipe
  final String? ingredientId;
  final String? ingredientName;
  final String? subRecipeId;
  final String? subRecipeName;
  final String quantity;
  final String unit;

  RecipeIngredientLine({
    required this.id,
    required this.type,
    required this.ingredientId,
    required this.ingredientName,
    required this.subRecipeId,
    required this.subRecipeName,
    required this.quantity,
    required this.unit,
  });

  factory RecipeIngredientLine.fromJson(Json json) => RecipeIngredientLine(
        id: json['id'].toString(),
        type: json['type'] as String,
        ingredientId: json['ingredientId'] as String?,
        ingredientName: json['ingredientName'] as String?,
        subRecipeId: json['subRecipeId'] as String?,
        subRecipeName: json['subRecipeName'] as String?,
        quantity: json['quantity'].toString(),
        unit: json['unit'] as String,
      );

  Json toApiJson() => {
        'type': type,
        if (type == 'ingredient') 'ingredientId': ingredientId,
        if (type == 'sub_recipe') 'subRecipeId': subRecipeId,
        'quantity': quantity,
        'unit': unit,
      };
}

class Recipe {
  final String id;
  final String name;
  final String? categoryId;
  final String? categoryName;
  final String? description;
  final String yieldQuantity;
  final String yieldUnit; // pieza | docena
  final String wastePercent;
  final int? prepTimeMinutes;
  final int? bakeTimeMinutes;
  final String? instructions;
  final bool isDeleted;
  final List<RecipeIngredientLine>? ingredients;

  Recipe({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.categoryName,
    required this.description,
    required this.yieldQuantity,
    required this.yieldUnit,
    required this.wastePercent,
    required this.prepTimeMinutes,
    required this.bakeTimeMinutes,
    required this.instructions,
    required this.isDeleted,
    required this.ingredients,
  });

  factory Recipe.fromJson(Json json) => Recipe(
        id: json['id'] as String,
        name: json['name'] as String,
        categoryId: json['categoryId'] as String?,
        categoryName: json['categoryName'] as String?,
        description: json['description'] as String?,
        yieldQuantity: json['yieldQuantity'].toString(),
        yieldUnit: json['yieldUnit'] as String,
        wastePercent: json['wastePercent'].toString(),
        prepTimeMinutes: json['prepTimeMinutes'] as int?,
        bakeTimeMinutes: json['bakeTimeMinutes'] as int?,
        instructions: json['instructions'] as String?,
        isDeleted: json['isDeleted'] as bool? ?? false,
        ingredients: json['ingredients'] == null
            ? null
            : (json['ingredients'] as List).map((e) => RecipeIngredientLine.fromJson(e as Json)).toList(),
      );
}

class CostDetail {
  final String type;
  final String? ingredientId;
  final String? ingredientName;
  final String? subRecipeId;
  final String? subRecipeName;
  final String baseQuantity;
  final String unit;
  final String scaledQuantity;
  final String quantityAfterWaste;
  final String pricePerBaseUnit;
  final String lineCost;
  final List<CostDetail>? subBreakdown;

  CostDetail({
    required this.type,
    this.ingredientId,
    this.ingredientName,
    this.subRecipeId,
    this.subRecipeName,
    required this.baseQuantity,
    required this.unit,
    required this.scaledQuantity,
    required this.quantityAfterWaste,
    required this.pricePerBaseUnit,
    required this.lineCost,
    this.subBreakdown,
  });

  factory CostDetail.fromJson(Json json) => CostDetail(
        type: json['type'] as String,
        ingredientId: json['ingredientId'] as String?,
        ingredientName: json['ingredientName'] as String?,
        subRecipeId: json['subRecipeId'] as String?,
        subRecipeName: json['subRecipeName'] as String?,
        baseQuantity: json['baseQuantity'].toString(),
        unit: json['unit'] as String,
        scaledQuantity: json['scaledQuantity'].toString(),
        quantityAfterWaste: json['quantityAfterWaste'].toString(),
        pricePerBaseUnit: json['pricePerBaseUnit'].toString(),
        lineCost: json['lineCost'].toString(),
        subBreakdown: json['subBreakdown'] == null
            ? null
            : (json['subBreakdown'] as List).map((e) => CostDetail.fromJson(e as Json)).toList(),
      );
}

class RecipeCostPreview {
  final String recipeId;
  final String recipeName;
  final String requestedQuantity;
  final String yieldQuantity;
  final String scaleFactor;
  final String wastePercent;
  final String totalCost;
  final String costPerUnit;
  final List<CostDetail> breakdown;

  RecipeCostPreview({
    required this.recipeId,
    required this.recipeName,
    required this.requestedQuantity,
    required this.yieldQuantity,
    required this.scaleFactor,
    required this.wastePercent,
    required this.totalCost,
    required this.costPerUnit,
    required this.breakdown,
  });

  factory RecipeCostPreview.fromJson(Json json) => RecipeCostPreview(
        recipeId: json['recipeId'] as String,
        recipeName: json['recipeName'] as String,
        requestedQuantity: json['requestedQuantity'].toString(),
        yieldQuantity: json['yieldQuantity'].toString(),
        scaleFactor: json['scaleFactor'].toString(),
        wastePercent: json['wastePercent'].toString(),
        totalCost: json['totalCost'].toString(),
        costPerUnit: json['costPerUnit'].toString(),
        breakdown: (json['breakdown'] as List).map((e) => CostDetail.fromJson(e as Json)).toList(),
      );
}

class Product {
  final String id;
  final String recipeId;
  final String? recipeName;
  final String name;
  final String? salePrice;
  final bool isActive;

  Product({
    required this.id,
    required this.recipeId,
    required this.recipeName,
    required this.name,
    required this.salePrice,
    required this.isActive,
  });

  factory Product.fromJson(Json json) => Product(
        id: json['id'] as String,
        recipeId: json['recipeId'] as String,
        recipeName: json['recipeName'] as String?,
        name: json['name'] as String,
        salePrice: json['salePrice']?.toString(),
        isActive: json['isActive'] as bool? ?? true,
      );
}

/// Respuesta de GET /products/:id/suggested-price (ver
/// productService.ts#getSuggestedPrice): precio sugerido para un margen
/// deseado, calculado siempre contra el costo real de la receta asociada
/// (nunca un cálculo hecho en el cliente).
class SuggestedPrice {
  final String productId;
  final String productName;
  final String costPerUnit;
  final String marginPercent;
  final String suggestedPrice;
  final String? currentSalePrice;

  SuggestedPrice({
    required this.productId,
    required this.productName,
    required this.costPerUnit,
    required this.marginPercent,
    required this.suggestedPrice,
    required this.currentSalePrice,
  });

  factory SuggestedPrice.fromJson(Json json) => SuggestedPrice(
        productId: json['productId'] as String,
        productName: json['productName'] as String,
        costPerUnit: json['costPerUnit'].toString(),
        marginPercent: json['marginPercent'].toString(),
        suggestedPrice: json['suggestedPrice'].toString(),
        currentSalePrice: json['currentSalePrice']?.toString(),
      );
}

class Batch {
  final String id;
  final String recipeId;
  final String? productId;
  final String requestedUnits;
  final String scaleFactor;
  final String totalCostSnapshot;
  final String costPerUnitSnapshot;
  // Derivado (nunca una columna física): requestedUnits - SUM(ventas de ese
  // lote). Ver SDD-03 §7, SDD-05 §8. Nulo si el backend no lo incluyó.
  final String? unitsRemaining;
  final String producedAt;
  final String? notes;

  Batch({
    required this.id,
    required this.recipeId,
    required this.productId,
    required this.requestedUnits,
    required this.scaleFactor,
    required this.totalCostSnapshot,
    required this.costPerUnitSnapshot,
    this.unitsRemaining,
    required this.producedAt,
    required this.notes,
  });

  factory Batch.fromJson(Json json) => Batch(
        id: json['id'] as String,
        recipeId: json['recipeId'] as String,
        productId: json['productId'] as String?,
        requestedUnits: json['requestedUnits'].toString(),
        scaleFactor: json['scaleFactor'].toString(),
        totalCostSnapshot: json['totalCostSnapshot'].toString(),
        costPerUnitSnapshot: json['costPerUnitSnapshot'].toString(),
        unitsRemaining: json['unitsRemaining']?.toString(),
        producedAt: json['producedAt'].toString(),
        notes: json['notes'] as String?,
      );
}

class Sale {
  final String id;
  final String productId;
  final String? productName;
  final String quantity;
  final String salePricePerUnit;
  final String costPerUnitSnapshot;
  final String revenue;
  final String costTotal;
  final String realProfit;
  final String realMarginPercent;
  final String soldAt;

  Sale({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.salePricePerUnit,
    required this.costPerUnitSnapshot,
    required this.revenue,
    required this.costTotal,
    required this.realProfit,
    required this.realMarginPercent,
    required this.soldAt,
  });

  factory Sale.fromJson(Json json) => Sale(
        id: json['id'] as String,
        productId: json['productId'] as String,
        productName: json['productName'] as String?,
        quantity: json['quantity'].toString(),
        salePricePerUnit: json['salePricePerUnit'].toString(),
        costPerUnitSnapshot: json['costPerUnitSnapshot'].toString(),
        revenue: json['revenue'].toString(),
        costTotal: json['costTotal'].toString(),
        realProfit: json['realProfit'].toString(),
        realMarginPercent: json['realMarginPercent'].toString(),
        soldAt: json['soldAt'].toString(),
      );
}

class ProfitabilityRow {
  final String productId;
  final String? productName;
  final String unitsSold;
  final String totalRevenue;
  final String totalCost;
  final String totalRealProfit;
  final String realMarginPercent;
  // Resuelto (SDD-07 CU6, SDD-10 §1): true si realMarginPercent está por
  // debajo del umbral configurable devuelto en
  // ProfitabilityReport.lowProfitabilityThresholdPercent.
  final bool isLowProfitability;

  ProfitabilityRow({
    required this.productId,
    required this.productName,
    required this.unitsSold,
    required this.totalRevenue,
    required this.totalCost,
    required this.totalRealProfit,
    required this.realMarginPercent,
    this.isLowProfitability = false,
  });

  factory ProfitabilityRow.fromJson(Json json) => ProfitabilityRow(
        productId: json['productId'] as String,
        productName: json['productName'] as String?,
        unitsSold: json['unitsSold'].toString(),
        totalRevenue: json['totalRevenue'].toString(),
        totalCost: json['totalCost'].toString(),
        totalRealProfit: json['totalRealProfit'].toString(),
        realMarginPercent: json['realMarginPercent'].toString(),
        isLowProfitability: json['isLowProfitability'] as bool? ?? false,
      );
}

class ProfitabilityTotals {
  final String totalRevenue;
  final String totalCost;
  final String totalRealProfit;
  final String realMarginPercent;
  ProfitabilityTotals({
    required this.totalRevenue,
    required this.totalCost,
    required this.totalRealProfit,
    required this.realMarginPercent,
  });

  factory ProfitabilityTotals.fromJson(Json json) => ProfitabilityTotals(
        totalRevenue: json['totalRevenue'].toString(),
        totalCost: json['totalCost'].toString(),
        totalRealProfit: json['totalRealProfit'].toString(),
        realMarginPercent: json['realMarginPercent'].toString(),
      );
}

class ProfitabilityReport {
  final List<ProfitabilityRow> data;
  final ProfitabilityTotals totals;
  // Umbral (%) usado para calcular isLowProfitability, ver SDD-05 §11.5.
  final num? lowProfitabilityThresholdPercent;
  ProfitabilityReport({required this.data, required this.totals, this.lowProfitabilityThresholdPercent});

  factory ProfitabilityReport.fromJson(Json json) => ProfitabilityReport(
        data: (json['data'] as List).map((e) => ProfitabilityRow.fromJson(e as Json)).toList(),
        totals: ProfitabilityTotals.fromJson(json['totals'] as Json),
        lowProfitabilityThresholdPercent: json['lowProfitabilityThresholdPercent'] as num?,
      );
}

class ProductionRow {
  final String recipeId;
  final String? recipeName;
  final String unitsProduced;
  final String totalProductionCost;
  final String unitsSold;
  final String totalRevenue;
  final String totalRealProfit;
  final String realMarginPercent;

  ProductionRow({
    required this.recipeId,
    required this.recipeName,
    required this.unitsProduced,
    required this.totalProductionCost,
    required this.unitsSold,
    required this.totalRevenue,
    required this.totalRealProfit,
    required this.realMarginPercent,
  });

  factory ProductionRow.fromJson(Json json) => ProductionRow(
        recipeId: (json['recipeId'] ?? '').toString(),
        recipeName: json['recipeName'] as String?,
        unitsProduced: (json['unitsProduced'] ?? '0').toString(),
        totalProductionCost: (json['totalProductionCost'] ?? '0').toString(),
        unitsSold: (json['unitsSold'] ?? '0').toString(),
        totalRevenue: (json['totalRevenue'] ?? '0').toString(),
        totalRealProfit: (json['totalRealProfit'] ?? '0').toString(),
        realMarginPercent: (json['realMarginPercent'] ?? '0').toString(),
      );
}
