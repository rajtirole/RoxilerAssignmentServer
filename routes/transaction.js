const express = require('express');
const router = express.Router();
const axios = require('axios');
const Transaction = require('../models/Transaction');

// Helper function to get month number from month name
const getMonthNumber = (monthName) => {
    const month = new Date(Date.parse(monthName +" 1, 2020")).getMonth() + 1;
    return month < 10 ? `0${month}` : `${month}`;
};

// Initialize the database
router.get('/initialize', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const data = response.data;
        await Transaction.insertMany(data);
        res.status(201).json({ message: 'Database initialized with seed data.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// List transactions with search and pagination
router.get('/transactions', async (req, res) => {
    const { month, search = '', page = 1, per_page = 10 } = req.query;
    const monthNumber = getMonthNumber(month);
    const skip = (page - 1) * per_page;
    const limit = parseInt(per_page);

    try {
        const match = {
            $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] }
        };

        if (search) {
            match.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { price: { $regex: search, $options: 'i' } }
            ];
        }

        const transactions = await Transaction.aggregate([
            { $match: match },
            { $skip: skip },
            { $limit: limit }
        ]);

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Statistics API
router.get('/statistics', async (req, res) => {
    const { month } = req.query;
    const monthNumber = getMonthNumber(month);

    try {
        const totalSales = await Transaction.aggregate([
            { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] } } },
            { $group: { _id: null, totalSales: { $sum: "$price" } } }
        ]);

        const totalSoldItems = await Transaction.countDocuments({ $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] }, sold: true });
        const totalNotSoldItems = await Transaction.countDocuments({ $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] }, sold: false });

        res.json({
            total_sales: totalSales[0]?.totalSales || 0,
            total_sold_items: totalSoldItems,
            total_not_sold_items: totalNotSoldItems
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Bar chart API
router.get('/barchart', async (req, res) => {
    const { month } = req.query;
    const monthNumber = getMonthNumber(month);
    const priceRanges = [
        { range: '0-100', min: 0, max: 100 },
        { range: '101-200', min: 101, max: 200 },
        { range: '201-300', min: 201, max: 300 },
        { range: '301-400', min: 301, max: 400 },
        { range: '401-500', min: 401, max: 500 },
        { range: '501-600', min: 501, max: 600 },
        { range: '601-700', min: 601, max: 700 },
        { range: '701-800', min: 701, max: 800 },
        { range: '801-900', min: 801, max: 900 },
        { range: '901-above', min: 901, max: Infinity }
    ];

    try {
        const result = {};

        for (const { range, min, max } of priceRanges) {
            const count = await Transaction.countDocuments({
                $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] },
                price: { $gte: min, $lt: max }
            });
            result[range] = count;
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Pie chart API
router.get('/piechart', async (req, res) => {
    const { month } = req.query;
    const monthNumber = getMonthNumber(month);

    try {
        const categories = await Transaction.aggregate([
            { $match: { $expr: { $eq: [{ $month: "$dateOfSale" }, parseInt(monthNumber)] } } },
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const result = {};
        categories.forEach(category => {
            result[category._id] = category.count;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Combined API
router.get('/combined', async (req, res) => {
    const { month } = req.query;

    try {
        const [transactionsResponse, statisticsResponse, barChartResponse, pieChartResponse] = await Promise.all([
            axios.get(`http://localhost:5000/api/transactions?month=${month}`),
            axios.get(`http://localhost:5000/api/statistics?month=${month}`),
            axios.get(`http://localhost:5000/api/barchart?month=${month}`),
            axios.get(`http://localhost:5000/api/piechart?month=${month}`)
        ]);

        const combinedResponse = {
            transactions: transactionsResponse.data,
            statistics: statisticsResponse.data,
            bar_chart: barChartResponse.data,
            pie_chart: pieChartResponse.data
        };

        res.json(combinedResponse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
