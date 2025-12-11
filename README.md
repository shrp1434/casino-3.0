# 🎰 Casino Platform 3.0

A full-stack online casino and trading platform with authentication, games, stock trading, and banking features.

## Features

- 🔐 **User Authentication** - Register, login, email verification
- 🎰 **Casino Games** - Slots, Roulette, Blackjack, Poker
- 📈 **Stock Market** - Live trading with 10 stocks
- 🏦 **Banking System** - Loans with dynamic interest rates based on credit score
- 💳 **Credit System** - Credit score that changes based on behavior
- 📊 **Statistics** - Track your gaming and trading history

## Tech Stack

**Backend:**
- Node.js + Express
- MySQL
- JWT Authentication
- bcrypt for password hashing
- Nodemailer for email verification

**Frontend:**
- Vanilla JavaScript
- HTML5/CSS3
- Fetch API for backend communication

## Installation

### Prerequisites

- Node.js (v14+)
- MySQL (v8+)
- Git

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/casino-platform.git
cd casino-platform
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Configure database**
```bash
# Login to MySQL
mysql -u root -p

# Run the schema file
source database/schema.sql
```

4. **Configure environment variables**
```bash
# Copy the example env file
cp .env.example .env
# Edit .env with your settings
```

5. **Start the backend server**
```bash
npm run dev
```

6. **Serve the frontend**
```bash
cd frontend
python3 -m http.server 8080
# or
npx http-server frontend -p 8080
```

7. **Access the application**
http://localhost:8080

## Security Notes

- Change `JWT_SECRET` in `.env` to a secure random string
- Use HTTPS in production
- Keep dependencies updated
- Never commit `.env` file to Git
