const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const materialRoutes = require('./materialRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const requestRoutes = require('./requestRoutes');
const notificationRoutes = require('./notificationRoutes');
const batchRoutes = require('./batchRoutes');
const productionRoutes = require('./productionRoutes');
const machineRoutes = require('./machineRoutes');
const moldRoutes = require('./moldRoutes');
const assemblyRoutes = require('./assemblyRoutes');
const platingRoutes = require('./platingRoutes');
const finishedProductRoutes = require('./finishedProductRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/materials', materialRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/material-requests', requestRoutes);
router.use('/notifications', notificationRoutes);
router.use('/batches', batchRoutes);
router.use('/production', productionRoutes);
router.use('/machines', machineRoutes);
router.use('/molds', moldRoutes);
router.use('/assemblies', assemblyRoutes);
router.use('/plating', platingRoutes);
router.use('/finished-products', finishedProductRoutes);

module.exports = router;