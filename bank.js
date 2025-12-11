const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get credit info
router.get('/credit', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT credit_score FROM users WHERE id = ?',
      [req.user.userId]
    );

    const [loans] = await db.query(
      'SELECT SUM(total_amount - amount_paid) as total_debt FROM loans WHERE user_id = ? AND status = "active"',
      [req.user.userId]
    );

    const totalDebt = loans[0].total_debt || 0;

    res.json({
      creditScore: users[0].credit_score,
      totalDebt: parseFloat(totalDebt)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get credit info' });
  }
});

// Get all loans
router.get('/loans', authenticateToken, async (req, res) => {
  try {
    const [loans] = await db.query(
      'SELECT id, principal, interest_rate, total_amount, amount_paid, loan_type, status, created_at, due_date FROM loans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );

    res.json(loans.map(loan => ({
      id: loan.id,
      principal: parseFloat(loan.principal),
      interestRate: parseFloat(loan.interest_rate),
      totalAmount: parseFloat(loan.total_amount),
      amountPaid: parseFloat(loan.amount_paid),
      remaining: parseFloat(loan.total_amount) - parseFloat(loan.amount_paid),
      loanType: loan.loan_type,
      status: loan.status,
      createdAt: loan.created_at,
      dueDate: loan.due_date
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get loans' });
  }
});

// Take out loan
router.post('/borrow', authenticateToken, async (req, res) => {
  const { amount, loanType } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get user credit score
      const [users] = await connection.query(
        'SELECT credit_score, balance FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (users.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'User not found' });
      }

      const creditScore = users[0].credit_score;

      // Calculate interest rate based on credit score
      let interestRate;
      if (creditScore >= 750) interestRate = 5;
      else if (creditScore >= 700) interestRate = 8;
      else if (creditScore >= 650) interestRate = 12;
      else if (creditScore >= 600) interestRate = 15;
      else interestRate = 20;

      const totalAmount = parseFloat(amount) * (1 + interestRate / 100);
      const dueDate = new Date();

      // Set due date based on loan type
      if (loanType === 'quick') dueDate.setDate(dueDate.getDate() + 7);
      else if (loanType === 'standard') dueDate.setMonth(dueDate.getMonth() + 1);
      else dueDate.setMonth(dueDate.getMonth() + 6);

      // Create loan
      await connection.query(
        'INSERT INTO loans (user_id, principal, interest_rate, total_amount, loan_type, due_date) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user.userId, amount, interestRate, totalAmount, loanType, dueDate]
      );

      // Add to balance
      const newBalance = parseFloat(users[0].balance) + parseFloat(amount);
      await connection.query(
        'UPDATE users SET balance = ?, credit_score = credit_score - 10 WHERE id = ?',
        [newBalance, req.user.userId]
      );

      // Record transaction (corrected)
      await connection.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.userId, 'loan', amount, `${loanType} loan borrowed`]
      );

      await connection.commit();

      res.json({
        success: true,
        amount: parseFloat(amount),
        interestRate,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        newBalance
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process loan' });
  }
});

// Repay loan
router.post('/repay/:loanId', authenticateToken, async (req, res) => {
  const { loanId } = req.params;
  const { amount } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get loan info
      const [loans] = await connection.query(
        'SELECT total_amount, amount_paid FROM loans WHERE id = ? AND user_id = ?',
        [loanId, req.user.userId]
      );

      if (loans.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Loan not found' });
      }

      const remaining = parseFloat(loans[0].total_amount) - parseFloat(loans[0].amount_paid);

      if (amount > remaining) {
        await connection.rollback();
        return res.status(400).json({ error: 'Amount exceeds remaining balance' });
      }

      // Get user balance
      const [users] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [req.user.userId]
      );

      if (amount > parseFloat(users[0].balance)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Update loan
      const newAmountPaid = parseFloat(loans[0].amount_paid) + parseFloat(amount);
      const status = newAmountPaid >= parseFloat(loans[0].total_amount) ? 'paid' : 'active';

      await connection.query(
        'UPDATE loans SET amount_paid = ?, status = ? WHERE id = ?',
        [newAmountPaid, status, loanId]
      );

      // Update balance and improve credit if loan paid off
      const newBalance = parseFloat(users[0].balance) - parseFloat(amount);
      const creditBonus = status === 'paid' ? 20 : 5;

      await connection.query(
        'UPDATE users SET balance = ?, credit_score = LEAST(credit_score + ?, 850) WHERE id = ?',
        [newBalance, creditBonus, req.user.userId]
      );

      // Record transaction
      await connection.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [req.user.userId, 'loan_payment', amount, `Loan repayment`]
      );

      await connection.commit();

      res.json({
        success: true,
        newBalance,
        loanPaidOff: status === 'paid'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to repay loan' });
  }
});

module.exports = router;
