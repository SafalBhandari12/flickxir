# Local Market Platform API

A comprehensive local market platform API that enables customers to browse and order products from local vendors, with complete vendor management and admin dashboard features.

## 🚀 Features

### User App Features

- ✅ User registration & login (Phone/OTP)
- ✅ Browse products with search and filters
- ✅ Place & manage orders
- ✅ Secure payment integration (Razorpay)
- ✅ Notifications & alerts
- ✅ Profile management

### Vendor App Features

- ✅ Vendor onboarding & approval system
- ✅ Product management (CRUD operations)
- ✅ Order/request tracking
- ✅ Earnings & reports
- ✅ Notifications & alerts
- ✅ Profile & settings

### Admin Web Portal Features

- ✅ Dashboard with analytics
- ✅ User & vendor management
- ✅ Order & transaction management
- ✅ Content management system (CMS)
- ✅ Reports & insights
- ✅ Admin roles & permissions

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

All protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### API Endpoints

#### Authentication (`/api/auth`)

- `POST /auth/send-otp` - Send OTP to phone number
- `POST /auth/verify-otp` - Verify OTP and login/register
- `POST /auth/refresh-token` - Refresh JWT token
- `POST /auth/logout` - Logout user

#### Products (`/api/market/products`)

- `GET /products` - Get all products (with search & filters)
- `GET /products/:id` - Get product by ID
- `GET /products/categories/list` - Get product categories
- `POST /products` - Create product (Vendor only)
- `GET /products/vendor/my-products` - Get vendor's products
- `PUT /products/:id` - Update product (Vendor only)
- `DELETE /products/:id` - Delete product (Vendor only)
- `PATCH /products/:id/toggle-availability` - Toggle product availability

#### Orders (`/api/market/orders`)

- `POST /orders` - Create order (Customer only)
- `GET /orders/customer/my-orders` - Get customer orders
- `GET /orders/vendor/my-orders` - Get vendor orders
- `GET /orders/:id` - Get order by ID
- `PATCH /orders/:id/status` - Update order status (Vendor only)
- `PATCH /orders/:id/cancel` - Cancel order (Customer only)

#### Vendors (`/api/market/vendors`)

- `GET /vendors/:id` - Get vendor by ID (Public)
- `POST /vendors/onboard` - Vendor onboarding
- `GET /vendors/profile/me` - Get vendor profile
- `PUT /vendors/profile/me` - Update vendor profile
- `GET /vendors` - Get all vendors (Admin only)
- `PATCH /vendors/:id/status` - Approve/reject vendor (Admin only)

#### Admin (`/api/market/admin`)

- `GET /admin/dashboard/stats` - Dashboard statistics
- `GET /admin/users` - Get all users
- `PATCH /admin/users/:id/toggle-status` - Toggle user status
- `GET /admin/orders` - Get all orders
- `GET /admin/orders/export` - Export orders data
- `GET /admin/analytics/sales` - Sales analytics
- `GET /admin/analytics/products` - Product performance
- `GET /admin/analytics/vendors` - Vendor performance
- `GET /admin/analytics/users` - User activity report
- `GET /admin/config` - Get system configuration
- `POST /admin/config` - Update system configuration

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Razorpay account (for payments)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/market_db"

# JWT
JWT_SECRET="your_jwt_secret_key_here"
JWT_REFRESH_SECRET="your_jwt_refresh_secret_key_here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"

# Razorpay
RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

# OTP Service (MessageCentral)
OTP_SERVICE_CUSTOMER_ID="your_customer_id"
OTP_SERVICE_AUTH_TOKEN="your_auth_token"

# Server
PORT=3000
NODE_ENV=development
```

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Setup database:**

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

3. **Create admin user (optional):**

   ```bash
   npm run create-admin
   ```

4. **Start development server:**

   ```bash
   npm run dev
   ```

5. **Start production server:**
   ```bash
   npm run build
   npm start
   ```

## 📊 Database Schema

The platform uses PostgreSQL with Prisma ORM. Key entities include:

- **Users** - Customer, Vendor, and Admin users
- **Vendors** - Vendor profiles with business details
- **LocalMarketProfile** - Market-specific vendor details
- **Products** - Product catalog with categories
- **Bookings** - Order management
- **MarketBooking** - Order line items
- **Payments** - Payment tracking with Razorpay integration
- **RefreshTokens** - JWT token management

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- OTP verification for secure login
- Rate limiting on sensitive endpoints
- Input validation with Zod schemas
- Helmet.js for security headers
- CORS configuration
- Secure password-free authentication

## 💳 Payment Integration

The platform integrates with Razorpay for secure payments:

- Order creation with Razorpay
- Payment verification with signatures
- Webhook handling for payment status updates
- Refund management
- Commission calculation for vendors

## 📱 Notification System

Built-in notification system supports:

- Order status updates
- Vendor approval notifications
- Payment confirmations
- Real-time alerts (WebSocket ready)
- SMS and email notifications (configurable)

## 📈 Analytics & Reporting

Comprehensive reporting system includes:

- Dashboard statistics
- Sales analytics with time-based filtering
- Product performance metrics
- Vendor performance tracking
- User activity reports
- Data export functionality

## 🧪 Testing

Run the test suite:

```bash
npm test
```

## 🚀 Deployment

### Production Checklist

- [ ] Set production environment variables
- [ ] Configure production database
- [ ] Set up Razorpay production keys
- [ ] Configure notification services
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

### Docker Deployment

```bash
docker build -t market-platform .
docker run -p 3000:3000 market-platform
```

## 📋 API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    // Validation errors or details
  ]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the API documentation
- Review the code examples

---

**Built with ❤️ for local market vendors and customers**
