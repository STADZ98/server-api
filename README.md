# API Endpoints Summary

## Authentication

| Endpoint                            | Method | Description        | Body                                                 |
|-------------------------------------|--------|--------------------|------------------------------------------------------|
| `https://server-api-newgen.vercel.app/api/login`                        | POST   | Login user         | `{ "email": "tam@tam", "password": "1234" }`         |
| `https://server-api-newgen.vercel.app/api/register`                     | POST   | Register user      | `{ "email": "tam@tam", "password": "1234" }`         |
| `https://server-api-newgen.vercel.app/api/current-user`                 | POST   | Get current user   | None                                                 |
| `https://server-api-newgen.vercel.app/api/current-admin`                | POST   | Get current admin  | None                                                 |

## Category

| Endpoint                            | Method | Description            | Body                        |
|-------------------------------------|--------|------------------------|-----------------------------|
| `https://server-api-newgen.vercel.app/api/category`                     | POST   | Create category         | `{ "name": "Test1" }`       |
| `https://server-api-newgen.vercel.app/api/category`                     | GET    | Get categories          | None                        |
| `https://server-api-newgen.vercel.app/api/category/:id`                 | DELETE | Delete category by ID   | None                        |

## Product

| Endpoint                            | Method | Description            | Body                                                                                  |
|-------------------------------------|--------|------------------------|---------------------------------------------------------------------------------------|
| `https://server-api-newgen.vercel.app/api/product`                      | POST   | Create product          | `{ "title": "TEST", "description": "test", "price": 10000, "quantity": 20, "categoryId": 2, "images": [] }` |
| `https://server-api-newgen.vercel.app/api/product/:id`                  | GET    | Get product by ID       | None                                                                                  |
| `https://server-api-newgen.vercel.app/api/product/:id`                  | DELETE | Delete product by ID    | None                                                                                  |
| `https://server-api-newgen.vercel.app/api/productby`                    | POST   | Get products by filters | `{ "sort": "price", "order": "asc", "limit": 2 }` or `{ "sort": "quantity", "order": "desc", "limit": 2 }` |
| `https://server-api-newgen.vercel.app/api/search/filters`               | POST   | Search with filters     | `{ "query": "mouse" }`, `{ "price": [100, 600] }`, or `{ "category": [1, 2] }`        |

## User Management

| Endpoint                            | Method | Description               | Body                                                       |
|-------------------------------------|--------|---------------------------|------------------------------------------------------------|
| `https://server-api-newgen.vercel.app/api/users`                        | GET    | Get all users             | None                                                       |
| `https://server-api-newgen.vercel.app/api/change-status`                | POST   | Change user status        | `{ "id": 1, "enabled": false }`                            |
| `https://server-api-newgen.vercel.app/api/change-role`                  | POST   | Change user role          | `{ "id": 1, "role": "user" }`                              |
| `https://server-api-newgen.vercel.app/api/user/cart`                    | POST   | Add to cart               | `{ "cart": [{ "id": 1, "count": 2, "price": 100 }, { "id": 5, "count": 1, "price": 200 }] }` |
| `https://server-api-newgen.vercel.app/api/user/cart`                    | GET    | Get cart                  | None                                                       |
| `https://server-api-newgen.vercel.app/api/user/cart`                    | DELETE | Delete cart               | None                                                       |
| `https://server-api-newgen.vercel.app/api/user/address`                 | POST   | Add user address          | `{ "address": "korat" }`                                   |
| `https://server-api-newgen.vercel.app/api/user/order`                   | POST   | Place an order            | None                                                       |
| `https://server-api-newgen.vercel.app/api/user/order`                   | GET    | Get user orders           | None                                                       |

## Admin

| Endpoint                            | Method | Description               | Body                              |
|-------------------------------------|--------|---------------------------|-----------------------------------|
| `https://server-api-newgen.vercel.app/api/user/order`                   | PUT    | Update order status        | `{ "orderId": 35, "orderStatus": "Completed" }` |
| `https://server-api-newgen.vercel.app/api/admin/orders`                 | GET    | Get all orders             | None                              |
# Project-PetShopOnline

## Shipping Integration

Added new endpoint to check tracking status via server proxy:


Notes:

Example environment variables (add to your `.env` in `server/`):

Example environment variables (add to your `.env` in `server/`):

If env vars are missing, the controller returns mocked responses with a `mocked: true` flag.

Important: Do NOT commit your `server/.env` file. The repository includes `server/.env.example` which shows placeholders.
Copy `server/.env.example` -> `server/.env` and fill in real secrets locally. Ensure `.gitignore` contains `.env` (it does).

Advanced configuration

You can configure request method, headers and body per provider using these env vars (prefix with provider name):

- `<PREFIX>_TRACK_METHOD` — HTTP method, e.g. `GET` or `POST` (default `GET`)
- `<PREFIX>_TRACK_HEADERS` — JSON string of headers, e.g. `{"Authorization":"Bearer TOKEN"}`
- `<PREFIX>_TRACK_BODY` — Request body template (use `{tracking}` placeholder), e.g. `{"tracking":"{tracking}"}`

Examples (in `.env`):

```
# For a provider that needs POST with JSON body and Authorization header
FLASH_TRACK_URL=https://partner.flashexpress.comhttps://server-api-newgen.vercel.app/api/v1/track
FLASH_TRACK_METHOD=POST
FLASH_TRACK_HEADERS={"Authorization":"Bearer xxxxxx"}
FLASH_TRACK_BODY={"tracking":"{tracking}"}
```

Quick run (PowerShell):
```
cd d:\Project-PetShopOnline-Ecommerce\server
# install deps (only needed if you changed package.json)
npm install
# start server
node server.js
# test
node scripts/test_tracking.js http://localhost:5005 Flash TRACKCODE
```


```
# Flash Express example
FLASH_TRACK_URL=https://partner.flashexpress.comhttps://server-api-newgen.vercel.app/api/v1/track/{tracking}
FLASH_API_KEY=your_flash_api_key_here

# J&T example
JNT_TRACK_URL=https:/https://server-api-newgen.vercel.app/api.jnt.example/track/{tracking}
JNT_API_KEY=your_jnt_api_key_here

# Thailand Post example (replace with real endpoint)
THAI_POST_TRACK_URL=https:/https://server-api-newgen.vercel.app/api.thailandpost.example/track/{tracking}
```

How to run locally and test:

1. Install and start server

```powershell
cd d:\Project-PetShopOnline-Ecommerce\server
npm install
npm run start
```

2. Quick test using the included script

```powershell
# from server folder
node scripts/test_tracking.js http://localhost:5005 Flash TRACK12345
```

If env vars are missing, the controller returns mocked responses with a `mocked: true` flag.


