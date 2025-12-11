const app = {
    balance: 0,
    portfolioValue: 0,
    loanAmount: 0,
    creditScore: 750,

    init() {
        auth.checkAuth();
    },

    showMain() {
        document.getElementById('mainApp').classList.remove('hidden');
    },

    hideMain() {
        document.getElementById('mainApp').classList.add('hidden');
    },

    async loadUserData() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.username) {
            document.getElementById('usernameDisplay').textContent = user.username;
        }

        await this.updateBalance();
        await this.updateCredit();
    },

    async updateBalance() {
        try {
            const data = await api.getBalance();
            this.balance = data.balance;
            this.creditScore = data.creditScore;

            document.getElementById('balance').textContent = this.balance.toFixed(2);
            document.getElementById('creditScoreNav').textContent = this.creditScore;

            await this.updateNetWorth();
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    },

    async updateCredit() {
        try {
            const data = await api.getCredit();
            this.loanAmount = data.totalDebt;
            document.getElementById('loanAmount').textContent = this.loanAmount.toFixed(2);

            await this.updateNetWorth();
        } catch (error) {
            console.error('Failed to update credit:', error);
        }
    },

    async updatePortfolioValue() {
        try {
            const portfolio = await api.getPortfolio();
            this.portfolioValue = portfolio.reduce((sum, item) => sum + item.totalValue, 0);
            document.getElementById('portfolioValue').textContent = this.portfolioValue.toFixed(2);

            await this.updateNetWorth();
        } catch (error) {
            console.error('Failed to update portfolio:', error);
        }
    },

    async updateNetWorth() {
        const netWorth = this.balance + this.portfolioValue - this.loanAmount;
        document.getElementById('netWorth').textContent = netWorth.toFixed(2);
    },

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        const gameArea = document.getElementById('gameArea');
        gameArea.insertBefore(messageDiv, gameArea.firstChild);

        setTimeout(() => messageDiv.remove(), 5000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
