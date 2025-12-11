-- Casino Platform Database Schema

CREATE DATABASE IF NOT EXISTS casino_platform;
USE casino_platform;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 100000.00,
    credit_score INT DEFAULT 750,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Game Statistics Table
CREATE TABLE game_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_type ENUM('slots', 'roulette', 'blackjack', 'poker') NOT NULL,
    total_wagered DECIMAL(15, 2) DEFAULT 0.00,
    total_won DECIMAL(15, 2) DEFAULT 0.00,
    games_played INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Transactions Table
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('win', 'loss', 'loan', 'loan_payment', 'stock_buy', 'stock_sell') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Loans Table
CREATE TABLE loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    principal DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0.00,
    loan_type VARCHAR(50) NOT NULL,
    status ENUM('active', 'paid', 'defaulted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status)
);

-- Stock Portfolio Table
CREATE TABLE stock_portfolio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stock_symbol VARCHAR(10) NOT NULL,
    shares INT NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_stock (user_id, stock_symbol)
);

-- Stock Prices Table (for historical tracking)
CREATE TABLE stock_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_symbol VARCHAR(10) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    change_percent DECIMAL(5, 2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_time (stock_symbol, recorded_at)
);

-- Game Sessions Table
CREATE TABLE game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    bet_amount DECIMAL(15, 2) NOT NULL,
    result ENUM('win', 'loss', 'push') NOT NULL,
    payout DECIMAL(15, 2) DEFAULT 0.00,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_game (user_id, game_type)
);
