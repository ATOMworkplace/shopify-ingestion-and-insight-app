# Shopify Ingestion and Insight App

This application is a **Shopify Ingestion and Insight App** designed to synchronize customer, order, and product data from a connected Shopify store to a local database and provide key e-commerce insights.

The project is structured as a full-stack application with separate **server** and **client** directories.
## Architecture Diagram

<img width="500" height="500" alt="image" src="https://github.com/user-attachments/assets/2be48d33-491e-4f2c-8aca-db12927bb3d8" />

The application follows a **microservice/monorepo pattern** with a separation of concerns between the client and server.

* **Client (Frontend)**: A Next.js/React application that provides the user interface for authentication, connecting to Shopify, initiating manual syncs, and viewing the analytics dashboard. It uses **Pusher-js** to receive real-time updates from the server.
* **Server (Backend)**: A Node.js/Express API that handles:
    * **Authentication**: User registration/login and Shopify OAuth flow.
    * **Data Ingestion**: Pulling data from the Shopify REST Admin API and receiving `orders/create` webhooks.
    * **Data Persistence**: Uses **Prisma** to manage the **MySQL** database.
    * **Real-time**: Uses **Pusher** to broadcast webhook events to connected clients.

## Demo and Screenshots:
<img width="1919" height="931" alt="image" src="https://github.com/user-attachments/assets/5d90954e-0b6f-4045-bed3-c87baf851304" />
<img width="1919" height="961" alt="image" src="https://github.com/user-attachments/assets/332786db-0dcf-4d74-8b72-a6943e9ef5ce" />
<img width="1899" height="948" alt="image" src="https://github.com/user-attachments/assets/b44badb4-a85f-4e6d-8bd5-9abbf6ad673d" />
<img width="1885" height="951" alt="image" src="https://github.com/user-attachments/assets/2d305cad-930a-4505-9225-afc26f2ea02f" />

## Setup Instructions

### 1. Prerequisites
* Node.js (LTS version)
* MySQL Database
* Shopify Partner account for app creation
* Pusher account for real-time functionality

### 2. Installation & Configuration

1.  **Clone the repository.**
2.  Run `npm install` in both the `server` and `client` directories.
3.  Create a **`.env`** file in the `server` directory and configure the following environment variables:
    * `DATABASE_URL` (for MySQL connection string)
    * `SHOPIFY_API_SECRET`
    * Pusher credentials: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
4.  Run Prisma migrations (Prisma client generation is done automatically on `npm install`): `npx prisma migrate dev` (or appropriate migration command).

### 3. Running the App
* **Server (Port 5000 by default):**
    ```bash
    cd server
    npm run dev
    ```
* **Client (Port 3000 by default):**
    ```bash
    cd client
    npm run dev
    ```
## Technical Overview and Documentation Summary

This section fulfills the documentation requirements by summarizing the core components, assumptions, and future steps.

### Note
* **Authentication/Authorization**: The application relies on **JWTs** for internal user authentication and **HMAC signature validation** for securing incoming Shopify webhooks.
* **Data Structure**: The local database schema is assumed to be a normalized copy of the most critical Shopify data fields necessary for insight generation (Tenant, Customer, Order, Product).
* **Data Sync**: It is assumed that a **full manual sync** will be performed periodically to correct data discrepancies, given the limited webhook support.

### APIs and data models used.

#### External APIs
1.  **Shopify REST Admin API**: Used for OAuth, connection management, and bulk data synchronization.
2.  **Shopify Webhooks**: Used to receive real-time notifications for new orders (`orders/create`).
3.  **Pusher**: Used by the Server to broadcast real-time events and by the Client to receive them.

#### Database Data Models (via `server/prisma/schema.prisma`)
The database uses **MySQL** with **Prisma** as the ORM.

| Model | Purpose | Key Fields |
| :--- | :--- | :--- |
| **Tenant** | Stores app users and Shopify connection details. | `id`, `email`, `password`, `shopDomain` (unique), `accessToken` |
| **Product** | Local copy of Shopify Products. | `shopifyProductId` (unique), `title`, `tenantId` |
| **Customer** | Local copy of Shopify Customers. | `shopifyCustomerId` (unique), `email`, `totalSpent` (Float), `ordersCount` (Int) |
| **Order** | Local copy of Shopify Orders. | `shopifyOrderId` (unique), `totalPrice` (Float), `currency`, `createdAt` |

### Next steps to productionize your solution.

1.  **Implement Data Sync Pagination**: Modify the manual sync endpoints (`/api/data/sync`) to use **cursor-based pagination** for reliable handling of large Shopify data volumes.
2.  **Expand Webhook Support**: Implement handling for updates and deletions for Products, Customers, and Orders to keep local data fresh without reliance on manual syncs.
3.  **Resolve API Versioning**: Standardize on a single, current, and supported Shopify API version across the entire application to eliminate the inconsistency between sync (`2025-01`) and webhooks (`2026-01`).
4.  **Remove Stats Order Limit**: Eliminate the latest **50 orders** limit in the `/api/data/stats` endpoint to ensure accurate analytics and chart data for high-volume stores.

## API Endpoints and DB Schema

### Key API Endpoints (Express Server)

| HTTP Method | Path | Description | Authentication | Source |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/user/register` | Registers a new application user. | None | `userRoutes.js` |
| `POST` | `/api/user/login` | Authenticates a user and returns a token. | None | `userRoutes.js` |
| `GET` | `/api/shopify/install` | Redirects for the Shopify OAuth flow. | JWT | `authRoutes.js` |
| `POST` | `/api/shopify/disconnect` | Removes the Shopify connection (`accessToken`) for the tenant. | JWT | `authRoutes.js` |
| `POST` | `/api/data/sync` | Manually syncs all **Products**, **Customers**, and **Orders** from the connected Shopify store. | JWT | `dataRoutes.js` |
| `GET` | `/api/data/stats` | Fetches aggregated insights (Sales, AOV, Product/Customer Count, Chart Data). Supports `startDate`/`endDate` query params. | JWT | `dataRoutes.js` |
| `POST` | `/api/webhooks/orders/create` | Receives and validates new **Order** webhooks. Updates the database and broadcasts via Pusher. | HMAC Signature | `webhookRoutes.js` |

## Known Limitations or Assumptions

* **API Version Inconsistency**: The manual data sync (`/api/data/sync`) is currently hardcoded to use the Shopify API version `2025-01`. However, the `shopify.app.toml` defines the webhook API version as `2026-01`.
* **Data Sync Pagination**: The manual sync does not implement cursor-based pagination for fetching Shopify data (Products, Orders, Customers). For stores with large volumes of data, this process may time out or fail.
* **Limited Webhook Support**: Only the `orders/create` webhook is implemented. Updates or deletions for Products, Customers, and Orders are not handled, meaning local data for those entities can become stale until a manual full sync is performed.
* **Stats Order Limit**: The `/api/data/stats` endpoint only retrieves the latest **50 orders** for calculating `dailyStats` and generating chart data. This may lead to inaccurate daily/chart data if a store receives more than 50 orders within the analyzed date range.


