// API Configuration
const API_URL = 'http://localhost:3000/api';

const api = {
    token: localStorage.getItem('token'),

    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    },

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    },

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Auth endpoints
    async register(username, email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    },

    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    // Game endpoints
    async getBalance() {
        return this.request('/games/balance');
    },

    async playGame(gameType, betAmount, result, payout, details) {
        return this.request('/games/play', {
            method: 'POST',
            body: JSON.stringify({ gameType, betAmount, result, payout, details })
        });
    },

    // Stock endpoints
    async getStockPrices() {
        return this.request('/stocks/prices');
    },

    async getPortfolio() {
        return this.request('/stocks/portfolio');
    },

    async buyStock(symbol, shares) {
        return this.request('/stocks/buy', {
            method: 'POST',
            body: JSON.stringify({ symbol, shares })
        });
    },

    async sellStock(symbol, shares) {
        return this.request('/stocks/sell', {
            method: 'POST',
            body: JSON.stringify({ symbol, shares })
        });
    },

    // Bank endpoints
    async getCredit() {
        return this.request('/bank/credit');
    },

    async getLoans() {
        return this.request('/bank/loans');
    },

    async borrow(amount, loanType) {
        return this.request('/bank/borrow', {
            method: 'POST',
            body: JSON.stringify({ amount, loanType })
        });
    },

    async repayLoan(loanId, amount) {
        return this.request(`/bank/repay/${loanId}`, {
            method: 'POST',
            body: JSON.stringify({ amount })
        });
    }
};
