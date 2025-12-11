const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Stock symbols and initial prices
const STOCKS = {
  'TECH': { name: 'TechCorp', basePrice: 150 },
  'BANK': { name: 'MegaBank', basePrice: 85 },
  'AUTO': { name: 'AutoDrive', basePrice: 220 },
  'FOOD': { name: 'FoodChain', basePrice: 45 },
  'PHARM': { name: 'PharmaCure', basePrice: 180 },
  'ENRG': { name: 'EnergyPlus', basePrice: 92 },
  'RETAIL': { name: 'ShopMore', basePrice: 68 },
  'AERO': { name: 'SkyHigh', basePrice: 315 },
  'MEDIA': { name: 'MediaNet', basePrice: 125 },
  'CRYPTO': { name: 'CryptoVault', basePrice: 55 }
};

// Generate current stock prices (simulated)
function generateStockPrices() {
  const prices = {};
  for (const [symbol, data] of Object.entries(STOCKS)) {
    const volatility = 0.05; // 5% volatility
    const change = (Math.random() - 0.5) * 2 * volatility;
    const price = data.basePrice * (1 + change);
    prices[symbol] = {
      symbol,
      name: data.name,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat((change * 100).toFixed(2))
    };
  }
  return prices;
}

// Get current stock prices
router.get('/prices', authenticateToken, async (req, res) => {
  try {
    const prices = generateStockPrices();
    res.json(prices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get stock prices' });
  }
});

// Get user portfolio
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const [portfolio] = await db.query(
      'SELECT stock_symbol, SUM(shares) as total_shares, AVG(purchase_price) as avg_price FROM stock_portfolio WHERE user_id = ? GROUP BY stock_symbol',
      [req.user.userId]
    );

    const prices = generateStockPrices();

    const portfolioWithValue = portfolio.map(item => {
      const currentPrice = prices[item.stock_symbol]?.price || 0;
      const totalValue = item.total_shares * currentPrice;
      const costBasis = item.total_shares * parseFloat(item.avg_price);
      const profitLoss = totalValue - costBasis;

      return {
        symbol: item.stock_symbol,
        shares: item.total_shares,
        avgPrice: parseFloat(item.avg_price),
        currentPrice,
        totalValue: parseFloat(totalValue.toFixed(2)),
        profitLoss: parseFloat(profitLoss.toFixed(2)),
        profitLossPercent: parseFloat(((profitLoss / costBasis) * 100).toFixed(2))
      };
    });

    res.json(portfolioWithValue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get portfolio' });
  }
});

// Buy stock
router.post('/buy', authenticateToken, async (req, res) => {
  const { symbol, shares } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current price
      const prices = generateStockPrices();
      const stockPrice = prices[symbol]?.price;

      if (!stockPrice) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid stock symbol' });
      }

      const totalCost = stockPrice * shares;

      // Get user balance
      const [users] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (totalCost > parseFloat(users[0].balance)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Add to portfolio
      await connection.query(
        'INSERT INTO stock_portfolio (user_id, stock_symbol, shares, purchase_price) VALUES (?, ?, ?, ?)',
        [req.user.userId, symbol, shares, stockPrice]
      );

      // Update balance
      const newBalance = parseFloat(users[0].balance) - totalCost;
      await connection.query(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, req.user.userId]
      );

      // Record transaction
      await connection.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.userId, 'stock_buy', totalCost, `Bought ${shares} shares of ${symbol}`]
      );

      // Optionally record price to historical table
      await connection.query(
        'INSERT INTO stock_prices (stock_symbol, price, change_percent) VALUES (?, ?, ?)',
        [symbol, stockPrice, prices[symbol].change]
      );

      await connection.commit();

      res.json({
        success: true,
        newBalance,
        shares,
        price: stockPrice,
        totalCost
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to buy stock' });
  }
});

// Sell stock
router.post('/sell', authenticateToken, async (req, res) => {
  const { symbol, shares } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if user has enough shares
      const [portfolio] = await connection.query(
        'SELECT SUM(shares) as total_shares FROM stock_portfolio WHERE user_id = ? AND stock_symbol = ?',
        [req.user.userId, symbol]
      );

      if (!portfolio[0].total_shares || portfolio[0].total_shares < shares) {
        await connection.rollback();
        return res.status(400).json({ error: 'Insufficient shares' });
      }

      // Get current price
      const prices = generateStockPrices();
      const stockPrice = prices[symbol]?.price;

      if (!stockPrice) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid stock symbol' });
      }

      const totalValue = stockPrice * shares;

      // Remove shares (FIFO)
      let sharesToSell = shares;
      const [holdings] = await connection.query(
        'SELECT id, shares FROM stock_portfolio WHERE user_id = ? AND stock_symbol = ? ORDER BY purchased_at ASC',
        [req.user.userId, symbol]
      );

      for (const holding of holdings) {
        if (sharesToSell <= 0) break;

        if (holding.shares <= sharesToSell) {
          await connection.query('DELETE FROM stock_portfolio WHERE id = ?', [holding.id]);
          sharesToSell -= holding.shares;
        } else {
          await connection.query(
            'UPDATE stock_portfolio SET shares = shares - ? WHERE id = ?',
            [sharesToSell, holding.id]
          );
          sharesToSell = 0;
        }
      }

      // Update balance
      const [users] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [req.user.userId]
      );

      const newBalance = parseFloat(users[0].balance) + totalValue;
      await connection.query(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, req.user.userId]
      );

      // Record transaction
      await connection.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.userId, 'stock_sell', totalValue, `Sold ${shares} shares of ${symbol}`]
      );

      // Optionally record price to historical table
      await connection.query(
        'INSERT INTO stock_prices (stock_symbol, price, change_percent) VALUES (?, ?, ?)',
        [symbol, stockPrice, prices[symbol].change]
      );

      await connection.commit();

      res.json({
        success: true,
        newBalance,
        shares,
        price: stockPrice,
        totalValue
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to sell stock' });
  }
});

module.exports = router;
