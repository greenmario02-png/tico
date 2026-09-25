import '../models/models.dart';
import 'api_client.dart';

class AuthApi {
  final ApiClient client;
  AuthApi(this.client);

  Future<LoginResult> login(String email, String password) => client.post(
        '/auth/login',
        body: {'email': email, 'password': password},
        timeout: const Duration(seconds: 90),
        parse: (d) => LoginResult.fromJson(d as Map<String, dynamic>),
      );

  Future<AppUser> me() => client.get('/auth/me', parse: (d) => AppUser.fromJson(d as Map<String, dynamic>));

  Future<void> logout() => client.post('/auth/logout', parse: (_) => null);
}

class IngredientsApi {
  final ApiClient client;
  IngredientsApi(this.client);

  Future<Paginated<Ingredient>> list({int page = 1, int pageSize = 20, String? search, String? categoryId}) =>
      client.get(
        '/ingredients',
        query: {'page': page, 'pageSize': pageSize, 'search': search, 'categoryId': categoryId},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, Ingredient.fromJson),
      );

  Future<List<Ingredient>> listAllActive() =>
      client.fetchAllPages('/ingredients', Ingredient.fromJson, query: {'isActive': 'true'});

  Future<Paginated<Ingredient>> lowStock() => client.get(
        '/ingredients/low-stock',
        query: {'pageSize': 100},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, Ingredient.fromJson),
      );

  Future<Ingredient> getById(String id) =>
      client.get('/ingredients/$id', parse: (d) => Ingredient.fromJson(d as Map<String, dynamic>));

  Future<Ingredient> create(Map<String, dynamic> body) =>
      client.post('/ingredients', body: body, parse: (d) => Ingredient.fromJson(d as Map<String, dynamic>));

  Future<Ingredient> update(String id, Map<String, dynamic> body) =>
      client.put('/ingredients/$id', body: body, parse: (d) => Ingredient.fromJson(d as Map<String, dynamic>));

  Future<void> deactivate(String id) => client.delete('/ingredients/$id', parse: (_) => null);

  Future<void> registerPurchase(String id, {required String quantityBaseUnit, String? note, String? newPrice}) =>
      client.post(
        '/ingredients/$id/purchase',
        body: {
          'quantityBaseUnit': quantityBaseUnit,
          'note': note,
          if (newPrice != null) 'alsoUpdatePrice': {'pricePerBaseUnit': newPrice},
        },
        parse: (_) => null,
      );

  Future<void> registerPriceChange(String id, {required String pricePerBaseUnit, required String effectiveAt}) =>
      client.post(
        '/ingredients/$id/price',
        body: {'pricePerBaseUnit': pricePerBaseUnit, 'effectiveAt': effectiveAt},
        parse: (_) => null,
      );

  Future<Paginated<PriceHistoryEntry>> priceHistory(String id) => client.get(
        '/ingredients/$id/price-history',
        query: {'pageSize': 50},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, PriceHistoryEntry.fromJson),
      );
}

/// SDD-05 §4 — solo lectura de catálogo desde mobile: crear/editar
/// categorías es responsabilidad del admin en el web app (ver nota de
/// alcance en ingredient_form_screen.dart / recipe_form_screen.dart).
class CategoriesApi {
  final ApiClient client;
  CategoriesApi(this.client);

  Future<List<Category>> list({String? kind}) =>
      client.fetchAllPages('/categories', Category.fromJson, query: {if (kind != null) 'kind': kind});
}

/// SDD-05 §5 — idem CategoriesApi: solo lectura desde mobile.
class SuppliersApi {
  final ApiClient client;
  SuppliersApi(this.client);

  Future<List<Supplier>> list() => client.fetchAllPages('/suppliers', Supplier.fromJson);
}

class RecipesApi {
  final ApiClient client;
  RecipesApi(this.client);

  Future<Paginated<Recipe>> list({int page = 1, int pageSize = 20, String? search}) => client.get(
        '/recipes',
        query: {'page': page, 'pageSize': pageSize, 'search': search},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, Recipe.fromJson),
      );

  Future<List<Recipe>> listAll() => client.fetchAllPages('/recipes', Recipe.fromJson);

  Future<Recipe> getById(String id) => client.get('/recipes/$id', parse: (d) => Recipe.fromJson(d as Map<String, dynamic>));

  Future<RecipeCostPreview> costPreview(String id, {String? quantity}) => client.get(
        '/recipes/$id/cost',
        query: {'quantity': quantity},
        parse: (d) => RecipeCostPreview.fromJson(d as Map<String, dynamic>),
      );

  Future<Recipe> create(Map<String, dynamic> body) =>
      client.post('/recipes', body: body, parse: (d) => Recipe.fromJson(d as Map<String, dynamic>));

  Future<Recipe> update(String id, Map<String, dynamic> body) =>
      client.put('/recipes/$id', body: body, parse: (d) => Recipe.fromJson(d as Map<String, dynamic>));

  Future<void> delete(String id) => client.delete('/recipes/$id', parse: (_) => null);
}

class ProductsApi {
  final ApiClient client;
  ProductsApi(this.client);

  Future<List<Product>> listAll() => client.fetchAllPages('/products', Product.fromJson);

  Future<Product> getById(String id) => client.get('/products/$id', parse: (d) => Product.fromJson(d as Map<String, dynamic>));

  Future<SuggestedPrice> suggestedPrice(String id, {required num margin}) => client.get(
        '/products/$id/suggested-price',
        query: {'margin': margin},
        parse: (d) => SuggestedPrice.fromJson(d as Map<String, dynamic>),
      );
}

class BatchesApi {
  final ApiClient client;
  BatchesApi(this.client);

  Future<Batch> produce({required String recipeId, required String requestedUnits, String? productId, String? notes}) =>
      client.post(
        '/batches',
        body: {
          'recipeId': recipeId,
          'requestedUnits': requestedUnits,
          if (productId != null) 'productId': productId,
          'notes': notes,
        },
        parse: (d) => Batch.fromJson(d as Map<String, dynamic>),
      );

  Future<Paginated<Batch>> list({int page = 1, int pageSize = 20}) => client.get(
        '/batches',
        query: {'page': page, 'pageSize': pageSize},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, Batch.fromJson),
      );
}

class SalesApi {
  final ApiClient client;
  SalesApi(this.client);

  Future<Sale> register({required String productId, required String quantity, required String salePricePerUnit, String? batchId}) =>
      client.post(
        '/sales',
        body: {
          'productId': productId,
          'quantity': quantity,
          'salePricePerUnit': salePricePerUnit,
          if (batchId != null) 'batchId': batchId,
        },
        parse: (d) => Sale.fromJson(d as Map<String, dynamic>),
      );

  Future<Paginated<Sale>> list({int page = 1, int pageSize = 20}) => client.get(
        '/sales',
        query: {'page': page, 'pageSize': pageSize},
        parse: (d) => Paginated.fromJson(d as Map<String, dynamic>, Sale.fromJson),
      );
}

class ReportsApi {
  final ApiClient client;
  ReportsApi(this.client);

  Future<ProfitabilityReport> profitability({required String from, required String to}) => client.get(
        '/reports/profitability',
        query: {'from': from, 'to': to},
        parse: (d) => ProfitabilityReport.fromJson(d as Map<String, dynamic>),
      );

  Future<List<ProductionRow>> production({required String from, required String to}) => client.get(
        '/reports/production',
        query: {'from': from, 'to': to, 'pageSize': 100},
        parse: (d) => ((d as Map<String, dynamic>)['data'] as List)
            .map((e) => ProductionRow.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
