const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT balance, credit_score FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      balance: parseFloat(users[0].balance),
      creditScore: users[0].credit_score
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Play game
router.post('/play', authenticateToken, async (req, res) => {
  const { gameType, betAmount, result, payout, details } = req.body;

  try {
    // Validate gameType
    const allowed = ['slots', 'roulette', 'blackjack', 'poker'];
    if (!allowed.includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current balance
      const [users] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (users.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(users[0].balance);

      if (betAmount > currentBalance) {
        await connection.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Calculate new balance
      const newBalance = currentBalance - betAmount + (payout || 0);

      // Update balance
      await connection.query(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, req.user.userId]
      );

      // Record game session
      await connection.query(
        'INSERT INTO game_sessions (user_id, game_type, bet_amount, result, payout, details) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.userId, gameType, betAmount, result, payout || 0, JSON.stringify(details)]
      );

      // Update game stats
      await connection.query(
        'UPDATE game_stats SET total_wagered = total_wagered + ?, total_won = total_won + ?, games_played = games_played + 1 WHERE user_id = ? AND game_type = ?',
        [betAmount, (result === 'win' ? payout - betAmount : 0), req.user.userId, gameType]
      );

      // Record transaction
      const transactionType = result === 'win' ? 'win' : 'loss';
      const transactionAmount = result === 'win' ? (payout - betAmount) : betAmount;
      await connection.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.userId, transactionType, transactionAmount, `${gameType} - ${result}`]
      );

      await connection.commit();

      res.json({
        success: true,
        newBalance,
        result,
        payout: payout || 0
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Game play failed' });
  }
});

// Get game statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [stats] = await db.query(
      'SELECT game_type, total_wagered, total_won, games_played FROM game_stats WHERE user_id = ?',
      [req.user.userId]
    );

    const statsObject = {};
    stats.forEach(stat => {
      statsObject[stat.game_type] = {
        totalWagered: parseFloat(stat.total_wagered),
        totalWon: parseFloat(stat.total_won),
        gamesPlayed: stat.games_played
      };
    });

    res.json(statsObject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;
